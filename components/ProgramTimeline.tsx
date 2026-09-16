import React, { useState } from 'react';
import { CalendarRange, Check, Flag, ChevronRight, Dumbbell, Utensils } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Language, ProgramWeek, TrainingProgram } from '../types';
import { PHASE_LABELS } from '../utils/competition';
import { currentWeekIndex } from '../utils/program';
import { shortDayLabel } from '../utils/days';
import { pluralRu } from '../utils/plural';

interface Props {
  program: TrainingProgram;
  language: Language;
  /** Which side of the plan leads: sessions on the Workouts tab, meals on Nutrition. */
  mode?: 'training' | 'nutrition';
}

/** Average planned kcal per day of a saved week, for the nutrition strip. */
const avgCalories = (week: ProgramWeek): number | null => {
  const days = (week.plan ?? []).filter(d => typeof d.totalCalories === 'number' && d.totalCalories > 0);
  if (!days.length) return null;
  return Math.round(days.reduce((sum, d) => sum + d.totalCalories, 0) / days.length);
};

const fmtDay = (d: Date, language: Language) =>
  d.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' });

const fmtDate = (iso: string, language: Language) => fmtDay(new Date(`${iso}T00:00:00`), language);

// Local date arithmetic only: toISOString() would shift a local midnight to
// the previous day anywhere east of Greenwich.
const weekRange = (w: ProgramWeek, language: Language) => {
  const end = new Date(`${w.startDate}T00:00:00`);
  end.setDate(end.getDate() + 6);
  return `${fmtDate(w.startDate, language)} - ${fmtDay(end, language)}`;
};

/**
 * The whole block at a glance: every week from today to the event (or eight
 * weeks out), with its phase, and what actually happened in the ones that are
 * over. Past weeks keep their full plan, so this doubles as the history.
 */
const ProgramTimeline: React.FC<Props> = ({ program, language, mode = 'training' }) => {
  const nutrition = mode === 'nutrition';
  const isRu = language === 'ru';
  const reduce = useReducedMotion();
  const current = currentWeekIndex(program);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const labels = PHASE_LABELS[language];
  const open = openIndex ? program.weeks[openIndex - 1] : null;

  const status = (w: ProgramWeek): 'done' | 'current' | 'upcoming' =>
    w.index < current ? 'done' : w.index === current ? 'current' : 'upcoming';

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
        <div>
          <p className="eyebrow">{nutrition ? (isRu ? 'Питание по программе' : 'Nutrition programme') : (isRu ? 'Программа' : 'Programme')}</p>
          <h2 className="font-display text-xl sm:text-2xl font-semibold uppercase text-slate-900 dark:text-white mt-1">
            {program.forCompetition
              ? (isRu ? `${program.weeks.length} нед. до старта` : `${program.weeks.length} weeks to race day`)
              : (isRu ? `${program.weeks.length} недель прогресса` : `${program.weeks.length}-week block`)}
          </h2>
          {program.goal && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{program.goal}</p>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums flex items-center gap-1.5">
          <CalendarRange size={13} />
          {fmtDate(program.startDate, language)} - {fmtDate(program.endDate, language)}
        </p>
      </div>

      {/* Week strip */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1" role="list">
        {program.weeks.map(w => {
          const st = status(w);
          const isOpen = openIndex === w.index;
          return (
            <button
              key={w.index}
              role="listitem"
              onClick={() => setOpenIndex(isOpen ? null : w.index)}
              aria-expanded={isOpen}
              className={`shrink-0 w-[96px] rounded-[var(--radius-control)] p-2.5 text-left border transition-colors
                ${st === 'current'
                  ? 'bg-brand-300 border-brand-300 text-slate-950'
                  : st === 'done'
                    ? 'surface-muted border-transparent text-slate-700 dark:text-slate-300'
                    : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}
                ${isOpen ? 'ring-2 ring-brand-400/60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="stat text-lg leading-none">{w.index}</span>
                {st === 'done' && (
                  <span className="w-5 h-5 rounded-full bg-brand-400/20 text-brand-700 dark:text-brand-300 flex items-center justify-center">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
                {w.phase === 'race' && <Flag size={12} className={st === 'current' ? 'text-slate-950' : 'text-flame-500'} />}
              </div>
              <p className={`text-[10px] uppercase tracking-wide mt-2 leading-tight ${st === 'current' ? 'text-slate-950/70' : 'opacity-70'}`}>
                {labels[w.phase]}
              </p>
              {nutrition
                ? (avgCalories(w) !== null && st !== 'upcoming' && (
                    <p className="stat text-xs mt-1">{avgCalories(w)} <span className="font-sans font-normal opacity-70">{isRu ? 'ккал' : 'kcal'}</span></p>
                  ))
                : (st === 'done' && w.completionPercent !== undefined && (
                    <p className="stat text-xs mt-1">{w.completionPercent}%</p>
                  ))}
              {st === 'upcoming' && (
                <p className="text-[10px] mt-1 opacity-60">{fmtDate(w.startDate, language)}</p>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={open.index}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : {
              height: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.18 },
            }}
            className="overflow-hidden"
          >
            <WeekDetail week={open} status={status(open)} language={language} nutrition={nutrition} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const WeekDetail: React.FC<{ week: ProgramWeek; status: 'done' | 'current' | 'upcoming'; language: Language; nutrition: boolean }> = ({ week, status, language, nutrition }) => {
  const isRu = language === 'ru';
  const labels = PHASE_LABELS[language];
  const [openDay, setOpenDay] = useState<number | null>(null);

  return (
    <div className="mt-4 surface-muted rounded-[var(--radius-card)] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-lg font-semibold uppercase text-slate-900 dark:text-white">
          {isRu ? 'Неделя' : 'Week'} {week.index} · {labels[week.phase]}
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{weekRange(week, language)}</span>
      </div>

      <p className="mt-2 font-medium text-slate-900 dark:text-white">{week.focus}</p>
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className={nutrition ? 'order-last' : ''}>
          <dt className="eyebrow flex items-center gap-1.5"><Dumbbell size={11} />{isRu ? 'Нагрузка' : 'Training'}</dt>
          <dd className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{week.trainingTarget}</dd>
        </div>
        <div>
          <dt className="eyebrow flex items-center gap-1.5"><Utensils size={11} />{isRu ? 'Питание' : 'Nutrition'}</dt>
          <dd className={`mt-1 leading-relaxed ${nutrition ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-700 dark:text-slate-300'}`}>{week.nutritionTarget}</dd>
        </div>
      </dl>
      {week.keySessions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {week.keySessions.map(k => (
            <span key={k} className="chip bg-brand-300/15 border-brand-500/30 text-brand-800 dark:text-brand-300">{k}</span>
          ))}
        </div>
      )}

      {/* The saved plan: what the week was, day by day */}
      {week.plan?.length ? (
        <div className="mt-4">
          <p className="eyebrow mb-2">
            {status === 'done'
              ? (isRu ? 'Как прошла неделя' : 'How the week went')
              : status === 'current'
                ? (isRu ? 'План этой недели' : 'This week\'s plan')
                : (isRu ? 'План' : 'Plan')}
            {week.completionPercent !== undefined && ` · ${week.completionPercent}%`}
            {week.weightKg ? ` · ${week.weightKg} ${isRu ? 'кг' : 'kg'}` : ''}
          </p>
          <ul className="divide-y divide-slate-200/70 dark:divide-slate-800">
            {week.plan.map((day, i) => {
              const isOpen = openDay === i;
              const count = day.exercises?.length ?? 0;
              const mealCount = day.meals?.items?.length ?? 0;
              return (
                <li key={i}>
                  <button
                    onClick={() => setOpenDay(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-3 py-2.5 text-left"
                  >
                    <span className="stat text-sm w-8 text-slate-500 dark:text-slate-400">{shortDayLabel(i, language)}</span>
                    <span className="flex-1 min-w-0 truncate text-sm text-slate-900 dark:text-white">
                      {nutrition
                        ? `${day.totalCalories} ${isRu ? 'ккал' : 'kcal'}${mealCount ? ` · ${mealCount} ${isRu ? pluralRu(mealCount, 'приём', 'приёма', 'приёмов') : (mealCount === 1 ? 'meal' : 'meals')}` : ''}`
                        : (count ? day.workoutTitle : (isRu ? 'Отдых' : 'Rest'))}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                      {nutrition
                        ? (count ? day.workoutTitle : (isRu ? 'Отдых' : 'Rest'))
                        : `${count ? `${count} ${isRu ? 'упр.' : 'ex.'} · ` : ''}${day.totalCalories} ${isRu ? 'ккал' : 'kcal'}`}
                    </span>
                    <ChevronRight size={14} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="pb-3 pl-11 text-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className={nutrition ? 'order-last' : ''}>
                        <p className="eyebrow mb-1">{isRu ? 'Тренировка' : 'Workout'}</p>
                        {count ? (
                          <ul className="space-y-0.5 text-slate-700 dark:text-slate-300">
                            {day.exercises.map((ex, j) => (
                              <li key={j}>{ex.name} <span className="text-slate-500 dark:text-slate-400">{ex.sets}×{ex.reps}</span></li>
                            ))}
                          </ul>
                        ) : <p className="text-slate-500 dark:text-slate-400">{isRu ? 'День отдыха' : 'Rest day'}</p>}
                      </div>
                      <div>
                        <p className="eyebrow mb-1">{isRu ? 'Рацион' : 'Meals'}</p>
                        <ul className="space-y-0.5 text-slate-700 dark:text-slate-300">
                          {(day.meals?.items ?? []).map((m, j) => (
                            <li key={j}>
                              <span className="text-slate-500 dark:text-slate-400">{m.slot}:</span> {m.name}
                              {nutrition && (
                                <span className="block text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                  {m.calories} {isRu ? 'ккал' : 'kcal'} · {isRu ? 'Б' : 'P'} {m.protein} · {isRu ? 'Ж' : 'F'} {m.fats} · {isRu ? 'У' : 'C'} {m.carbs}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : status === 'upcoming' ? (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          {isRu ? 'Подробный план появится, когда придёт эта неделя.' : 'The detailed plan is written when this week arrives.'}
        </p>
      ) : null}
    </div>
  );
};

export default ProgramTimeline;
