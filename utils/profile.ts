import { SportPreference, UserProfile } from '../types';

export const SPORT_LIMITS = {
  timesPerWeek: { min: 1, max: 14 },
  durationMin: { min: 10, max: 240 },
} as const;

export const DEFAULT_SPORT: SportPreference = { name: '', timesPerWeek: 3, durationMin: 45 };

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
    name,
    // Every sport keeps at least one session, so nothing silently disappears.
    timesPerWeek: Math.max(1, base + (i < remainder ? 1 : 0)),
    durationMin: duration,
  }));
};
