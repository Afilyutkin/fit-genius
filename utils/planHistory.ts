import { UserProfile, WeekRecord, Language } from '../types';
import { describeSports } from './profile';

export const PLAN_HISTORY_KEY = 'zenith_plan_history';

/** Weeks kept on the device. Older ones stop being useful for progression. */
const MAX_WEEKS = 12;

/** Weeks handed to the model. Enough for a trend, small enough for the prompt. */
const WEEKS_IN_PROMPT = 3;

export const loadPlanHistory = (): WeekRecord[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAN_HISTORY_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(w => w && typeof w === 'object') : [];
  } catch {
    return [];
  }
};

const savePlanHistory = (weeks: WeekRecord[]) => {
  try {
    localStorage.setItem(PLAN_HISTORY_KEY, JSON.stringify(weeks.slice(-MAX_WEEKS)));
  } catch {
    /* storage full or blocked: history is a nicety, never block plan generation */
  }
};

export const clearPlanHistory = () => {
  try { localStorage.removeItem(PLAN_HISTORY_KEY); } catch { /* ignore */ }
};

/**
 * Files the plan the user is about to replace.
 *
 * Called right before a new plan is generated: at that moment `completedExercises`
 * still holds what actually got done, which is the only signal we have about how
 * the week really went.
 */
export const archiveFinishedWeek = (profile: UserProfile): WeekRecord | null => {
  const plan = profile.weeklyPlan;
  if (!plan?.length) return null;

  const done = new Set(profile.completedExercises || []);
  let totalExercises = 0;
  let completedExercises = 0;
  const skipped: string[] = [];
  const trained: string[] = [];

  plan.forEach((day, dayIndex) => {
    (day.exercises || []).forEach((exercise, exerciseIndex) => {
      totalExercises += 1;
      const wasDone = done.has(`${dayIndex}-${exerciseIndex}`);
      if (wasDone) {
        completedExercises += 1;
        trained.push(`${exercise.name} ${exercise.sets}x${exercise.reps}`);
      } else {
        skipped.push(exercise.name);
      }
    });
  });

  if (totalExercises === 0) return null;

  const record: WeekRecord = {
    startedAt: profile.planCreatedAt || new Date().toISOString(),
    archivedAt: new Date().toISOString(),
    completionPercent: Math.round((completedExercises / totalExercises) * 100),
    totalExercises,
    completedExercises,
    weightKg: profile.weight,
    mealsPerDay: profile.mealsPerDay,
    sports: describeSports(profile),
    // Dedupe: the same movement repeats across the week and adds nothing.
    trainedExercises: [...new Set(trained)].slice(0, 24),
    skippedExercises: [...new Set(skipped)].slice(0, 12),
  };

  savePlanHistory([...loadPlanHistory(), record]);
  return record;
};

/**
 * Compact digest of past weeks for the plan prompt. Returns an empty string for
 * a first-time user so the instruction stays clean.
 */
export const summarizeHistoryForPrompt = (language: Language = 'en'): string => {
  const weeks = loadPlanHistory().slice(-WEEKS_IN_PROMPT);
  if (!weeks.length) return '';

  const lines = weeks.map((w, i) => {
    const number = weeks.length - i;
    const when = (w.archivedAt || '').slice(0, 10);
    const parts = [
      `Week -${number} (finished ${when}): completed ${w.completedExercises}/${w.totalExercises} exercises (${w.completionPercent}%)`,
      `body weight ${w.weightKg}kg`,
      `${w.mealsPerDay} meals/day`,
      `sports: ${w.sports || 'not set'}`,
    ];
    if (w.trainedExercises?.length) parts.push(`completed movements: ${w.trainedExercises.join('; ')}`);
    if (w.skippedExercises?.length) parts.push(`skipped: ${w.skippedExercises.join('; ')}`);
    return `- ${parts.join('. ')}`;
  });

  return `
TRAINING HISTORY (most recent last). Use it to progress the plan, do not restart from zero:
${lines.join('\n')}

PROGRESSION RULES:
- If the last week was completed at 80% or more, increase the load slightly: add a set, add reps, add weight, or extend the hardest session. Never jump more than about 10% per week.
- If it was completed between 40% and 79%, keep roughly the same load and improve adherence: shorter sessions, simpler movements.
- If it was under 40%, reduce the volume and make the week easier to finish.
- Movements listed as skipped repeatedly: replace them with an alternative that trains the same pattern, and say why in workoutTip.
- Keep the movements the user completed, so progress stays measurable; vary the meals instead of repeating last week's menu.
- Language of the response stays ${language === 'ru' ? 'Russian' : 'English'}.
`;
};
