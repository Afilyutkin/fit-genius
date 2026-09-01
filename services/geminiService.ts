import { UserProfile, ChatMessage, DayPlan, MealDetails, PlannedMeal, ExerciseDetail, SessionBlock } from "../types";
import { describeSports, sportNames, totalWorkoutsPerWeek } from "../utils/profile";
import { DAY_NAMES } from "../utils/days";
import { summarizeHistoryForPrompt } from "../utils/planHistory";
import { describeCompetitionForPrompt } from "../utils/competition";
import { describeMethodologyForPrompt } from "../utils/methodology";

export const SYSTEM_INSTRUCTION_BASE = `
You are Fit Genius AI, a world-class empathetic and motivating fitness & health coach.
Your goal is to help the user achieve their fitness goals while strictly adhering to their safety constraints and religious dietary restrictions if any.

COMMUNICATION STYLE:
- Use clear Markdown formatting with headers (###), bold text (**), and lists (-).
- CRITICAL: NEVER output raw JSON blocks or technical data structures in the chat.
- If you discuss plan changes, describe them in plain text. A separate system handles technical synchronization.
- Keep responses concise, encouraging, and actionable.
- Never use em-dash or en-dash characters. Use a comma, a period or a regular hyphen instead.
`;

// Ordered by preference, newest first. Google retires ids on its own schedule,
// so this is only a ranking: what actually gets called is intersected with the
// live ListModels response, and any id the API rejects at call time is dropped
// and retried (see MODEL_BLACKLIST).
const MODEL_PREFERENCES = [
  'gemini-3.6-flash',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
];

/** Requests that hang forever would leave the UI stuck on a spinner. */
const REQUEST_TIMEOUT_MS = 90_000;

/** How many different models one request may try before failing. */
const MAX_MODEL_ATTEMPTS = 3;

let _modelCache: { key: string; models: string[] } | null = null;

/**
 * Ids that ListModels advertises but generateContent refuses, e.g.
 * "This model is no longer available to new users". Only a live call reveals
 * these, so they are remembered for the rest of the session.
 */
const MODEL_BLACKLIST = new Set<string>();

/** True when the API is telling us to pick another model, not to give up. */
const isModelUnavailable = (status: number, message: string): boolean =>
  status === 404 ||
  /no longer available|not found|not supported|deprecated|does not exist/i.test(message);

/**
 * Google's servers are busy, not the request's fault. Unlike an unavailable
 * model this is temporary, so the id must NOT be blacklisted: another model
 * usually answers immediately, and the same one works again moments later.
 */
const isOverloaded = (status: number, message: string): boolean =>
  status === 503 ||
  /high demand|overloaded|try again later|currently unavailable|temporarily/i.test(message);

/** Error codes the UI can translate, instead of showing raw API English. */
export type GeminiErrorCode =
  | 'no_key' | 'bad_key' | 'rate_limit' | 'overloaded' | 'timeout'
  | 'network' | 'no_model' | 'empty' | 'blocked' | 'region' | 'unknown';

export class GeminiError extends Error {
  code: GeminiErrorCode;
  constructor(code: GeminiErrorCode, message: string) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
  }
}

const RETRY_BACKOFF_MS = 1500;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ordered list of models this key may call, preferred first. Cached per key;
 * pass `refresh` after a model turned out to be dead.
 */
async function resolveModels(apiKey: string, refresh = false): Promise<string[]> {
  const key = apiKey.trim();
  if (!refresh && _modelCache?.key === key) {
    return _modelCache.models.filter(m => !MODEL_BLACKLIST.has(m));
  }

  let ranked: string[] = [];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`,
      { method: 'GET' }
    );
    if (res.ok) {
      const data = await res.json();
      const available: string[] = (data.models || [])
        .filter((m: any) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
        )
        .map((m: any) => (m.name as string).replace('models/', ''));

      const availableSet = new Set(available);
      // Preferred ids that exist, then any other flash/pro model as a tail, so
      // a future rename still leaves something callable.
      ranked = [
        ...MODEL_PREFERENCES.filter(m => availableSet.has(m)),
        ...available.filter(m =>
          !MODEL_PREFERENCES.includes(m) &&
          (m.includes('flash') || m.includes('pro')) &&
          !m.includes('vision') && !m.includes('embedding') && !m.includes('image')
        ),
      ];
    }
  } catch (e) {
    console.warn('[resolveModels] listing failed:', e);
  }

  if (ranked.length === 0) ranked = [...MODEL_PREFERENCES];

  _modelCache = { key, models: ranked };
  return ranked.filter(m => !MODEL_BLACKLIST.has(m));
}

/** Turns any transport failure into a message a user can act on. */
const describeError = (e: any): Error => {
  if (e?.name === 'AbortError') {
    return new GeminiError('timeout', 'The request took too long and was cancelled. Please try again.');
  }
  const msg = String(e?.message || e || 'Unknown error');
  if (msg === 'Failed to fetch' || msg.toLowerCase().includes('networkerror')) {
    return new GeminiError('network', 'Cannot reach the Gemini API. Check your connection or disable ad-blockers / extensions that block Google APIs.');
  }
  return e instanceof Error ? e : new GeminiError('unknown', msg);
};

const ERROR_TEXT: Record<GeminiErrorCode, { en: string; ru: string }> = {
  no_key: {
    en: 'No Gemini API key configured. Add one in your Profile.',
    ru: 'Ключ Gemini API не задан. Добавьте его в профиле.',
  },
  bad_key: {
    en: 'The Gemini API key was rejected. Check the key in your Profile.',
    ru: 'Ключ Gemini API отклонён. Проверьте ключ в профиле.',
  },
  rate_limit: {
    en: 'Gemini rate limit reached for this key. Wait a minute and try again.',
    ru: 'Исчерпан лимит запросов для этого ключа. Подождите минуту и повторите.',
  },
  overloaded: {
    en: 'Google servers are overloaded right now. This is temporary, please try again in a minute.',
    ru: 'Серверы Google сейчас перегружены. Это временно, попробуйте ещё раз через минуту.',
  },
  timeout: {
    en: 'The request took too long and was cancelled. Please try again.',
    ru: 'Запрос выполнялся слишком долго и был отменён. Попробуйте ещё раз.',
  },
  network: {
    en: 'Cannot reach the Gemini API. Check your connection, or disable ad-blockers and extensions that block Google APIs.',
    ru: 'Нет связи с Gemini API. Проверьте интернет или отключите блокировщики рекламы и расширения, которые режут запросы к Google.',
  },
  no_model: {
    en: 'No Gemini model is available for this API key.',
    ru: 'Для этого ключа нет доступных моделей Gemini.',
  },
  empty: {
    en: 'Gemini returned an empty response. Please try again.',
    ru: 'Gemini вернул пустой ответ. Попробуйте ещё раз.',
  },
  blocked: {
    en: 'Gemini refused to answer this request. Try rephrasing your profile details.',
    ru: 'Gemini отказался отвечать на этот запрос. Попробуйте изменить формулировки в профиле.',
  },
  region: {
    en: 'Google does not serve the Gemini API from your region ("User location is not supported"). Any key gets the same answer. Use a VPN, or route requests through your own server in a supported region.',
    ru: 'Google не обслуживает Gemini API из вашего региона («User location is not supported»). Любой ключ получит тот же ответ. Нужен VPN или запросы через ваш сервер в поддерживаемом регионе.',
  },
  unknown: { en: '', ru: '' },
};

/**
 * Localised, human-readable text for an error thrown by this module. Views used
 * to print `e.message` straight through, which showed Google's English strings
 * inside the Russian UI.
 */
export const describeGeminiError = (e: any, language: 'en' | 'ru' = 'en'): string => {
  const code: GeminiErrorCode = e?.code && e.code in ERROR_TEXT ? e.code : 'unknown';
  const text = ERROR_TEXT[code][language];
  if (text) return text;
  return String(e?.message || (language === 'ru' ? 'Неизвестная ошибка' : 'Unknown error'));
};

const geminiRest = async (
  apiKey: string,
  systemInstruction: string,
  contents: any[],
  responseMimeType: string = "text/plain"
): Promise<string> => {
  const key = apiKey?.trim();
  if (!key) throw new GeminiError('no_key', ERROR_TEXT.no_key.en);

  const body: any = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 16384,
    }
  };

  if (responseMimeType === "application/json") {
    body.generationConfig.responseMimeType = "application/json";
  }

  let models = await resolveModels(key);
  if (models.length === 0) {
    MODEL_BLACKLIST.clear();               // nothing left to try: start over
    models = await resolveModels(key, true);
  }

  const attempt = async (model: string): Promise<{ text: string } | { retry: GeminiErrorCode }> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    let data: any;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      throw describeError(e);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const apiMsg: string = data?.error?.message || '';

      // Permanently gone for this key: never call it again this session.
      if (isModelUnavailable(res.status, apiMsg)) {
        console.warn(`[Fit Genius] Model ${model} unavailable, trying the next one.`, apiMsg);
        MODEL_BLACKLIST.add(model);
        return { retry: 'no_model' };
      }
      // Busy right now: keep the model, just move on to the next candidate.
      if (isOverloaded(res.status, apiMsg)) {
        console.warn(`[Fit Genius] Model ${model} is overloaded, trying the next one.`, apiMsg);
        return { retry: 'overloaded' };
      }
      // Geo-blocking answers 400 for every key; saying "bad key" would be wrong.
      if (/location is not supported|not available in your country|not supported for the API use/i.test(apiMsg)) {
        throw new GeminiError('region', ERROR_TEXT.region.en);
      }
      if (res.status === 400 && /api key/i.test(apiMsg)) {
        throw new GeminiError('bad_key', ERROR_TEXT.bad_key.en);
      }
      if (res.status === 429) {
        throw new GeminiError('rate_limit', ERROR_TEXT.rate_limit.en);
      }
      throw new GeminiError('unknown', apiMsg || `Gemini request failed (HTTP ${res.status}).`);
    }

    const candidate = data?.candidates?.[0];
    // Long answers arrive split across several parts — concatenate them all,
    // otherwise JSON plans come back truncated.
    const text: string = (candidate?.content?.parts || [])
      .map((p: any) => p?.text || '')
      .join('');

    if (!text) {
      const blocked = data?.promptFeedback?.blockReason || candidate?.finishReason;
      if (blocked && blocked !== 'STOP') {
        throw new GeminiError('blocked', `Gemini returned no content (reason: ${blocked}).`);
      }
      throw new GeminiError('empty', ERROR_TEXT.empty.en);
    }

    console.log('[Fit Genius] Model used:', model);
    return { text };
  };

  const candidates = models.slice(0, MAX_MODEL_ATTEMPTS);
  let lastCode: GeminiErrorCode = 'no_model';

  // First pass: walk the candidates. A model ListModels advertises can be closed
  // to this key, or simply busy; either way the next one usually answers.
  for (const model of candidates) {
    const result = await attempt(model);
    if ('text' in result) return result.text;
    lastCode = result.retry;
  }

  // Everything was busy. Overload is short-lived, so wait once and retry the
  // preferred model rather than making the user press the button again.
  if (lastCode === 'overloaded') {
    const survivors = candidates.filter(m => !MODEL_BLACKLIST.has(m));
    if (survivors.length) {
      await sleep(RETRY_BACKOFF_MS);
      const result = await attempt(survivors[0]);
      if ('text' in result) return result.text;
    }
    throw new GeminiError('overloaded', ERROR_TEXT.overloaded.en);
  }

  throw new GeminiError('no_model', ERROR_TEXT.no_model.en);
};

/**
 * Universal JSON repair for AI responses
 */
export const repairJson = (str: string): string => {
  if (!str) return "[]";

  // Find structural markers
  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');

  let startIdx = -1;
  let isArray = false;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    isArray = false;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    isArray = true;
  }

  if (startIdx === -1) {
    // No JSON structure found, try to clean markdown
    return str.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  let jsonSnippet = str.substring(startIdx);
  const closer = isArray ? ']' : '}';
  const lastIdx = jsonSnippet.lastIndexOf(closer);

  if (lastIdx !== -1) {
    try {
      const candidate = jsonSnippet.substring(0, lastIdx + 1);
      JSON.parse(candidate);
      return candidate;
    } catch (e) {
      // Still failed parsing (likely internal truncation), proceed to character-by-character repair
    }
  }

  let openBrackets = 0;
  let openBraces = 0;
  let inQuote = false;
  let escaped = false;
  let repaired = "";
  let lastStructuralChar = "";

  for (let i = 0; i < jsonSnippet.length; i++) {
    const char = jsonSnippet[i];
    if (escaped) { escaped = false; repaired += char; continue; }
    if (char === '\\') { escaped = true; repaired += char; continue; }
    if (char === '"') { inQuote = !inQuote; repaired += char; continue; }
    if (!inQuote) {
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (/[{}:,]/.test(char)) lastStructuralChar = char;
    }
    repaired += char;
  }

  if (inQuote) repaired += '"';
  while (openBraces > 0) {
    const trimmed = repaired.trim();
    if (trimmed.endsWith(':')) {
      repaired += ' null';
    } else if (lastStructuralChar === '{' || lastStructuralChar === ',') {
      // If the last thing we saw was a start of an object or a comma, 
      // and we just added a quote (or word), it's likely a property name.
      if (trimmed.endsWith('"')) {
        repaired += ': null';
      }
    }
    repaired = repaired.replace(/,\s*$/, '');
    repaired += '}';
    openBraces--;
    lastStructuralChar = '}'; // Reset for next level
  }
  while (openBrackets > 0) {
    repaired = repaired.replace(/,\s*$/, '');
    repaired += ']';
    openBrackets--;
  }

  // Final structural polish
  repaired = repaired.replace(/}\s*{/g, '},{').replace(/]\s*\[/g, '],[');
  return repaired;
};

/* ============================================================
   PLAN NORMALIZATION
   The model is free-form: it may return numbers where the UI expects
   strings, omit a meal, or return fewer than 7 days. Every screen used
   to read those fields blindly, so a single odd field crashed the view.
   Everything below coerces the response into the DayPlan shape.
============================================================ */

/**
 * The prompt forbids em-dashes and the model keeps producing them anyway, so
 * the guarantee is made here instead of hoping: " word - word " reads the same
 * and matches the rest of the interface.
 */
const stripDashes = (text: string): string =>
  text.replace(/\s*[—–]\s*/g, ', ').replace(/,\s*,/g, ',');

const toText = (v: any, fallback = ''): string => {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return stripDashes(v).trim() || fallback;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(x => toText(x)).filter(Boolean).join(', ') || fallback;
  return fallback;
};

/**
 * Free-text fields (recipe, tips, form cues) must reach the markdown renderer
 * as a string. The model answers with arrays of steps or nested objects often
 * enough that this coercion is load-bearing, not defensive decoration.
 */
const toMarkdown = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(toMarkdown).filter(Boolean).join('\n');
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k, val]) => {
        const body = toMarkdown(val);
        return body ? `**${k}**\n${body}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  return '';
};

const toNumber = (v: any, fallback = 0): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const parsed = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
};

const normalizeMeal = (raw: any, fallbackName: string): MealDetails => ({
  name: toText(raw?.name ?? raw?.title, fallbackName),
  calories: toNumber(raw?.calories),
  protein: toNumber(raw?.protein),
  fats: toNumber(raw?.fats ?? raw?.fat),
  carbs: toNumber(raw?.carbs ?? raw?.carbohydrates),
  ingredients: Array.isArray(raw?.ingredients)
    ? raw.ingredients.map((i: any) => toText(i)).filter(Boolean)
    : undefined,
  recipe: raw?.recipe ? toMarkdown(raw.recipe) : undefined,
  tip: raw?.tip ? toMarkdown(raw.tip) : undefined,
});

/** Labels used when an old plan or a sloppy response carries no slot name. */
const SLOT_LABELS: Record<'en' | 'ru', { breakfast: string; lunch: string; snack: string; dinner: string; meal: string }> = {
  en: { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner', meal: 'Meal' },
  ru: { breakfast: 'Завтрак', lunch: 'Обед', snack: 'Перекус', dinner: 'Ужин', meal: 'Приём пищи' },
};

/** Order the legacy fixed keys were eaten in. */
const LEGACY_SLOTS: ('breakfast' | 'lunch' | 'snack' | 'dinner')[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/**
 * Reads the meal list from any shape we have ever stored:
 * the current ordered `items` array, or the old fixed
 * breakfast/lunch/snack/dinner object still sitting in localStorage.
 */
const normalizeMealList = (meals: any, language: 'en' | 'ru'): PlannedMeal[] => {
  const labels = SLOT_LABELS[language] ?? SLOT_LABELS.en;

  const source: any[] = Array.isArray(meals?.items)
    ? meals.items
    : Array.isArray(meals)
      ? meals
      : LEGACY_SLOTS
        .filter(slot => meals?.[slot])
        .map(slot => ({ ...meals[slot], slot: labels[slot] }));

  return source
    .map((raw, i) => ({
      ...normalizeMeal(raw, ''),
      slot: toText(raw?.slot ?? raw?.type ?? raw?.title, `${labels.meal} ${i + 1}`),
    }))
    .filter(meal => !!meal.name);
};

const BLOCKS: SessionBlock[] = ['warmup', 'main', 'accessory', 'cooldown'];

/** Older plans and sloppy responses carry no block; treat those as main work. */
const toBlock = (raw: any): SessionBlock => {
  const v = String(raw ?? '').toLowerCase();
  if (/warm|разм/.test(v)) return 'warmup';
  if (/cool|down|заминк|растяж/.test(v)) return 'cooldown';
  if (/access|подсоб|доп/.test(v)) return 'accessory';
  return BLOCKS.includes(v as SessionBlock) ? (v as SessionBlock) : 'main';
};

const normalizeExercise = (raw: any): ExerciseDetail | null => {
  const name = toText(raw?.name ?? raw?.exercise ?? raw?.title);
  if (!name) return null;
  return {
    name,
    sets: toNumber(raw?.sets, 1),
    // The model happily returns `reps: 12` — the UI calls string methods on it.
    reps: toText(raw?.reps ?? raw?.repetitions, '-'),
    rest: toText(raw?.rest ?? raw?.restTime),
    intensity: toText(raw?.intensity ?? raw?.effort ?? raw?.rpe) || undefined,
    block: toBlock(raw?.block ?? raw?.phase ?? raw?.section),
    notes: raw?.notes ? toMarkdown(raw.notes) : undefined,
  };
};

/**
 * Coerces an arbitrary AI response into exactly 7 well-formed DayPlan objects.
 */
export const normalizeWeeklyPlan = (raw: any, language: 'en' | 'ru' = 'en'): DayPlan[] => {
  const list: any[] = Array.isArray(raw)
    ? raw
    : (raw?.plan || raw?.days || raw?.weeklyPlan || raw?.week || []);

  const names = DAY_NAMES[language] ?? DAY_NAMES.en;

  return names.map((dayName, idx) => {
    const src = list[idx] ?? {};
    const meals = src?.meals ?? {};
    const exercises = Array.isArray(src?.exercises)
      ? src.exercises.map(normalizeExercise).filter(Boolean) as ExerciseDetail[]
      : [];

    return {
      day: dayName,
      workoutTitle: toText(src?.workoutTitle ?? src?.title, ''),
      exercises,
      totalCalories: toNumber(src?.totalCalories ?? src?.calories),
      meals: {
        items: normalizeMealList(meals, language),
        sportsNutrition: Array.isArray(meals?.sportsNutrition)
          ? meals.sportsNutrition.map((s: any) => normalizeMeal(s, '')).filter((s: MealDetails) => !!s.name)
          : [],
      },
      workoutTip: toText(src?.workoutTip),
      nutritionTip: toText(src?.nutritionTip),
    };
  });
};

/** Coerces an on-demand recipe / supplement response into renderable fields. */
const normalizeDetails = (raw: any): Partial<MealDetails> => ({
  ingredients: Array.isArray(raw?.ingredients)
    ? raw.ingredients.map((i: any) => toText(i)).filter(Boolean)
    : undefined,
  recipe: raw?.recipe ? toMarkdown(raw.recipe) : undefined,
  tip: raw?.tip ? toMarkdown(raw.tip) : undefined,
});

export type KeyCheckCode =
  | 'ok' | 'empty' | 'rejected' | 'wrong_type' | 'restricted' | 'region' | 'disabled' | 'unverified';

export interface KeyCheckResult {
  ok: boolean;
  code: KeyCheckCode;
  /** Raw text from Google, kept for the details line under the field. */
  detail?: string;
}

/**
 * Checks a key against ListModels and reports WHY it failed.
 *
 * The old version collapsed 400/401/403 into a single "invalid key", which hid
 * the three failures that are not a typo: a key restricted to another domain
 * (403 on localhost but fine in production), a project where the Generative
 * Language API was never enabled, and a key from a different Google product.
 */
/**
 * Rough shape check for a Google AI Studio key.
 *
 * Deliberately permissive: it exists to catch a credential from a different
 * product (those carry a dot and another prefix), not to police length. Google
 * has changed key lengths before, and a false accusation on a working key is
 * worse than staying quiet.
 */
export const looksLikeStudioKey = (key: string): boolean => {
  const k = (key || '').trim();
  return k.startsWith('AIza') && !k.includes('.') && k.length >= 20;
};

export const validateApiKey = async (apiKey: string): Promise<KeyCheckResult> => {
  const key = apiKey?.trim();
  if (!key || key.length < 10) return { ok: false, code: 'empty' };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`
    );

    if (res.ok) return { ok: true, code: 'ok' };

    // The key works, the project is just out of quota for the moment.
    if (res.status === 429) return { ok: true, code: 'ok' };

    const data = await res.json().catch(() => ({}));
    const msg: string = data?.error?.message || '';
    const status: string = data?.error?.status || '';

    if (/location is not supported|not available in your country|not supported for the API use/i.test(msg)) {
      return { ok: false, code: 'region', detail: msg };
    }
    if (/SERVICE_DISABLED/i.test(status) || /has not been used|is disabled|enable it by visiting/i.test(msg)) {
      return { ok: false, code: 'disabled', detail: msg };
    }
    // A credential from another Google product: Google answers 401 and asks
    // for an OAuth token instead of an API key.
    if (/UNAUTHENTICATED/i.test(status) || /OAuth 2 access token|login cookie|authentication credential/i.test(msg)) {
      return { ok: false, code: 'wrong_type', detail: msg };
    }
    if (/referer|referrer|blocked|restriction|not authorized|IP address/i.test(msg)) {
      return { ok: false, code: 'restricted', detail: msg };
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { ok: false, code: 'rejected', detail: msg };
    }
    // Anything else (5xx and friends) says nothing about the key itself.
    return { ok: true, code: 'unverified', detail: msg };
  } catch (e) {
    // Offline, or an extension blocking Google APIs: do not accuse the key.
    return { ok: true, code: 'unverified', detail: String((e as Error)?.message || e) };
  }
};

/** Explains a failed key check, including what to do about it. */
export const describeKeyCheck = (result: KeyCheckResult, language: 'en' | 'ru' = 'en'): string => {
  const isRu = language === 'ru';
  switch (result.code) {
    case 'empty':
      return isRu ? 'Введите ключ Gemini API.' : 'Enter a Gemini API key.';
    case 'disabled':
      return isRu
        ? 'Ключ рабочий, но в его проекте не включён Generative Language API. Откройте ссылку из ответа Google и нажмите Enable, затем проверьте снова.'
        : 'The key is real, but the Generative Language API is not enabled for its project. Open the link in Google\'s response, press Enable, then re-check.';
    case 'restricted':
      return isRu
        ? 'Google отклонил ключ из-за ограничений: он привязан к другому сайту или IP. Разрешите текущий адрес в настройках ключа или используйте ключ без ограничений.'
        : 'Google rejected the key because of its restrictions: it is bound to another site or IP. Allow the current address in the key settings, or use an unrestricted key.';
    case 'region':
      return isRu
        ? 'Google не обслуживает Gemini API из вашего региона: он отвечает «User location is not supported». Ключ здесь ни при чём, тот же ответ придёт на любой ключ. Нужен доступ из поддерживаемой страны: либо через VPN, либо запросы должны идти через ваш сервер, размещённый в поддерживаемом регионе.'
        : 'Google does not serve the Gemini API from your region: it answers "User location is not supported". The key is not the problem, any key gets the same answer. You need access from a supported country, either through a VPN or by routing requests through your own server hosted in a supported region.';
    case 'wrong_type':
      return isRu
        ? 'Это не ключ Gemini API, а токен другого сервиса Google: на него Google отвечает «ожидался OAuth-токен». Нужен ключ из Google AI Studio (ai.google.dev), он начинается с «AIza» и создаётся кнопкой Get API key.'
        : 'This is not a Gemini API key but a credential from another Google service: Google answers that it expected an OAuth token. You need a key from Google AI Studio (ai.google.dev); it starts with "AIza" and is created with the Get API key button.';
    case 'rejected':
      return isRu
        ? 'Google не принял этот ключ. Убедитесь, что он создан в Google AI Studio (ai.google.dev). Ключи оттуда начинаются с «AIza». Ключи от других сервисов Google здесь не работают.'
        : 'Google did not accept this key. Make sure it was created in Google AI Studio (ai.google.dev). Those keys start with "AIza". Keys from other Google services do not work here.';
    case 'unverified':
      return isRu
        ? 'Не удалось проверить ключ: нет ответа от Google. Ключ сохранён, попробуйте создать план.'
        : 'Could not verify the key: no response from Google. The key is saved, try generating a plan.';
    default:
      return '';
  }
};

export const generateCoachResponse = async (
  history: ChatMessage[],
  userProfile: UserProfile,
  userMessage: string,
  apiKey?: string,
  language: 'en' | 'ru' = 'en'
): Promise<string> => {
  const key = (apiKey || localStorage.getItem('zenith_gemini_key') || '').trim();
  const profileContext = `User: ${userProfile.name}, Goals: ${userProfile.fitnessGoals.join(", ")}, Level: ${userProfile.fitnessLevel}.`;
  const systemInstruction = `${SYSTEM_INSTRUCTION_BASE}\n${profileContext}\nRespond in ${language === 'ru' ? 'Russian' : 'English'}.`;
  const contents = [
    // Gemini rejects a history that starts with a model turn (our greeting).
    ...history
      .filter((msg, i) => !(i === 0 && msg.role === 'model'))
      .map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] })),
    { role: 'user', parts: [{ text: userMessage }] }
  ];
  // Errors bubble up so the caller can render them as an error, not as coach advice.
  return await geminiRest(key, systemInstruction, contents);
};

export const generateWeeklyPlan = async (
  userProfile: UserProfile,
  apiKey?: string,
  language: 'en' | 'ru' = 'en'
): Promise<DayPlan[]> => {
  const key = (apiKey || localStorage.getItem('zenith_gemini_key') || '').trim();
  const lang = language === 'ru' ? 'Russian' : 'English';
  const mealsPerDay = Math.min(6, Math.max(2, Math.round(userProfile.mealsPerDay || 4)));
  // What the user actually did in previous weeks: the plan continues from there.
  const history = summarizeHistoryForPrompt(language);
  // Periodisation brief: an athlete three weeks out needs a different week.
  const competition = describeCompetitionForPrompt(userProfile, language);
  // Level- and sport-appropriate coaching frameworks, so a first-timer and a
  // competitive athlete stop getting the same undifferentiated week.
  const methodology = describeMethodologyForPrompt(userProfile, language);

  const systemInstruction = `You are a holistic Health AI named Fit Genius. 
  CRITICAL RULE: You MUST strictly adhere to the following user profile:
  - Dietary Preferences: ${userProfile.dietaryPreferences} (NEVER suggest foods that violate this).
  - Sports and their own weekly schedule: ${describeSports(userProfile) || "none specified"}.
    Each entry reads "Sport TIMESxDURATION min". Honour every one of them separately: that sport appears exactly that many times a week, and its sessions last about that long.
  - Health/Safety Constraints: ${userProfile.contraindications || "None"}.
  - Fitness Level: ${userProfile.fitnessLevel}.
  - Goals: ${userProfile.fitnessGoals.join(", ")}.
  - Physical: ${userProfile.weight}kg, ${userProfile.height}cm, ${userProfile.age}y, ${userProfile.gender}.
  - Lifestyle/Activity Level: ${userProfile.activityLevel}.
  - Total training sessions a week: ${totalWorkoutsPerWeek(userProfile)}. Days without a session are rest days, say so in workoutTitle.
  - Meals per day: EXACTLY ${mealsPerDay}. This is the user's eating rhythm, never add or drop a meal.
  - Sports Supplements: ${userProfile.useSupplements
      ? `ENABLED. Generate a LOGICAL, TIME-ORDERED supplement schedule for the day.
    Each sportsNutrition entry MUST have a "name" field that starts with the time slot in brackets, e.g.:
      "[Утром]" / "[Morning]", "[Перед тренировкой]" / "[Pre-Workout]", "[Во время тренировки]" / "[During Workout]",
      "[После тренировки]" / "[Post-Workout]", "[Днём]" / "[Afternoon]", "[Вечером]" / "[Evening]", "[Перед сном]" / "[Before Bed]"
    Followed by the supplement name and dose, e.g.: "[Pre-Workout] Caffeine 200mg + Beta-Alanine 3.2g"

    TRAINING DAY SCHEDULE (for sports: ${sportNames(userProfile).join(', ')}, goals: ${userProfile.fitnessGoals.join(', ')}):
      1. [Morning] Vitamin D3 + K2 + Omega-3 (with breakfast — foundational health)
      2. [Pre-Workout] Caffeine + Beta-Alanine (30-45 min before — energy & endurance). Add Creatine here for strength/muscle goals.
      3. [During Workout] Electrolytes + EAAs (if session > 60 min) OR BCAA drink (for muscle-preserving sports)
      4. [Post-Workout] Whey Protein + fast Carbs (within 30 min — recovery & muscle synthesis). Add Creatine if not taken pre-workout.
      5. [Evening] Magnesium Glycinate (relaxation, muscle recovery)
      6. [Before Bed] Casein Protein OR Collagen + Glycine (slow protein release during sleep)

    REST DAY SCHEDULE (no stimulants on rest days):
      1. [Morning] Vitamin D3 + K2 + Omega-3 (with breakfast)
      2. [Afternoon] Collagen Peptides (joint & tissue recovery)
      3. [Evening] Magnesium Glycinate + ZMA (recovery, testosterone support, sleep)
      4. [Before Bed] Casein Protein (muscle protein synthesis during sleep)

    RULES:
    - Choose ONLY entries that are relevant and logical for the day type and sport.
    - Do not contradict meal timing (e.g., no protein shake right before a protein-rich meal).
    - Adjust selections to the dietary preference: ${userProfile.dietaryPreferences} (e.g., use plant protein for vegans).
    - Provide realistic macro values per serving for each supplement.`
      : 'DISABLED. Return an empty array [] for sportsNutrition on every day.'}.

  ${methodology}
  ${competition}
  ${history}
  Return ONLY a raw JSON array of 7 DayPlan objects for a full week (Monday-Sunday). 
  LANGUAGE: EVERY string a user can read must be written in ${lang}, with no exceptions and no mixing:
  workoutTitle, exercise names, meal names and slots, supplement names, workoutTip and nutritionTip.
  Do not leave English terms such as "Rest Day", "Full Body" or "Cardio" untranslated when ${lang} is not English.
  Never use em-dash or en-dash characters anywhere; use a comma or a regular hyphen.
  Respond in ${lang}. Use the precise schema provided.`;

  const prompt = `
    Generate a personalized 7-day health plan.
    Plan structure MUST follow this JSON schema:
    [{ 
      "day": "Monday", 
      "workoutTitle": "string (Focus on favorite sports)", 
      "exercises": [{ "block": "warmup | main | accessory | cooldown", "name": "string", "sets": number, "reps": "string", "rest": "string", "intensity": "string, prescribed effort e.g. RPE 7 or 70% of 1RM or 5:30/km pace" }], 
      "totalCalories": number (Calculated for ${userProfile.weight}kg user), 
      "meals": { 
        "items": [{ "slot": "string, the meal's name in ${lang} e.g. Breakfast / Lunch / Snack / Dinner", "name": "string", "calories": number, "protein": number, "fats": number, "carbs": number }],
        "sportsNutrition": [{ "name": "string, starts with time slot e.g. [Pre-Workout] Whey Protein 30g", "calories": number, "protein": number, "fats": number, "carbs": number }]
      }, 
      "workoutTip": "string (Specific tactical advice for this workout, technique or safety)",
      "nutritionTip": "string (Specific dietary advice related to this day's meals or hydration)"
    }]
    
    IMPORTANT: 
    0. "items" MUST contain EXACTLY ${mealsPerDay} meals for every day, ordered from the first meal of the day to the last. Split the daily calories across exactly those ${mealsPerDay} meals so they sum to "totalCalories". Name each "slot" naturally for its position and time of day in ${lang}; number repeated slots ("Snack 1", "Snack 2") when there is more than one.
    1. Omit "notes", "ingredients", "recipe" fields.
    2. Ensure meals strictly follow ${userProfile.dietaryPreferences}.
    3. Spread the sports across the week exactly as scheduled: ${describeSports(userProfile) || "no sports specified"}. Match each workout duration to the sport it belongs to.
    4. Respect health constraints: ${userProfile.contraindications || "None"}.
    5. Sports Nutrition — follow the time-ordered schedule from the system instructions. Each item must include the time slot in brackets at the start of the "name" field. Only include supplements that make logical sense for the day (training vs rest). If DISABLED: return an empty array [].
  `;
  try {
    const text = await geminiRest(key, systemInstruction, [{ role: 'user', parts: [{ text: prompt }] }], "application/json");
    const parsed = JSON.parse(repairJson(text));
    return normalizeWeeklyPlan(parsed, language);
  } catch (e: any) {
    console.error('[generateWeeklyPlan] error:', e);
    throw e;
  }
};

export const generateMealDetails = async (
  mealName: string,
  userProfile: UserProfile,
  apiKey?: string,
  language: 'en' | 'ru' = 'en'
): Promise<Partial<MealDetails>> => {
  const key = (apiKey || localStorage.getItem('zenith_gemini_key') || '').trim();
  const lang = language === 'ru' ? 'Russian' : 'English';

  const systemInstruction = `You are a Registered Dietitian AI. 
  CRITICAL: Profile of person to cook for:
  - Dietary Preferences: ${userProfile.dietaryPreferences}
  - Medical/Safety: ${userProfile.contraindications || "None"}
  - Level: ${userProfile.fitnessLevel}
  
  Provide ingredients and recipe for "${mealName}". 
  The recipe MUST strictly follow the dietary preferences.
  Return ONLY raw JSON. Respond in ${lang}.`;

  const prompt = `{ "ingredients": ["..."], "recipe": "Markdown instructions", "tip": "Expert cooking tip" }`;
  try {
    const text = await geminiRest(key, systemInstruction, [{ role: 'user', parts: [{ text: prompt }] }], "application/json");
    return normalizeDetails(JSON.parse(repairJson(text)));
  } catch (e) {
    console.error('[generateMealDetails] error:', e);
    throw e;
  }
};

export const generateSupplementTips = async (
  supplementName: string,
  userProfile: UserProfile,
  apiKey?: string,
  language: 'en' | 'ru' = 'en'
): Promise<Partial<MealDetails>> => {
  const key = (apiKey || localStorage.getItem('zenith_gemini_key') || '').trim();
  const lang = language === 'ru' ? 'Russian' : 'English';

  const systemInstruction = `You are a Sports Nutrition Expert AI.
  User profile:
  - Sport(s): ${sportNames(userProfile).join(', ')}
  - Goals: ${userProfile.fitnessGoals.join(', ')}
  - Fitness Level: ${userProfile.fitnessLevel}
  - Dietary Preferences: ${userProfile.dietaryPreferences}
  - Medical/Safety: ${userProfile.contraindications || "None"}

  Provide expert supplement advice for "${supplementName}".
  Return ONLY raw JSON. Respond in ${lang}.`;

  const prompt = `{
    "ingredients": ["List of key active compounds in this supplement, with dosage per serving"],
    "recipe": "Markdown guide covering: ## How to take it\\n(timing, dose, with or without food)\\n\\n## Why it works\\n(mechanism of action, benefits for the user's specific sport and goals)\\n\\n## Combinations\\n(what it stacks well with and why)\\n\\n## Cautions\\n(interactions, contraindications, cycling advice)",
    "tip": "One concise expert tip specific to the user's sport and goals"
  }`;

  try {
    const text = await geminiRest(key, systemInstruction, [{ role: 'user', parts: [{ text: prompt }] }], "application/json");
    return normalizeDetails(JSON.parse(repairJson(text)));
  } catch (e) {
    console.error('[generateSupplementTips] error:', e);
    throw e;
  }
};


export const generateExerciseDetails = async (
  exerciseName: string,
  userProfile: UserProfile,
  apiKey?: string,
  language: 'en' | 'ru' = 'en'
): Promise<Partial<ExerciseDetail>> => {
  const key = (apiKey || localStorage.getItem('zenith_gemini_key') || '').trim();
  const lang = language === 'ru' ? 'Russian' : 'English';

  const systemInstruction = `You are a Strength and Conditioning Coach AI. 
  CRITICAL: User Profile:
  - Fitness Level: ${userProfile.fitnessLevel}
  - Medical/Injuries: ${userProfile.contraindications || "None"}
  - Favorite Sports: ${sportNames(userProfile).join(", ")}
  
  Provide clear instructions and safety tips for "${exerciseName}". 
  Adjust instructions based on their level and constraints.
  Return ONLY raw JSON. Respond in ${lang}.`;

  const prompt = `{ "notes": "Clear step-by-step instructions and safety tips (Markdown)." }`;
  try {
    const text = await geminiRest(key, systemInstruction, [{ role: 'user', parts: [{ text: prompt }] }], "application/json");
    const parsed = JSON.parse(repairJson(text));
    // Normalize response keys, and coerce: the model sometimes answers with an
    // array of steps or a nested object where the UI expects markdown text.
    return {
      notes: toMarkdown(parsed.notes ?? parsed.instructions ?? parsed.note ?? parsed.instruction ?? parsed.text)
    };
  } catch (e) {
    console.error('[generateExerciseDetails] error:', e);
    throw e;
  }
};

export const askPlanQuestion = async (
  plan: string,
  question: string,
  agentType: 'fitness' | 'dietary',
  apiKey?: string,
  language: 'en' | 'ru' = 'en'
): Promise<string> => {
  const key = (apiKey || localStorage.getItem('zenith_gemini_key') || '').trim();
  const systemInstruction = `You are a ${agentType} AI. Answer based on this plan: ${plan}. Respond in ${language === 'ru' ? 'Russian' : 'English'}.`;
  // Errors bubble up so the view can render them as an error state instead of
  // presenting "❌ Error: …" as if it were expert advice.
  return await geminiRest(key, systemInstruction, [{ role: 'user', parts: [{ text: question }] }]);
};

export const refinePlanWithConsultation = async (
  chatHistory: ChatMessage[],
  userProfile: UserProfile,
  apiKey?: string,
  language: 'en' | 'ru' = 'en'
): Promise<DayPlan[]> => {
  const key = (apiKey || localStorage.getItem('zenith_gemini_key') || '').trim();
  const lang = language === 'ru' ? 'Russian' : 'English';
  const currentPlanStr = JSON.stringify(userProfile.weeklyPlan);

  const systemInstruction = `You are Fit Genius AI. 
  The user has been consulting with a trainer/dietitian. Your task is to update their existing 7-day Health Plan based on these consultations.
  
  CONTEXT:
  - User Profile: ${userProfile.name}, Level: ${userProfile.fitnessLevel}, Goals: ${userProfile.fitnessGoals.join(", ")}.
  - Current Plan: ${currentPlanStr}
  - CONSULTATION LOG (Chat): ${JSON.stringify(chatHistory)}

  CRITICAL RULES:
  1. ONLY update parts of the plan that were specifically discussed or logically affected by the chat.
  2. If the user asked for "more cardio", update the workoutTitle/exercises accordingly.
  3. If they discussed "less carbs for dinner", update the matching entry in meals.items accordingly.
  3b. Keep the same number of entries in meals.items as the current plan has, each with its "slot" label.
  4. Ensure the output is a VALID 7-day plan (Monday-Sunday) even if only some days change.
  5. Provide both "workoutTip" and "nutritionTip" for modified days.
  6. Respond ONLY with raw JSON array of 7 DayPlan objects. Respond in ${lang}.`;

  const prompt = `Based on our consultation, provide the updated 7-day plan. Return ONLY the JSON array.`;

  try {
    const text = await geminiRest(key, systemInstruction, [{ role: 'user', parts: [{ text: prompt }] }], "application/json");
    const parsed = JSON.parse(repairJson(text));
    return normalizeWeeklyPlan(parsed, language);
  } catch (e: any) {
    console.error('[refinePlanWithConsultation] error:', e);
    throw e;
  }
};
