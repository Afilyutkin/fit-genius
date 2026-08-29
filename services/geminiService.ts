import { UserProfile, ChatMessage, DayPlan, MealDetails, ExerciseDetail } from "../types";

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

// Ordered by preference — stable ids first, previews only as a fallback
const MODEL_PREFERENCES = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro',
];

/** Requests that hang forever would leave the UI stuck on a spinner. */
const REQUEST_TIMEOUT_MS = 90_000;

let _modelCache: { key: string; model: string } | null = null;

async function resolveModel(apiKey: string): Promise<string> {
  const key = apiKey.trim();
  if (_modelCache?.key === key) return _modelCache.model;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`,
      { method: 'GET' }
    );
    if (res.ok) {
      const data = await res.json();
      const available = new Set<string>(
        (data.models || [])
          .filter((m: any) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent')
          )
          .map((m: any) => (m.name as string).replace('models/', ''))
      );
      for (const pref of MODEL_PREFERENCES) {
        if (available.has(pref)) {
          _modelCache = { key, model: pref };
          console.log('[Fit Genius] Using model:', pref);
          return pref;
        }
      }
      const first = [...available].find(m => m.includes('flash') || m.includes('pro'));
      if (first) {
        _modelCache = { key, model: first };
        return first;
      }
    }
  } catch (e) {
    console.warn('[resolveModel] failed:', e);
  }
  return 'gemini-2.0-flash';
}

/** Turns any transport failure into a message a user can act on. */
const describeError = (e: any): Error => {
  if (e?.name === 'AbortError') {
    return new Error('The request took too long and was cancelled. Please try again.');
  }
  const msg = String(e?.message || e || 'Unknown error');
  if (msg === 'Failed to fetch' || msg.toLowerCase().includes('networkerror')) {
    return new Error('Cannot reach the Gemini API. Check your connection or disable ad-blockers / extensions that block Google APIs.');
  }
  return e instanceof Error ? e : new Error(msg);
};

const geminiRest = async (
  apiKey: string,
  systemInstruction: string,
  contents: any[],
  responseMimeType: string = "text/plain"
): Promise<string> => {
  const key = apiKey?.trim();
  if (!key) throw new Error('No Gemini API key configured. Add one in your Profile.');

  const model = await resolveModel(key);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

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
    const apiMsg = data?.error?.message;
    if (res.status === 400 && /api key/i.test(apiMsg || '')) {
      throw new Error('The Gemini API key was rejected. Check the key in your Profile.');
    }
    if (res.status === 429) {
      throw new Error('Gemini rate limit reached. Wait a minute and try again.');
    }
    throw new Error(apiMsg || `Gemini request failed (HTTP ${res.status}).`);
  }

  const candidate = data?.candidates?.[0];
  // Long answers arrive split across several parts — concatenate them all,
  // otherwise JSON plans come back truncated.
  const text: string = (candidate?.content?.parts || [])
    .map((p: any) => p?.text || '')
    .join('');

  if (!text) {
    const blocked = data?.promptFeedback?.blockReason || candidate?.finishReason;
    throw new Error(
      blocked && blocked !== 'STOP'
        ? `Gemini returned no content (reason: ${blocked}).`
        : 'Gemini returned an empty response. Please try again.'
    );
  }
  return text;
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

const DAY_NAMES: Record<'en' | 'ru', string[]> = {
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  ru: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
};

const toText = (v: any, fallback = ''): string => {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v.trim() || fallback;
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

const normalizeExercise = (raw: any): ExerciseDetail | null => {
  const name = toText(raw?.name ?? raw?.exercise ?? raw?.title);
  if (!name) return null;
  return {
    name,
    sets: toNumber(raw?.sets, 1),
    // The model happily returns `reps: 12` — the UI calls string methods on it.
    reps: toText(raw?.reps ?? raw?.repetitions, '-'),
    rest: toText(raw?.rest ?? raw?.restTime),
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
      day: toText(src?.day, dayName),
      workoutTitle: toText(src?.workoutTitle ?? src?.title, exercises.length ? dayName : ''),
      exercises,
      totalCalories: toNumber(src?.totalCalories ?? src?.calories),
      meals: {
        breakfast: normalizeMeal(meals?.breakfast, ''),
        lunch: normalizeMeal(meals?.lunch, ''),
        dinner: normalizeMeal(meals?.dinner, ''),
        snack: normalizeMeal(meals?.snack, ''),
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

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  const key = apiKey?.trim();
  if (!key || key.length < 10) return false;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`);
    return res.status !== 400 && res.status !== 401 && res.status !== 403;
  } catch (e) { return true; }
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

  const systemInstruction = `You are a holistic Health AI named Fit Genius. 
  CRITICAL RULE: You MUST strictly adhere to the following user profile:
  - Dietary Preferences: ${userProfile.dietaryPreferences} (NEVER suggest foods that violate this).
  - Favorite Sports: ${userProfile.preferredSports.join(", ")} (Incorporate these into the workout plan).
  - Health/Safety Constraints: ${userProfile.contraindications || "None"}.
  - Fitness Level: ${userProfile.fitnessLevel}.
  - Goals: ${userProfile.fitnessGoals.join(", ")}.
  - Physical: ${userProfile.weight}kg, ${userProfile.height}cm, ${userProfile.age}y, ${userProfile.gender}.
  - Lifestyle/Activity Level: ${userProfile.activityLevel}.
  - Schedule: ${userProfile.workoutsPerWeek} workouts/week, ${userProfile.workoutDurationMin} min duration.
  - Sports Supplements: ${userProfile.useSupplements
      ? `ENABLED. Generate a LOGICAL, TIME-ORDERED supplement schedule for the day.
    Each sportsNutrition entry MUST have a "name" field that starts with the time slot in brackets, e.g.:
      "[Утром]" / "[Morning]", "[Перед тренировкой]" / "[Pre-Workout]", "[Во время тренировки]" / "[During Workout]",
      "[После тренировки]" / "[Post-Workout]", "[Днём]" / "[Afternoon]", "[Вечером]" / "[Evening]", "[Перед сном]" / "[Before Bed]"
    Followed by the supplement name and dose, e.g.: "[Pre-Workout] Caffeine 200mg + Beta-Alanine 3.2g"

    TRAINING DAY SCHEDULE (for sports: ${userProfile.preferredSports.join(', ')}, goals: ${userProfile.fitnessGoals.join(', ')}):
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

  Return ONLY a raw JSON array of 7 DayPlan objects for a full week (Monday-Sunday). 
  Respond in ${lang}. Use the precise schema provided.`;

  const prompt = `
    Generate a personalized 7-day health plan.
    Plan structure MUST follow this JSON schema:
    [{ 
      "day": "Monday", 
      "workoutTitle": "string (Focus on favorite sports)", 
      "exercises": [{ "name": "string", "sets": number, "reps": "string", "rest": "string" }], 
      "totalCalories": number (Calculated for ${userProfile.weight}kg user), 
      "meals": { 
        "breakfast": { "name": "string", "calories": number, "protein": number, "fats": number, "carbs": number },
        "lunch": { "name": "string", "calories": number, "protein": number, "fats": number, "carbs": number },
        "dinner": { "name": "string", "calories": number, "protein": number, "fats": number, "carbs": number },
        "snack": { "name": "string", "calories": number, "protein": number, "fats": number, "carbs": number },
        "sportsNutrition": [{ "name": "string — starts with time slot e.g. [Pre-Workout] Whey Protein 30g", "calories": number, "protein": number, "fats": number, "carbs": number }]
      }, 
      "workoutTip": "string (Specific tactical advice for this workout, technique or safety)",
      "nutritionTip": "string (Specific dietary advice related to this day's meals or hydration)"
    }]
    
    IMPORTANT: 
    1. Omit "notes", "ingredients", "recipe" fields.
    2. Ensure meals strictly follow ${userProfile.dietaryPreferences}.
    3. Ensure workouts reflect ${userProfile.preferredSports.join(" and ")} where appropriate.
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
  - Sport(s): ${userProfile.preferredSports.join(', ')}
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
  - Favorite Sports: ${userProfile.preferredSports.join(", ")}
  
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
  3. If they discussed "less carbs for dinner", update the meals.dinner accordingly.
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
