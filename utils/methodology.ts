import { Language, UserProfile } from '../types';
import { sportNames } from './profile';

/** Broad training family, inferred from what the athlete actually does. */
export type SportFamily = 'endurance' | 'strength' | 'mixed' | 'mobility' | 'skill';

const FAMILY_KEYWORDS: Record<SportFamily, RegExp> = {
  endurance: /бег|марафон|трейл|вело|велосипед|плаван|лыж|греб|триатлон|run|jog|cycl|bike|swim|row|ski|triathlon|cardio/i,
  strength: /сил|штанг|жим|присед|тяг|пауэрлифт|бодибилд|качал|зал|гант|strength|lift|powerlift|bodybuild|gym|barbell|dumbbell/i,
  mixed: /кроссфит|гир|функционал|бокс|мма|борьб|единоборств|crossfit|kettlebell|functional|box|mma|wrestl|martial|hiit/i,
  mobility: /йог|пилат|растяж|стретч|мобильн|yoga|pilates|stretch|mobility|flexib/i,
  skill: /футбол|баскет|волейбол|теннис|хокке|скалолаз|танц|football|soccer|basket|volley|tennis|hockey|climb|dance/i,
};

/** Every family the athlete's sports touch; endurance is the safe default. */
export const sportFamilies = (profile: Pick<UserProfile, 'sports'>): SportFamily[] => {
  const names = sportNames(profile).join(' ');
  const found = (Object.keys(FAMILY_KEYWORDS) as SportFamily[])
    .filter(family => FAMILY_KEYWORDS[family].test(names));
  return found.length ? found : ['mixed'];
};

/**
 * Coaching frameworks the plan should be built on, per family and level.
 *
 * These are named methodologies, not copies: the prompt asks for their
 * principles (progression model, intensity distribution, periodisation), never
 * a reproduction of any published program's tables.
 */
const FRAMEWORKS: Record<SportFamily, Record<UserProfile['fitnessLevel'], string[]>> = {
  endurance: {
    Beginner: ['run-walk progression', 'conversational-pace base building', '10 percent weekly volume rule'],
    Amateur: ['polarised 80/20 intensity distribution', 'threshold and tempo work', 'weekly long run progression'],
    Professional: ['polarised or pyramidal periodisation', 'VO2max and threshold blocks', 'race-pace specificity with taper'],
  },
  strength: {
    Beginner: ['linear progression on compound lifts', 'technique before load', 'full-body sessions three times a week'],
    Amateur: ['daily undulating periodisation', 'upper/lower or push-pull-legs split', 'RPE-based autoregulation'],
    Professional: ['block periodisation (accumulation, transmutation, realisation)', 'percentage waves off a training max', 'max-effort and dynamic-effort work'],
  },
  mixed: {
    Beginner: ['skill practice before intensity', 'circuit work at moderate effort', 'strict movement standards'],
    Amateur: ['conjugate strength plus conditioning', 'interval work with controlled work-to-rest ratios', 'weekly movement rotation'],
    Professional: ['concurrent training with separated strength and conditioning emphasis', 'competition-format simulations', 'planned deload every fourth week'],
  },
  mobility: {
    Beginner: ['static stretching after warm-up', 'joint-by-joint mobility screen', 'short daily practice'],
    Amateur: ['loaded end-range work', 'PNF and contract-relax methods', 'progressive range targets'],
    Professional: ['periodised mobility blocks around the main sport', 'end-range strength', 'movement-specific restrictions first'],
  },
  skill: {
    Beginner: ['technical drills at low fatigue', 'general physical preparation', 'play-based conditioning'],
    Amateur: ['small-sided games for conditioning', 'strength work supporting the sport pattern', 'agility and change-of-direction drills'],
    Professional: ['sport-specific periodisation around the competition calendar', 'speed and power emphasis when fresh', 'load monitoring across the week'],
  },
};

/**
 * How full a session has to be, from its length.
 *
 * Generated days used to arrive with one or two movements, which is not a
 * session; this makes the minimum explicit so the model cannot under-deliver.
 */
export const sessionShapeForMinutes = (minutes: number): { min: number; max: number; note: string } => {
  if (minutes <= 30) return { min: 4, max: 6, note: 'short session: one main lift or effort, two accessories, brief warm-up and cool-down' };
  if (minutes <= 45) return { min: 6, max: 8, note: 'standard session: warm-up, one or two main efforts, two or three accessories, cool-down' };
  if (minutes <= 75) return { min: 7, max: 10, note: 'full session: thorough warm-up, two main efforts, three or four accessories, cool-down' };
  return { min: 8, max: 12, note: 'long session: extended warm-up, two or three main efforts, accessory block, dedicated cool-down' };
};

/** Universal, level-driven guardrails that hold whatever the sport is. */
const LEVEL_RULES: Record<UserProfile['fitnessLevel'], string> = {
  Beginner: `Level BEGINNER: 2 to 4 sessions a week, effort at RPE 5-7, never to failure. Compound movements with bodyweight or light load, full range, generous rest (90-120s). Every session names the technique cue that matters most. Add one deload or easy week every fourth week.`,
  Amateur: `Level AMATEUR: 3 to 5 sessions a week, effort at RPE 6-8, occasional top sets at RPE 9 but no grinding failure. Mix compound and accessory work, vary intensity across the week (heavy, light, medium) rather than repeating one load. Deload every fourth to sixth week.`,
  Professional: `Level PROFESSIONAL: 5 to 6+ sessions a week with clearly separated hard and easy days. Autoregulate with RPE, prescribe percentages off a training max where relevant, and build in high-intensity work only on fresh days. Planned deload every fourth week is mandatory, not optional.`,
};

/** Names of the frameworks in play, for showing in the interface. */
export const methodologyNames = (profile: UserProfile): string[] => {
  const level = profile.fitnessLevel || 'Beginner';
  return [...new Set(sportFamilies(profile).flatMap(family => FRAMEWORKS[family][level]))];
};

/**
 * Coaching brief for the plan prompt.
 *
 * Without it the model writes the same undifferentiated week for a first-timer
 * and for a competitive athlete, which is the single biggest quality gap in a
 * generated training plan.
 */
export const describeMethodologyForPrompt = (profile: UserProfile, language: Language): string => {
  const level = profile.fitnessLevel || 'Beginner';
  const families = sportFamilies(profile);
  const frameworks = methodologyNames(profile);

  // Longest session the athlete scheduled sets the shape of a training day.
  const longest = Math.max(30, ...(profile.sports || []).map(sp => Number(sp.durationMin) || 0));
  const shape = sessionShapeForMinutes(longest);

  return `
COACHING METHODOLOGY (build the week on established practice, not on generic advice):
- Training families detected from the athlete's sports: ${families.join(', ')}.
- ${LEVEL_RULES[level]}
- Apply the PRINCIPLES of these recognised frameworks: ${frameworks.join('; ')}.
- Name the principle you used in "workoutTip", in ${language === 'ru' ? 'Russian' : 'English'}, so the athlete understands why the day looks the way it does.

SESSION ANATOMY (every training day, not just some):
- Each training day carries ${shape.min} to ${shape.max} entries in "exercises". A day with one or two movements is not a session and is not acceptable.
- Sessions are ${longest} minutes, so aim for the ${shape.note}.
- Order the entries the way they are performed and tag each with "block":
  "warmup" (mobility and activation, 1-2 entries), "main" (the session's purpose, the heaviest or fastest work),
  "accessory" (supporting volume, single joint or unilateral work, weak-point work), "cooldown" (1 entry, easy movement or stretching).
- Give every entry an "intensity": RPE for strength and mixed work, percentage of a training max where the framework uses one, target pace or heart-rate zone for endurance, "easy" for warm-ups and cool-downs.
- Vary the movements across the week. Do not repeat the same exercise on consecutive training days, and do not fill a week with only the same three lifts. Rotate patterns: squat, hinge, horizontal push, vertical push, horizontal pull, vertical pull, single-leg, carry, core.
- Name real, established exercises the way a coach writes them on a whiteboard, with the equipment implied.

- Structure the week so hard days are followed by easy or rest days, and no two maximal sessions land back to back.
- Progress load only through one variable at a time: volume, intensity or density, never all three in the same week.
- Apply the principles in your own words and numbers. Do NOT reproduce any published program's tables, and do not claim the plan was written or endorsed by a named coach or brand.
`;
};

/** Short label for the interface, e.g. "Силовой, любитель". */
export const describeLevelFocus = (profile: UserProfile, language: Language): string => {
  const isRu = language === 'ru';
  const familyLabels: Record<SportFamily, { ru: string; en: string }> = {
    endurance: { ru: 'выносливость', en: 'endurance' },
    strength: { ru: 'сила', en: 'strength' },
    mixed: { ru: 'функциональный', en: 'functional' },
    mobility: { ru: 'мобильность', en: 'mobility' },
    skill: { ru: 'игровой', en: 'skill sport' },
  };
  return sportFamilies(profile)
    .map(family => (isRu ? familyLabels[family].ru : familyLabels[family].en))
    .join(', ');
};
