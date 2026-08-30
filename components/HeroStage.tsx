import React, { useState } from 'react';
import { ArrowRight, ArrowUp, ArrowDown, HelpCircle, Dumbbell, Utensils, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Stage, Reveal, Avatar } from './Stage';
import { Tab, UserProfile, Language } from '../types';
import AnimatedNumber from './AnimatedNumber';
import { totalWorkoutsPerWeek } from '../utils/profile';

interface HeroStageProps {
  userProfile: UserProfile;
  language: Language;
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  exercisesDone: number;
  planProgress: number;
  targetCalories: number | null;
  /** Real coaching line from today's plan; the expandable card shows it in full. */
  recommendation: string;
  onNavigate: (tab: Tab) => void;
  /**
   * Optional looping backdrop, e.g. "/hero.mp4" served from `public/`.
   * Without it the stage falls back to a CSS aurora, so the app ships with
   * no external media dependency.
   */
  videoSrc?: string;
}

/** 61 ticks, every 5th taller: a measuring rule for the progress readout. */
const RulerTicker: React.FC = () => {
  const ticks = Array.from({ length: 61 }, (_, i) => i);
  const set = (keyPrefix: string) => (
    <div className="flex items-end gap-[11px] shrink-0 pr-[11px]">
      {ticks.map(i => (
        <span
          key={`${keyPrefix}-${i}`}
          className="w-px rounded-full bg-brand-300/50 shrink-0"
          style={{ height: i % 5 === 0 ? 26 : 18 }}
        />
      ))}
    </div>
  );

  return (
    <div className="relative w-full h-[40px] mt-2 overflow-hidden ruler-mask" aria-hidden="true">
      <div className="flex items-end h-full animate-ticker w-max">
        {set('a')}
        {set('b')}
      </div>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-10 rounded-full bg-brand-300" />
    </div>
  );
};

/** Russian counts need three forms: 1 упражнение, 2 упражнения, 5 упражнений. */
const pluralRu = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

/** Small glass tile. `tone` picks the surface: frosted, or a lit gradient. */
const InfoCard: React.FC<{
  title: string;
  meta: React.ReactNode;
  icon: React.ElementType;
  tone: 'glass' | 'lit';
  onClick: () => void;
}> = ({ title, meta, icon: Icon, tone, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full xl:w-[260px] h-[130px] sm:h-[144px] rounded-[16px] sm:rounded-[20px] p-4 sm:p-5
                flex flex-col justify-between text-left transition-all duration-300 group
                ${tone === 'glass'
        ? 'bg-white/[0.07] backdrop-blur-xl border border-white/10 hover:bg-white/[0.12]'
        : 'bg-gradient-to-br from-brand-400/90 to-brand-600/80 hover:brightness-110 border border-brand-300/30'}`}
  >
    <div className="flex items-start justify-between gap-3">
      <h3 className={`font-display text-base sm:text-lg font-semibold uppercase tracking-wide leading-tight
                      ${tone === 'lit' ? 'text-slate-950' : 'text-white'}`}>
        {title}
      </h3>
      <Icon size={18} className={tone === 'lit' ? 'text-slate-950/70 shrink-0' : 'text-white/60 shrink-0'} />
    </div>
    <div className="flex items-center justify-between gap-3">
      <span className={`text-[11px] sm:text-[12px] font-medium
                        ${tone === 'lit' ? 'text-slate-950/75' : 'text-white/60'}`}>
        {meta}
      </span>
      <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform
                        group-hover:translate-x-0.5
                        ${tone === 'lit' ? 'bg-slate-950 text-brand-300' : 'bg-white text-slate-950'}`}>
        <ArrowRight size={15} />
      </span>
    </div>
  </button>
);

/**
 * Cinematic top block for the dashboard: a lit stage, one oversized readout,
 * and four tiles that open the rest of the app.
 *
 * The stage stays dark in both themes on purpose, the same device PlanHero
 * uses; it reads as a screen inside the page rather than a theme flip.
 */
const HeroStage: React.FC<HeroStageProps> = ({
  userProfile, language, level, xp, xpIntoLevel, xpPerLevel,
  exercisesDone, planProgress, targetCalories, recommendation, onNavigate, videoSrc,
}) => {
  const isRu = language === 'ru';
  const [expanded, setExpanded] = useState(false);
  const reduce = useReducedMotion();

  const name = userProfile.name || (isRu ? 'Атлет' : 'Athlete');
  const firstName = name.trim().split(/\s+/)[0];
  const progressPercent = Math.round((xpIntoLevel / xpPerLevel) * 100);

  return (
    <Stage variant="dashboard" videoSrc={videoSrc}>
        {/* ── Top bar ───────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 relative">
          <Reveal delay={100} from="down">
            <p className="eyebrow text-brand-300">Fit Genius</p>
            <p className="text-xs text-white/50 mt-1">{isRu ? 'AI тренер' : 'AI coach'}</p>
          </Reveal>

          <button
            onClick={() => onNavigate(Tab.PROFILE)}
            aria-label={isRu ? 'Настройки профиля' : 'Profile settings'}
            className="absolute left-1/2 -translate-x-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full
                       bg-black/25 backdrop-blur-md border border-white/10
                       flex items-center justify-center text-white/70 hover:text-white
                       hover:bg-black/40 transition-colors"
          >
            <HelpCircle size={18} strokeWidth={1.5} />
          </button>

          <Reveal delay={200} from="down">
            <div className="flex items-center gap-3">
              <span className="hidden md:block font-display text-xl sm:text-3xl lg:text-[42px] font-semibold
                               uppercase leading-none text-right">
                {firstName}
              </span>
              <Avatar name={name} className="w-11 h-11 sm:w-16 sm:h-16 lg:w-[72px] lg:h-[72px] text-lg sm:text-2xl" />
            </div>
          </Reveal>
        </div>

        {/* ── Stage ─────────────────────────────────────────────── */}
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-8 mt-8 lg:mt-10">
          {/* Left: the headline readout */}
          <div className="flex flex-col items-center xl:items-start w-full sm:w-[420px] lg:w-[520px] shrink-0">
            <Reveal delay={300} from="scale" className="w-full">
              <div className="relative overflow-hidden flex items-center justify-center
                              rounded-[24px] sm:rounded-[32px] lg:rounded-[40px]
                              w-full h-[300px] sm:h-[360px] lg:h-[400px]">
                {/* Rotating halo, inset past the edges so no corner sweeps into view */}
                <div
                  className="absolute inset-[-5%] animate-spin-bg opacity-90"
                  aria-hidden="true"
                  style={{
                    background:
                      'conic-gradient(from 0deg, rgba(183,236,30,0.35), rgba(18,194,224,0.18), rgba(10,12,15,0.05), rgba(183,236,30,0.35))',
                    filter: 'blur(28px)',
                  }}
                />
                <div className="absolute inset-6 rounded-full bg-slate-950/55 backdrop-blur-md" aria-hidden="true" />

                <div className="relative z-10 text-center px-6">
                  <Reveal delay={600}>
                    <p className="text-gray-200 text-base sm:text-lg md:text-[22px] font-medium leading-tight">
                      {isRu ? 'Текущий' : 'Your current'}
                      <br />
                      {isRu ? 'уровень' : 'level'}
                    </p>
                  </Reveal>
                  <Reveal delay={800}>
                    <div className="stat text-[72px] sm:text-[100px] lg:text-[132px] leading-[0.85] mt-3">
                      <AnimatedNumber value={level} locale={isRu ? 'ru-RU' : 'en-US'} />
                    </div>
                  </Reveal>
                  <Reveal delay={900}>
                    <p className="text-white/55 text-sm mt-4 tabular-nums">
                      {xpIntoLevel} / {xpPerLevel} XP {isRu ? 'до уровня' : 'to level'} {level + 1}
                    </p>
                  </Reveal>
                </div>
              </div>
            </Reveal>

            <Reveal delay={1000} className="w-full flex flex-col items-center xl:items-start">
              <span className="inline-flex items-center gap-2 mt-5 px-4 sm:px-6 py-2 rounded-full
                               border border-brand-300/50 bg-brand-300/20 text-white
                               text-xs sm:text-sm font-medium tracking-wide">
                {planProgress > 0 ? <ArrowUp size={13} /> : <Sparkles size={13} />}
                {isRu
                  ? `${exercisesDone} ${pluralRu(exercisesDone, 'упражнение', 'упражнения', 'упражнений')} выполнено`
                  : `${exercisesDone} ${exercisesDone === 1 ? 'exercise' : 'exercises'} completed`}
                {planProgress > 0 && <span className="text-brand-300">{planProgress}%</span>}
              </span>
              <RulerTicker />
            </Reveal>
          </div>

          {/* Right: four tiles */}
          <div className="flex flex-col gap-4 sm:gap-[20px] w-full xl:w-auto">
            <div className="flex flex-col sm:flex-row xl:flex-col gap-4 sm:gap-[20px]">
              <Reveal delay={500} from="left" className="flex-1 xl:flex-none">
                <InfoCard
                  title={isRu ? 'Тренировки' : 'Workouts'}
                  meta={isRu
                    ? `${totalWorkoutsPerWeek(userProfile)} в неделю`
                    : `${totalWorkoutsPerWeek(userProfile)} per week`}
                  icon={Dumbbell}
                  tone="glass"
                  onClick={() => onNavigate(Tab.WORKOUTS)}
                />
              </Reveal>
              <Reveal delay={650} from="left" className="flex-1 xl:flex-none">
                <InfoCard
                  title={isRu ? 'Питание' : 'Nutrition'}
                  meta={targetCalories
                    ? `${targetCalories.toLocaleString(isRu ? 'ru-RU' : 'en-US')} ${isRu ? 'ккал' : 'kcal'}`
                    : (isRu ? 'План не создан' : 'No plan yet')}
                  icon={Utensils}
                  tone="lit"
                  onClick={() => onNavigate(Tab.NUTRITION)}
                />
              </Reveal>
            </div>

            <div className="flex flex-col sm:flex-row xl:flex-col gap-4 sm:gap-[20px]">
              {/* Expandable: hover on desktop, tap on touch */}
              <Reveal delay={800} from="left" className="flex-1 xl:flex-none">
                <div
                  onMouseEnter={() => !reduce && setExpanded(true)}
                  onMouseLeave={() => !reduce && setExpanded(false)}
                  onClick={() => setExpanded(v => !v)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v); } }}
                  className={`w-full xl:w-[260px] rounded-[16px] sm:rounded-[20px] p-4 sm:p-5 cursor-pointer
                              flex flex-col justify-between transition-all duration-300 ease-in-out
                              ${expanded
                      ? 'bg-white text-slate-950 h-auto xl:h-[280px]'
                      : 'bg-white/[0.07] backdrop-blur-xl border border-white/10 text-white h-[130px] sm:h-[144px]'}`}
                >
                  <div>
                    <h3 className={`font-display text-base sm:text-lg font-semibold uppercase tracking-wide
                                    ${expanded ? 'text-slate-950' : 'text-white'}`}>
                      {isRu ? 'Совет дня' : 'Today\'s tip'}
                    </h3>
                    {expanded ? (
                      <p className="text-sm leading-relaxed mt-3 text-slate-700">{recommendation}</p>
                    ) : (
                      <p className="text-[11px] sm:text-[12px] text-white/55 mt-1">
                        {isRu ? 'Рекомендация тренера' : 'Coach recommendation'}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end mt-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                                      ${expanded ? 'bg-[#F0F0F0] text-slate-950' : 'bg-slate-950 text-white'}`}>
                      {expanded ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
                    </span>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={950} from="left" className="flex-1 xl:flex-none">
                <InfoCard
                  title={isRu ? 'Прогресс' : 'Progress'}
                  meta={`${xp.toLocaleString(isRu ? 'ru-RU' : 'en-US')} XP · ${progressPercent}%`}
                  icon={Sparkles}
                  tone="glass"
                  onClick={() => onNavigate(Tab.PROFILE)}
                />
              </Reveal>
            </div>
          </div>
        </div>
    </Stage>
  );
};

export default HeroStage;
