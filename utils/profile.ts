import { Language, SportPreference, UserProfile } from '../types';

export const SPORT_LIMITS = {
  timesPerWeek: { min: 1, max: 14 },
  durationMin: { min: 10, max: 240 },
} as const;

/** Ids only need to be unique within one profile, not globally. */
export const newSportId = (): string => `sport-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const DEFAULT_SPORT: Omit<SportPreference, 'id'> = { name: '', timesPerWeek: 3, durationMin: 45 };

/** Total sessions a week across every sport. */
export const totalWorkoutsPerWeek = (profile: Pick<UserProfile, 'sports'>): number =>
  (profile.sports || []).reduce((sum, sport) => sum + (Number(sport.timesPerWeek) || 0), 0);

/** Total training minutes a week, useful for load warnings. */
export const totalMinutesPerWeek = (profile: Pick<UserProfile, 'sports'>): number =>
  (profile.sports || []).reduce(
    (sum, sport) => sum + (Number(sport.timesPerWeek) || 0) * (Number(sport.durationMin) || 0), 0);

/** Just the names, for prompts and summaries. */
export const sportNames = (profile: Pick<UserProfile, 'sports'>): string[] =>
  (profile.sports || []).map(sport => sport.name.trim()).filter(Boolean);

/** "Running 3x40 min, Swimming 2x60 min" — the schedule the AI must respect. */
export const describeSports = (profile: Pick<UserProfile, 'sports'>): string =>
  (profile.sports || [])
    .filter(sport => sport.name.trim())
    .map(sport => `${sport.name.trim()} ${sport.timesPerWeek}x${sport.durationMin} min`)
    .join(', ');

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number(value) || min)));

export const normalizeSport = (raw: any): SportPreference => ({
  id: typeof raw?.id === 'string' && raw.id ? raw.id : newSportId(),
  name: String(raw?.name ?? '').trim(),
  timesPerWeek: clamp(raw?.timesPerWeek, SPORT_LIMITS.timesPerWeek.min, SPORT_LIMITS.timesPerWeek.max),
  durationMin: clamp(raw?.durationMin, SPORT_LIMITS.durationMin.min, SPORT_LIMITS.durationMin.max),
});

/**
 * Reads the sport list from any profile we have ever stored.
 *
 * Profiles saved before per-sport scheduling carry `preferredSports: string[]`
 * with one global frequency and duration. Those sessions are spread as evenly
 * as possible over the sports so the weekly total stays what the user chose.
 */
export const normalizeSports = (raw: any): SportPreference[] => {
  if (Array.isArray(raw?.sports)) {
    return raw.sports.map(normalizeSport).filter((sport: SportPreference) => sport.name);
  }

  const names: string[] = Array.isArray(raw?.preferredSports)
    ? raw.preferredSports.map((n: any) => String(n).trim()).filter(Boolean)
    : [];
  if (!names.length) return [];

  const total = clamp(raw?.workoutsPerWeek ?? 3, SPORT_LIMITS.timesPerWeek.min, SPORT_LIMITS.timesPerWeek.max);
  const duration = clamp(raw?.workoutDurationMin ?? 45, SPORT_LIMITS.durationMin.min, SPORT_LIMITS.durationMin.max);

  const base = Math.floor(total / names.length);
  const remainder = total % names.length;

  return names.map((name, i) => ({
    id: newSportId(),
    name,
    // Every sport keeps at least one session, so nothing silently disappears.
    timesPerWeek: Math.max(1, base + (i < remainder ? 1 : 0)),
    durationMin: duration,
  }));
};

/**
 * Stored goal values are the English keys the profile form saves ("Muscle
 * Gain"); the words a user should read live in the translations. Unknown
 * values (older builds, hand edits) fall through unchanged.
 */
const GOAL_LABELS: Record<string, Record<Language, string>> = {
  'Strength': { en: 'Strength', ru: 'Сила' },
  'Endurance': { en: 'Endurance', ru: 'Выносливость' },
  'Flexibility': { en: 'Flexibility', ru: 'Гибкость' },
  'Speed': { en: 'Speed', ru: 'Скорость' },
  'Stress Relief': { en: 'Stress Relief', ru: 'Снятие стресса' },
  'General Health': { en: 'General Health', ru: 'Здоровье' },
  'Muscle Gain': { en: 'Muscle Gain', ru: 'Набор массы' },
  'Lose Weight': { en: 'Weight Loss', ru: 'Похудение' },
};

export const describeGoals = (goals: string[], language: Language): string =>
  (goals || []).map(g => GOAL_LABELS[g]?.[language] ?? g).join(', ');
