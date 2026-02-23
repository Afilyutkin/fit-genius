import { UserProfile, ChatMessage, DayPlan, MealDetails, ExerciseDetail } from "../types";

export const SYSTEM_INSTRUCTION_BASE = `
You are Fit Genius AI, a world-class empathetic and motivating fitness & health coach.
Your goal is to help the user achieve their fitness goals while strictly adhering to their safety constraints and religious dietary restrictions if any.

COMMUNICATION STYLE:
- Use clear Markdown formatting with headers (###), bold text (**), and lists (-).
- CRITICAL: NEVER output raw JSON blocks or technical data structures in the chat.
- If you discuss plan changes, describe them in plain text. A separate system handles technical synchronization.
- Keep responses concise, encouraging, and actionable.
`;

// Ordered by preference — newest/fastest first
const MODEL_PREFERENCES = [
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-flash',
  'gemini-2.5-pro-preview-05-06',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro',
];

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

const geminiRest = async (
  apiKey: string,
  systemInstruction: string,
  contents: any[],
  responseMimeType: string = "text/plain"
): Promise<string> => {
  const model = await resolveModel(apiKey);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body: any = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    }
  };

  if (responseMimeType === "application/json") {
    body.generationConfig.responseMimeType = "application/json";
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || JSON.stringify(data));
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
    }
    repaired += char;
  }

  if (inQuote) repaired += '"';
  while (openBraces > 0) {
    if (repaired.trim().endsWith(':')) repaired += 'null';
    repaired = repaired.replace(/,\s*$/, '');
    repaired += '}';
    openBraces--;
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
  try {
    const contents = [
      ...history.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] })),
      { role: 'user', parts: [{ text: userMessage }] }
    ];
    return await geminiRest(key, systemInstruction, contents);
  } catch (error: any) {
    return language === 'ru' ? `Ошибка: ${error.message}` : `Error: ${error.message}`;
  }
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
        "sportsNutrition": { "name": "string", "calories": number, "protein": number, "fats": number, "carbs": number }
      }, 
      "workoutTip": "string (Specific tactical advice for this workout, technique or safety)",
      "nutritionTip": "string (Specific dietary advice related to this day's meals or hydration)"
    }]
    
    IMPORTANT: 
    1. Omit "notes", "ingredients", "recipe" fields.
    2. Ensure meals strictly follow ${userProfile.dietaryPreferences}.
    3. Ensure workouts reflect ${userProfile.preferredSports.join(" and ")} where appropriate.
    4. Respect health constraints: ${userProfile.contraindications || "None"}.
  `;
  try {
    const text = await geminiRest(key, systemInstruction, [{ role: 'user', parts: [{ text: prompt }] }], "application/json");
    const parsed = JSON.parse(repairJson(text));
    const data = Array.isArray(parsed) ? parsed : (parsed.plan || parsed.days || parsed.weeklyPlan || []);
    return data as DayPlan[];
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
    return JSON.parse(repairJson(text));
  } catch (e) {
    console.error('[generateMealDetails] error:', e);
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
    // Normalize response keys
    return {
      notes: parsed.notes || parsed.instructions || parsed.note || parsed.instruction || parsed.text || ""
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
  try {
    return await geminiRest(key, systemInstruction, [{ role: 'user', parts: [{ text: question }] }]);
  } catch (e: any) {
    return `❌ Error: ${e.message}`;
  }
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
    const data = Array.isArray(parsed) ? parsed : (parsed.plan || parsed.days || parsed.weeklyPlan || []);
    return data as DayPlan[];
  } catch (e: any) {
    console.error('[refinePlanWithConsultation] error:', e);
    throw e;
  }
};
