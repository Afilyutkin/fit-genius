import { DayPlan, Language, ProgramWeek, TrainingProgram, UserProfile } from '../types';
import { daysUntil, getPrimaryCompetition, phaseForWeeks, PHASE_LABELS } from './competition';
import { describeGoals } from './profile';

export const PROGRAM_KEY = 'zenith_program';

/** Without an event the block is two months long. */
export const DEFAULT_PROGRAM_WEEKS = 8;
const MIN_WEEKS = 2;
const MAX_WEEKS = 16;

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Monday of the week containing `d`, at local midnight. */
export const mondayOf = (d: Date): Date => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const shift = (out.getDay() + 6) % 7; // Sunday is 0 in JS, so 6 here
  out.setDate(out.getDate() - shift);
  return out;
};

const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS);

export const loadProgram = (): TrainingProgram | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRAM_KEY) || 'null');
    return raw && typeof raw === 'object' && Array.isArray(raw.weeks) ? raw : null;
  } catch {
    return null;
  }
};

export const saveProgram = (program: TrainingProgram | null) => {
  try {
    if (program) localStorage.setItem(PROGRAM_KEY, JSON.stringify(program));
    else localStorage.removeItem(PROGRAM_KEY);
  } catch {
    /* storage full or blocked: the weekly plan still works without the programme */
  }
};

/** How many weeks the block should run for this profile. */
export const programLengthFor = (profile: UserProfile): { weeks: number; endDate: string; forCompetition: boolean } => {
  const start = mondayOf(new Date());
  const primary = getPrimaryCompetition(profile);
  if (primary) {
    const days = daysUntil(primary.date);
    // Count whole weeks from this Monday up to and including race week.
    const weeks = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.ceil((days + ((new Date().getDay() + 6) % 7) + 1) / 7)));
    return { weeks, endDate: primary.date, forCompetition: true };
  }
  return { weeks: DEFAULT_PROGRAM_WEEKS, endDate: isoDate(addDays(start, DEFAULT_PROGRAM_WEEKS * 7 - 1)), forCompetition: false };
};

/**
 * Dates and phases are decided here, not by the model: they are arithmetic,
 * and a model that "thinks" race week is in four weeks when it is in two
 * would wreck the taper. The model only writes the words for each week.
 */
export const buildProgramSkeleton = (profile: UserProfile, language: Language): TrainingProgram => {
  const { weeks, endDate, forCompetition } = programLengthFor(profile);
  const start = mondayOf(new Date());
  const list: ProgramWeek[] = Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(start, i * 7);
    const weeksLeft = forCompetition ? weeks - 1 - i : NaN;
    const phase = forCompetition ? phaseForWeeks(weeksLeft) : 'off';
    return {
      index: i + 1,
      startDate: isoDate(weekStart),
      phase: phase === 'past' ? 'race' : phase,
      focus: '',
      trainingTarget: '',
      nutritionTarget: '',
      keySessions: [],
    };
  });

  const primary = getPrimaryCompetition(profile);
  const goal = forCompetition && primary
    ? [primary.sport, primary.goal].filter(Boolean).join(': ')
    : describeGoals(profile.fitnessGoals, language);

  return {
    createdAt: new Date().toISOString(),
    startDate: isoDate(start),
    endDate,
    goal,
    forCompetition,
    language,
    weeks: list,
  };
};

/**
 * The goal as the user should read it. Programmes saved before goals were
 * localised hold the raw English keys ("Strength, Muscle Gain"), so the
 * translation is applied on the way out too; a competition goal is the
 * athlete's own words and passes through untouched.
 */
export const programGoalLabel = (program: Pick<TrainingProgram, 'goal' | 'forCompetition'>, language: Language): string =>
  program.forCompetition ? program.goal : describeGoals(program.goal.split(', ').filter(Boolean), language);

/** Without an event the block runs in cycles of three loading weeks and a deload. */
export const isDeloadWeek = (week: ProgramWeek, program: Pick<TrainingProgram, 'forCompetition'>): boolean =>
  !program.forCompetition && week.index % 4 === 0;

/**
 * What a week's card says. Competition weeks carry their phase; without an
 * event the phase is "off", which is not a label anyone can train to, so the
 * card names the week's place in the loading cycle instead.
 */
export const weekLabel = (week: ProgramWeek, program: Pick<TrainingProgram, 'forCompetition'>, language: Language): string => {
  if (program.forCompetition || week.phase !== 'off') return PHASE_LABELS[language][week.phase];
  if (isDeloadWeek(week, program)) return language === 'ru' ? 'Разгрузка' : 'Deload';
  const n = ((week.index - 1) % 4) + 1;
  return language === 'ru' ? `Нагрузка ${n}` : `Loading ${n}`;
};

/**
 * Words for the skeleton when the model is unavailable, so the programme still
 * exists and the timeline still reads sensibly. Generic on purpose.
 */
export const fillOutlineLocally = (program: TrainingProgram): TrainingProgram => {
  const ru = program.language === 'ru';
  const text: Record<ProgramWeek['phase'], { focus: string; training: string; nutrition: string; key: string[] }> = ru ? {
    base: { focus: 'База: объём и техника', training: 'Умеренная интенсивность, RPE 5-7, объём растёт не больше чем на 10% в неделю', nutrition: 'Поддержание, белок 1.6-2 г/кг', key: ['Длинная лёгкая сессия', 'Техническая работа'] },
    build: { focus: 'Развитие: специфичная нагрузка', training: 'Ключевые сессии на RPE 7-8, остальное легко', nutrition: 'Углеводы вокруг тяжёлых дней, белок 1.8-2 г/кг', key: ['Интервалы или тяжёлые подходы', 'Длинная сессия', 'Восстановительная'] },
    peak: { focus: 'Пик: качество, а не объём', training: 'Объём минус 20-30%, интенсивность соревновательная', nutrition: 'Полноценное питание, без дефицита', key: ['Соревновательная симуляция', 'Короткие острые интервалы'] },
    taper: { focus: 'Подводка: свежесть к старту', training: 'Объём минус 40-50%, короткие бодрящие сессии', nutrition: 'Углеводы вверх за 2-3 дня до старта, знакомая еда', key: ['Короткая открывающая сессия', 'Полный отдых накануне'] },
    race: { focus: 'Неделя старта', training: 'Только лёгкая активация, ничего нового', nutrition: 'Ничего нового, вода и соль по погоде', key: ['Старт'] },
    off: { focus: 'Прогресс по циклу', training: 'Три недели нагрузки, четвёртая разгрузочная', nutrition: 'Под цели профиля', key: ['Основная силовая или ключевая сессия', 'Лёгкая аэробная'] },
  } : {
    base: { focus: 'Base: volume and technique', training: 'Moderate intensity, RPE 5-7, volume up by at most 10% a week', nutrition: 'Maintenance, protein 1.6-2 g/kg', key: ['Long easy session', 'Technique work'] },
    build: { focus: 'Build: specific load', training: 'Key sessions at RPE 7-8, everything else easy', nutrition: 'Carbs around hard days, protein 1.8-2 g/kg', key: ['Intervals or heavy sets', 'Long session', 'Recovery session'] },
    peak: { focus: 'Peak: quality over volume', training: 'Volume down 20-30%, race-pace intensity', nutrition: 'Full fuelling, no deficit', key: ['Race simulation', 'Short sharp intervals'] },
    taper: { focus: 'Taper: fresh for race day', training: 'Volume down 40-50%, short sharpening sessions', nutrition: 'Carbs up 2-3 days out, familiar food only', key: ['Short opener', 'Full rest the day before'] },
    race: { focus: 'Race week', training: 'Light activation only, nothing new', nutrition: 'Nothing new, water and salt to the weather', key: ['Race'] },
    off: { focus: 'Progress through the cycle', training: 'Three loading weeks, the fourth a deload', nutrition: 'To the profile goals', key: ['Main strength or key session', 'Easy aerobic'] },
  };

  const weeks = program.weeks.map(w => {
    if (w.focus) return w;
    const t = text[w.phase];
    // Without an event, every fourth week is the deload.
    const deload = isDeloadWeek(w, program);
    return {
      ...w,
      focus: deload ? (ru ? 'Разгрузочная неделя' : 'Deload week') : t.focus,
      trainingTarget: deload ? (ru ? 'Объём минус 40%, интенсивность лёгкая' : 'Volume down 40%, easy intensity') : t.training,
      nutritionTarget: t.nutrition,
      keySessions: t.key,
    };
  });
  return { ...program, weeks };
};

/** 1-based week the calendar says we are in; clamped to the programme. */
export const currentWeekIndex = (program: TrainingProgram): number => {
  const start = new Date(`${program.startDate}T00:00:00`);
  const today = mondayOf(new Date());
  const diff = Math.round((today.getTime() - start.getTime()) / (7 * DAY_MS));
  return Math.min(program.weeks.length, Math.max(1, diff + 1));
};

/** The programme has to be rebuilt when the event it targets changed or it ran out. */
export const programIsStale = (program: TrainingProgram | null, profile: UserProfile): boolean => {
  if (!program) return true;
  const { endDate, forCompetition } = programLengthFor(profile);
  if (program.forCompetition !== forCompetition) return true;
  if (forCompetition && program.endDate !== endDate) return true;
  const last = program.weeks[program.weeks.length - 1];
  const lastEnd = addDays(new Date(`${last.startDate}T00:00:00`), 6);
  return lastEnd.getTime() < mondayOf(new Date()).getTime();
};

/** Store the detailed plan on the calendar week it belongs to. */
export const attachPlanToCurrentWeek = (plan: DayPlan[]): void => {
  const program = loadProgram();
  if (!program) return;
  const idx = currentWeekIndex(program);
  const weeks = program.weeks.map(w => (w.index === idx ? { ...w, plan } : w));
  saveProgram({ ...program, weeks });
};

/** Record how a week went, found by the date the plan was created on. */
export const recordWeekOutcome = (planCreatedAt: string | undefined, completionPercent: number, weightKg: number): void => {
  const program = loadProgram();
  if (!program) return;
  const created = planCreatedAt ? mondayOf(new Date(planCreatedAt)) : mondayOf(new Date());
  const startIso = isoDate(created);
  const weeks = program.weeks.map(w => (w.startDate === startIso ? { ...w, completionPercent, weightKg } : w));
  saveProgram({ ...program, weeks });
};

/**
 * Brief for the weekly plan prompt: where this week sits in the block and what
 * it is for. Turns "a week of training" into "week 5 of 10, build phase".
 */
export const describeProgramForPrompt = (program: TrainingProgram | null, language: Language): string => {
  if (!program) return '';
  const idx = currentWeekIndex(program);
  const week = program.weeks[idx - 1];
  if (!week) return '';
  const label = (w: ProgramWeek) => weekLabel(w, program, language);
  const prev = program.weeks[idx - 2];
  const next = program.weeks[idx];
  const lines = [
    `Programme goal: ${program.goal || 'general fitness'}. Block of ${program.weeks.length} weeks, ${program.startDate} to ${program.endDate}.`,
    `THIS WEEK IS WEEK ${idx} OF ${program.weeks.length}: phase "${label(week)}". Focus: ${week.focus}.`,
    `Training target: ${week.trainingTarget}.`,
    `Nutrition target: ${week.nutritionTarget}.`,
    week.keySessions.length ? `Key sessions the week must contain: ${week.keySessions.join('; ')}.` : '',
    prev?.completionPercent !== undefined ? `Previous week (${label(prev)}) was completed at ${prev.completionPercent}%.` : '',
    next ? `Next week will be "${label(next)}": ${next.focus}. Do not front-load its work into this week.` : '',
  ].filter(Boolean);
  return `\nPROGRAMME CONTEXT:\n${lines.map(l => `- ${l}`).join('\n')}\n`;
};

export const clearProgram = () => saveProgram(null);
