import { CompetitionPriority, CompetitionTarget, Language, UserProfile } from '../types';

/** Training block the athlete is in, derived from weeks left. */
export type TrainingPhase = 'off' | 'base' | 'build' | 'peak' | 'taper' | 'race' | 'past';

/** Whole days from today to the event; negative once it has passed. */
export const daysUntil = (isoDate: string): number => {
  const target = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return NaN;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
};

/**
 * Weeks left, rounded up: 8 days is still "2 weeks of training".
 * Past events round the other way, otherwise `Math.ceil(-3 / 7)` returns -0,
 * which is not less than zero and made a finished event look like race week.
 */
export const weeksUntil = (isoDate: string): number => {
  const days = daysUntil(isoDate);
  if (Number.isNaN(days)) return NaN;
  return days < 0 ? Math.floor(days / 7) : Math.ceil(days / 7);
};

export const phaseForWeeks = (weeks: number): TrainingPhase => {
  if (Number.isNaN(weeks)) return 'off';
  if (weeks < 0) return 'past';
  if (weeks === 0) return 'race';
  if (weeks === 1) return 'taper';
  if (weeks <= 3) return 'peak';
  if (weeks <= 8) return 'build';
  return 'base';
};

export const PHASE_LABELS: Record<Language, Record<TrainingPhase, string>> = {
  ru: {
    off: 'Без соревнований',
    base: 'Базовый период',
    build: 'Развивающий период',
    peak: 'Пиковый период',
    taper: 'Подводка',
    race: 'Неделя старта',
    past: 'Соревнование прошло',
  },
  en: {
    off: 'No event',
    base: 'Base phase',
    build: 'Build phase',
    peak: 'Peak phase',
    taper: 'Taper',
    race: 'Race week',
    past: 'Event has passed',
  },
};

/** Ids only need to be unique within one profile, not globally. */
export const newCompetitionId = (): string => `comp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const DEFAULT_COMPETITION: CompetitionTarget = {
  enabled: false, sport: '', date: '', goal: '', priority: 'medium',
};

const isUpcoming = (c: CompetitionTarget): boolean =>
  !!(c.enabled && c.date && !Number.isNaN(daysUntil(c.date)) && daysUntil(c.date) >= 0);

/** Enabled events that haven't happened yet, nearest first. */
export const getUpcomingCompetitions = (profile: Pick<UserProfile, 'competitions'>): CompetitionTarget[] =>
  (profile.competitions ?? []).filter(isUpcoming).sort((a, b) => daysUntil(a.date) - daysUntil(b.date));

const PRIORITY_RANK: Record<CompetitionPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * The event that gets the dedicated periodisation and taper: the highest
 * priority upcoming one, nearest date breaking a tie. Everything else is
 * still trained for (see `describeCompetitionForPrompt`), just without
 * bending the main build-up around it.
 */
export const getPrimaryCompetition = (profile: Pick<UserProfile, 'competitions'>): CompetitionTarget | undefined => {
  const upcoming = getUpcomingCompetitions(profile);
  if (!upcoming.length) return undefined;
  return [...upcoming].sort((a, b) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || daysUntil(a.date) - daysUntil(b.date)
  )[0];
};

/** The furthest-out upcoming event; the training block runs through its date. */
export const getFurthestCompetition = (profile: Pick<UserProfile, 'competitions'>): CompetitionTarget | undefined => {
  const upcoming = getUpcomingCompetitions(profile);
  return upcoming[upcoming.length - 1];
};

export const hasActiveCompetition = (profile: Pick<UserProfile, 'competitions'>): boolean =>
  !!getPrimaryCompetition(profile);

export const normalizeCompetition = (raw: any): CompetitionTarget => ({
  id: typeof raw?.id === 'string' && raw.id ? raw.id : newCompetitionId(),
  enabled: !!raw?.enabled,
  sport: String(raw?.sport ?? '').trim(),
  date: /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.date ?? '')) ? raw.date : '',
  goal: String(raw?.goal ?? '').trim(),
  priority: (['high', 'medium', 'low'] as CompetitionPriority[]).includes(raw?.priority) ? raw.priority : 'medium',
});

/**
 * Handles the current shape, the pre-list single `competition` field, and
 * profiles with neither.
 */
export const normalizeCompetitions = (raw: any): CompetitionTarget[] => {
  if (Array.isArray(raw?.competitions)) return raw.competitions.map(normalizeCompetition);
  if (raw?.competition && typeof raw.competition === 'object') return [normalizeCompetition(raw.competition)];
  return [];
};

/**
 * Periodisation brief for the plan prompt.
 *
 * Without it the model writes the same generic week whether the event is three
 * months out or on Saturday, which is exactly backwards for an athlete.
 */
export const describeCompetitionForPrompt = (profile: UserProfile, language: Language): string => {
  const c = getPrimaryCompetition(profile);
  if (!c) return '';

  const weeks = weeksUntil(c.date);
  const days = daysUntil(c.date);
  if (Number.isNaN(weeks) || days < 0) return '';

  const phase = phaseForWeeks(weeks);

  const plans: Record<TrainingPhase, string> = {
    base: `BASE PHASE. Build general capacity: higher volume at moderate intensity, technique work, strength foundation, and one longer session a week. Keep at least one full rest day.`,
    build: `BUILD PHASE. Shift toward event-specific work: introduce race-pace or competition-intensity efforts twice a week, keep volume high but recoverable, and add one weekly session that rehearses competition conditions.`,
    peak: `PEAK PHASE. Intensity is the priority, volume comes down about 20 percent. Sessions must look like the event itself. No new movements or new equipment from now on.`,
    taper: `TAPER WEEK. Cut volume 40 to 50 percent while keeping short bursts of competition intensity so sharpness stays. Prioritise sleep and recovery. No maximal or unfamiliar work.`,
    race: `RACE WEEK. Only light activation sessions and mobility. The plan must protect freshness, not build fitness. Nutrition focuses on familiar, well tolerated food and hydration; never introduce new foods or supplements this week.`,
    off: '',
    past: '',
  };

  const others = getUpcomingCompetitions(profile).filter(o => o !== c);
  const secondary = others.length ? `
ALSO TRAINING FOR (none of these get a dedicated taper — only the target above does; keep proportional touches of event-specific work for them instead, more for "high" priority, a light touch for "low", even one that falls chronologically before or after the target):
${others.map(o => `- ${o.sport || 'event'}, in ${weeksUntil(o.date)} week(s), priority ${o.priority}: ${o.goal || 'finish and perform well'}`).join('\n')}
` : '';

  return `
COMPETITION TARGET (this is the whole point of the plan):
- Event sport / discipline: ${c.sport || profile.sports?.[0]?.name || 'not specified'}
- Date: ${c.date} (${days} days away, about ${weeks} week(s))
- Athlete's stated goal: ${c.goal || 'finish and perform well'}

${plans[phase]}
${secondary}
COMPETITION RULES:
- Every week you generate must fit the phase above and move the athlete toward that stated goal. Say in workoutTip how the day serves the event.
- Respect the sports schedule the athlete set; the event discipline gets priority when time is short.
- SAFETY: never prescribe dehydration, sauna cuts, fasting or rapid weight loss to make a weight class, and never advise more than a moderate deficit. If the goal implies a weight class, say plainly that weight management for competition should be supervised by a coach or a sports physician.
- Do not promise results or guarantee a placing.
`;
};

/** One-line summary for the interface, e.g. "Марафон: через 6 нед. (+1 старт)" */
export const describeCompetition = (profile: UserProfile, language: Language): string => {
  const isRu = language === 'ru';
  const c = getPrimaryCompetition(profile);
  if (!c) return '';
  const weeks = weeksUntil(c.date);
  if (Number.isNaN(weeks)) return '';
  const sport = c.sport || profile.sports?.[0]?.name || (isRu ? 'старт' : 'event');
  const extra = getUpcomingCompetitions(profile).length - 1;
  const suffix = extra > 0 ? (isRu ? ` (+${extra} старт${extra > 1 ? 'а' : ''})` : ` (+${extra} more)`) : '';
  if (weeks === 0) return isRu ? `${sport}: на этой неделе${suffix}` : `${sport}: this week${suffix}`;
  return isRu ? `${sport}: через ${weeks} нед.${suffix}` : `${sport}: in ${weeks} week(s)${suffix}`;
};
