import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    CalendarDays, CheckCircle2, Info, Dumbbell, Repeat, Timer, Send, RefreshCw,
    Zap, ChevronRight, Wand2, AlertTriangle, Flame
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import MarkdownContent from '../components/MarkdownContent';
import DaySelector from '../components/DaySelector';
import PlanHero from '../components/PlanHero';
import AnimatedNumber from '../components/AnimatedNumber';
import { UserProfile, Language, ExerciseDetail, SessionBlock } from '../types';
import { generateWeeklyPlan, askPlanQuestion, generateExerciseDetails, describeGeminiError } from '../services/geminiService';
import { getTranslation } from '../utils/translations';

/** Display order of the session blocks. */
const SESSION_BLOCKS: SessionBlock[] = ['warmup', 'main', 'accessory', 'cooldown'];
import { archiveFinishedWeek } from '../utils/planHistory';
import { dayLabel, shortDayLabel } from '../utils/days';

interface WorkoutsViewProps {
    userProfile: UserProfile;
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    apiKey: string;
    language: Language;
    onToggleExercise: (dayIndex: number, exerciseIndex: number) => void;
}

const ExerciseCard: React.FC<{
    exercise: ExerciseDetail;
    isCompleted: boolean;
    onToggle: () => void;
    t: any;
    isRu: boolean;
    canLoadTips: boolean;
    onLoadTips: () => Promise<void>;
}> = ({ exercise, isCompleted, onToggle, t, isRu, canLoadTips, onLoadTips }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const reduce = useReducedMotion();

    const hasTips = !!exercise.notes;
    // `reps` arrives from the model and is not always a string.
    const reps = String(exercise.reps ?? '');
    const repsLabel = reps.toLowerCase().includes(String(t.reps).toLowerCase().slice(0, 4))
        ? reps
        : `${reps} ${t.reps}`;

    const handleExpand = async () => {
        if (isExpanded) { setIsExpanded(false); return; }
        setIsExpanded(true);
        if (!hasTips && canLoadTips) {
            setLoading(true);
            setError(null);
            try {
                await onLoadTips();
            } catch (e: any) {
                setError(describeGeminiError(e, isRu ? 'ru' : 'en'));
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <article className={`card card-hover overflow-hidden relative ${isCompleted
            ? 'border-brand-400/60 dark:border-brand-500/40'
            : ''}`}>
            {/* Completion is the reward moment: the volt rail confirms the set is banked */}
            {isCompleted && (
                <motion.span
                    layout
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute left-0 inset-y-0 w-1 bg-brand-400 origin-top"
                    aria-hidden="true"
                />
            )}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <motion.button
                    onClick={onToggle}
                    aria-pressed={isCompleted}
                    aria-label={exercise.name}
                    whileTap={reduce ? undefined : { scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                    className={`w-12 h-12 rounded-[var(--radius-control)] flex items-center justify-center shrink-0 transition-colors ${isCompleted
                        ? 'bg-brand-300 text-slate-950'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                    {isCompleted ? <CheckCircle2 size={24} /> : <Dumbbell size={22} />}
                </motion.button>

                <div className="flex-1 min-w-0">
                    <h3 className={`font-display text-lg sm:text-xl font-semibold uppercase tracking-wide break-words ${isCompleted
                        ? 'text-slate-600 dark:text-slate-400 line-through decoration-brand-500/60'
                        : 'text-slate-900 dark:text-white'}`}>
                        {exercise.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="chip surface-muted text-slate-600 dark:text-slate-300">
                            <Repeat size={12} className="text-brand-700 dark:text-brand-400" />
                            <span className="stat text-sm">{exercise.sets}</span>
                            <span className="text-[11px] uppercase tracking-wide opacity-70">{t.sets}</span>
                        </span>
                        <span className="chip surface-muted text-slate-600 dark:text-slate-300">
                            <Zap size={12} className="text-flame-500" />
                            <span className="stat text-sm">{repsLabel}</span>
                        </span>
                        {exercise.rest && (
                            <span className="chip surface-muted text-slate-600 dark:text-slate-300">
                                <Timer size={12} className="text-aqua-500" />
                                <span className="stat text-sm">{exercise.rest}</span>
                            </span>
                        )}
                        {/* Prescribed effort: the number that makes a set coachable */}
                        {exercise.intensity && (
                            <span className="chip bg-brand-300/15 border-brand-500/30 text-brand-800 dark:text-brand-300">
                                <Flame size={12} />
                                {exercise.intensity}
                            </span>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleExpand}
                    aria-expanded={isExpanded}
                    className="btn-secondary self-start sm:self-center shrink-0 py-2 text-sm"
                >
                    {loading
                        ? <RefreshCw size={15} className="animate-spin" />
                        : <ChevronRight size={15} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />}
                    {hasTips ? t.instructionsTitle : t.getTips}
                </button>
            </div>

            {isExpanded && (
                <div className="px-4 sm:px-5 pb-5 animate-fade-in">
                    {loading ? (
                        <div className="surface-muted rounded-2xl p-5 space-y-2.5">
                            <p className="eyebrow mb-3">{t.coachWriting}</p>
                            <div className="skeleton h-3 w-full" />
                            <div className="skeleton h-3 w-11/12" />
                            <div className="skeleton h-3 w-8/12" />
                        </div>
                    ) : error ? (
                        <div className="flex items-start gap-2.5 rounded-2xl p-4 text-sm
                                        bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300
                                        border border-red-200 dark:border-red-900/60">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <span className="break-words">{error}</span>
                        </div>
                    ) : exercise.notes ? (
                        <div className="surface-muted rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-3 eyebrow">
                                <Info size={14} className="text-brand-700 dark:text-brand-400" /> {t.instructionsTitle}
                            </div>
                            <div className="text-slate-700 dark:text-slate-300">
                                <MarkdownContent content={exercise.notes} />
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400 px-1">
                            {isRu
                                ? 'Добавьте ключ Gemini в профиле, чтобы получить разбор техники.'
                                : 'Add your Gemini key in Profile to get technique guidance.'}
                        </p>
                    )}
                </div>
            )}
        </article>
    );
};

const WorkoutsView: React.FC<WorkoutsViewProps> = ({ userProfile, setUserProfile, apiKey, language, onToggleExercise }) => {
    const trans = getTranslation(language);
    const t = trans.workouts;
    const common = trans.common;

    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState<string | null>(null);
    const [answerError, setAnswerError] = useState<string | null>(null);
    const [askLoading, setAskLoading] = useState(false);
    const autoGenRef = useRef(false);

    const isRu = language === 'ru';
    const weeklyPlan = Array.isArray(userProfile?.weeklyPlan) ? userProfile.weeklyPlan : [];
    const hasWeeklyPlan = weeklyPlan.length > 0;

    // A shorter plan than 7 days must not leave the user on an empty tab.
    const safeDayIndex = Math.min(selectedDayIndex, Math.max(0, weeklyPlan.length - 1));
    const currentDayPlan = hasWeeklyPlan ? weeklyPlan[safeDayIndex] : null;

    const dayLabels = useMemo(() => {
        return weeklyPlan.map((_, i) => shortDayLabel(i, language));
    }, [weeklyPlan, isRu]);

    const completedCount = userProfile.completedExercises?.length || 0;
    const totalExercises = weeklyPlan.reduce((total, day) => total + (day.exercises?.length || 0), 0);

    const dayExerciseCount = currentDayPlan?.exercises?.length ?? 0;
    const dayCompleted = (userProfile.completedExercises || [])
        .filter(id => id.startsWith(`${safeDayIndex}-`)).length;
    const dayProgress = dayExerciseCount > 0 ? Math.min(100, (dayCompleted / dayExerciseCount) * 100) : 0;
    const progressPercentage = totalExercises > 0
        ? Math.min(100, (completedCount / totalExercises) * 100)
        : 0;

    const noApiKey = !apiKey;

    const handleGenerate = async () => {
        if (!apiKey || !userProfile) return;
        setLoading(true);
        setAnswer(null);
        setGenerateError(null);
        autoGenRef.current = true;

        try {
            // File the week being replaced before the new plan overwrites it.
            archiveFinishedWeek(userProfile);
            const plan = await generateWeeklyPlan(userProfile, apiKey, language);
            setUserProfile(prev => ({
                ...prev,
                weeklyPlan: plan,
                planLanguage: language,
                planCreatedAt: new Date().toISOString(),
                completedExercises: [],
                isSetup: true,
            }));
            setSelectedDayIndex(0);
        } catch (e: any) {
            setGenerateError(describeGeminiError(e, language));
            // autoGenRef stays set — prevents an infinite auto-retry loop on failure.
        } finally {
            setLoading(false);
        }
    };

    // Auto-generate once if the profile is ready but the plan is missing.
    useEffect(() => {
        if (apiKey && userProfile?.name && !hasWeeklyPlan && !loading && !autoGenRef.current) {
            handleGenerate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey, userProfile?.name, hasWeeklyPlan]);

    const handleLoadExerciseTips = async (exerciseIdx: number, dayIdx: number) => {
        if (!apiKey || !userProfile?.weeklyPlan) return;
        const day = userProfile.weeklyPlan[dayIdx];
        const exercise = day?.exercises?.[exerciseIdx];
        if (!exercise) return;

        const details = await generateExerciseDetails(exercise.name, userProfile, apiKey, language);

        setUserProfile(prev => {
            if (!prev.weeklyPlan?.[dayIdx]) return prev;
            const newPlan = [...prev.weeklyPlan];
            const targetDay = { ...newPlan[dayIdx] };
            const exercises = [...targetDay.exercises];
            exercises[exerciseIdx] = { ...exercises[exerciseIdx], ...details };
            targetDay.exercises = exercises;
            newPlan[dayIdx] = targetDay;
            return { ...prev, weeklyPlan: newPlan };
        });
    };

    const handleAskQuestion = async () => {
        const q = question.trim();
        if (!q || !currentDayPlan || !apiKey || askLoading) return;
        setAskLoading(true);
        setAnswerError(null);
        try {
            const response = await askPlanQuestion(JSON.stringify(currentDayPlan), q, 'fitness', apiKey, language);
            setAnswer(response);
            setQuestion('');
        } catch (e: any) {
            setAnswerError(describeGeminiError(e, language));
        } finally {
            setAskLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Language mismatch banner */}
            {hasWeeklyPlan && userProfile.planLanguage && userProfile.planLanguage !== language && (
                <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4
                                border-brand-400/60 dark:border-brand-700 bg-brand-50 dark:bg-brand-950/40">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-300 flex items-center justify-center text-slate-950 shrink-0">
                            <Wand2 size={18} />
                        </div>
                        <p className="text-sm font-semibold text-brand-900 dark:text-brand-200">
                            {common.translatePrompt}
                        </p>
                    </div>
                    <button onClick={handleGenerate} disabled={loading} className="btn-primary shrink-0">
                        {loading ? <RefreshCw size={15} className="animate-spin" /> : <Wand2 size={15} />}
                        {common.refresh}
                    </button>
                </div>
            )}

            <PlanHero
                variant="workouts"
                eyebrow={t.aiTrainer}
                title={t.pageTitle}
                subtitle={t.pageSubtitle}

                stats={[
                    { icon: Zap, value: <AnimatedNumber value={userProfile.xp} locale={isRu ? 'ru-RU' : 'en-US'} />, label: t.totalXp },
                    { icon: CheckCircle2, value: <AnimatedNumber value={Math.round(progressPercentage)} suffix="%" />, label: t.progress },
                ]}
                actionLabel={common.refreshPlan}
                loadingLabel={common.curating}
                loading={loading}
                disabled={noApiKey}
                onAction={handleGenerate}
            >
                {!hasWeeklyPlan && !loading && noApiKey && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex items-start gap-3">
                        <Info size={20} className="text-red-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-200 leading-relaxed">{t.apiKeyRequired}</p>
                    </div>
                )}

                {!hasWeeklyPlan && !loading && !noApiKey && !generateError && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-start gap-4">
                        <div className="w-11 h-11 rounded-[var(--radius-control)] bg-brand-300 flex items-center justify-center shrink-0">
                            <CalendarDays size={22} className="text-slate-950" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white mb-1">{t.noWorkouts}</h3>
                            <p className="text-sm text-slate-400">{t.noWorkoutsDesc}</p>
                        </div>
                    </div>
                )}

                {generateError && !loading && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex flex-col sm:flex-row items-start gap-4">
                        <AlertTriangle size={22} className="text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-red-300 mb-1">{common.genError}</h3>
                            <p className="text-sm text-slate-300 break-words">{generateError}</p>
                            <button
                                onClick={() => { setGenerateError(null); handleGenerate(); }}
                                className="btn bg-red-500 text-white hover:bg-red-600 mt-4"
                            >
                                {common.retry}
                            </button>
                        </div>
                    </div>
                )}
            </PlanHero>

            {hasWeeklyPlan && !loading && (
                <DaySelector
                    days={dayLabels}
                    selected={safeDayIndex}
                    onSelect={setSelectedDayIndex}
                    label={isRu ? 'День недели' : 'Day of the week'}
                />
            )}

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full border-[5px] border-slate-200 dark:border-slate-800 border-t-brand-500 animate-spin" />
                        <Zap size={26} className="absolute inset-0 m-auto text-brand-700 dark:text-brand-400" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t.optimizing}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.optimizingDesc}</p>
                    </div>
                </div>
            ) : currentDayPlan ? (
                <div className="space-y-6 animate-fade-in" key={safeDayIndex}>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <p className="eyebrow">{dayLabel(safeDayIndex, language)}</p>
                            <h2 className="font-display text-2xl sm:text-4xl font-semibold uppercase leading-none
                                           text-slate-900 dark:text-white mt-2">
                                {dayExerciseCount === 0
                                    ? t.restDay
                                    : (currentDayPlan.workoutTitle || `${t.workout}: ${dayLabel(safeDayIndex, language)}`)}
                            </h2>
                        </div>
                        {/* Session progress: the reason to come back tomorrow */}
                        {!!currentDayPlan.exercises?.length && (
                            <div className="sm:text-right shrink-0">
                                <div className="stat text-3xl text-slate-900 dark:text-white">
                                    {dayCompleted}<span className="text-slate-500 dark:text-slate-400">/{currentDayPlan.exercises.length}</span>
                                </div>
                                <div className="meter h-1.5 w-32 mt-2 sm:ml-auto">
                                    <motion.div
                                        className="meter-fill"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${dayProgress}%` }}
                                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {currentDayPlan.exercises?.length ? (
                            // Grouped by block so the day reads as a session:
                            // warm-up, main work, accessories, cool-down.
                            SESSION_BLOCKS.flatMap(block => {
                                const inBlock = (currentDayPlan.exercises || [])
                                    .map((ex, idx) => ({ ex, idx }))
                                    .filter(({ ex }) => (ex.block || 'main') === block);
                                if (!inBlock.length) return [];

                                return [
                                    <div key={`head-${block}`} className="flex items-center gap-3 mt-2 first:mt-0">
                                        <span className="eyebrow whitespace-nowrap">{t.blocks[block]}</span>
                                        <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                            {inBlock.length}
                                        </span>
                                    </div>,
                                    ...inBlock.map(({ ex, idx }) => (
                                        <ExerciseCard
                                            key={`${safeDayIndex}-${idx}-${ex.name}`}
                                            exercise={ex}
                                            isCompleted={userProfile.completedExercises?.includes(`${safeDayIndex}-${idx}`) || false}
                                            onToggle={() => onToggleExercise(safeDayIndex, idx)}
                                            t={t}
                                            isRu={isRu}
                                            canLoadTips={!noApiKey}
                                            onLoadTips={() => handleLoadExerciseTips(idx, safeDayIndex)}
                                        />
                                    )),
                                ];
                            })
                        ) : (
                            <div className="card p-10 flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-brand-300/20 text-brand-800 dark:text-brand-300 flex items-center justify-center">
                                    <Zap size={30} />
                                </div>
                                <div>
                                    <h3 className="font-display text-2xl font-semibold uppercase text-slate-900 dark:text-white mb-1.5">
                                        {t.restDay}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                                        {isRu
                                            ? 'Время восстановления. Растяжка и лёгкая активность.'
                                            : 'Recovery day. Focus on mobility or light activity.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {currentDayPlan.workoutTip && (
                        <div className="card p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-6 h-6 rounded-full bg-brand-300 text-slate-950 text-[10px] font-bold flex items-center justify-center">AI</span>
                                <span className="eyebrow">{t.coachingInsight}</span>
                            </div>
                            <div className="text-slate-700 dark:text-slate-300">
                                <MarkdownContent content={currentDayPlan.workoutTip} />
                            </div>
                        </div>
                    )}
                </div>
            ) : null}

            {/* Q&A */}
            <section className="panel p-6 sm:p-8">
                <h2 className="font-display text-2xl sm:text-3xl font-semibold uppercase text-slate-900 dark:text-white mb-1.5">{t.talkToCoach}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t.talkToCoachDesc}</p>

                <div className="relative">
                    <label htmlFor="workout-question" className="sr-only">{t.talkToCoach}</label>
                    <input
                        id="workout-question"
                        type="text"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAskQuestion(); }}
                        placeholder={t.inputPlaceholder}
                        disabled={!currentDayPlan || noApiKey}
                        className="input pr-14 py-3.5 rounded-full disabled:opacity-60"
                    />
                    <button
                        onClick={handleAskQuestion}
                        disabled={askLoading || !question.trim() || !currentDayPlan || noApiKey}
                        aria-label={isRu ? 'Отправить вопрос' : 'Send question'}
                        className="tap-target absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                                   bg-brand-300 text-slate-950 hover:bg-brand-200 disabled:opacity-40
                                   flex items-center justify-center transition-colors"
                    >
                        {askLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </div>

                {(noApiKey || !currentDayPlan) && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 px-1">
                        {noApiKey
                            ? t.apiKeyRequired
                            : (isRu ? 'Сначала создайте план тренировок.' : 'Generate a workout plan first.')}
                    </p>
                )}

                {answerError && (
                    <div className="mt-5 flex items-start gap-2.5 rounded-2xl p-4 text-sm
                                    bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300
                                    border border-red-200 dark:border-red-900/60">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span className="break-words">{answerError}</span>
                    </div>
                )}

                {answer && (
                    <div className="mt-5 surface-muted rounded-2xl p-6 animate-fade-in">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-6 h-6 rounded-full bg-brand-300 text-slate-950 text-[10px] font-bold flex items-center justify-center">AI</span>
                            <span className="eyebrow">{t.coachResponse}</span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">
                            <MarkdownContent content={answer} />
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

export default WorkoutsView;
