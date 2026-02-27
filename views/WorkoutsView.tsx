import React, { useState, useEffect, useRef } from 'react';
import { Wand2, CalendarDays, CheckCircle2, Info, Dumbbell, Repeat, Timer, Send, MessageSquare, RefreshCw, Zap, ChevronRight } from 'lucide-react';
import MarkdownContent from '../components/MarkdownContent';
import { UserProfile, Language, ExerciseDetail } from '../types';
import { generateWeeklyPlan, askPlanQuestion, generateExerciseDetails } from '../services/geminiService';
import { getTranslation } from '../utils/translations';

interface WorkoutsViewProps {
    userProfile: UserProfile;
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    apiKey: string;
    language: Language;
    onToggleExercise: (dayIndex: number, exerciseIndex: number) => void;
}


const AppleExerciseCard: React.FC<{
    exercise: ExerciseDetail;
    isCompleted: boolean;
    onToggle: () => void;
    isRu: boolean;
    t: any;
    onLoadTips: () => Promise<void>;
}> = ({ exercise, isCompleted, onToggle, isRu, t, onLoadTips }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(false);

    const hasTips = !!exercise.notes;

    const handleExpand = async () => {
        if (!isExpanded && !hasTips) {
            setLoading(true);
            try {
                await onLoadTips();
            } finally {
                setLoading(false);
            }
        }
        setIsExpanded(!isExpanded);
    };

    return (
        <div className={`group transition-all duration-500 ease-in-out ${isExpanded ? 'bg-white dark:bg-slate-800 shadow-2xl scale-100 ring-1 ring-slate-200 dark:ring-slate-700' : 'bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl'} rounded-[2.5rem] overflow-hidden border border-transparent`}>
            {/* Header / Summary */}
            <div
                onClick={handleExpand}
                className="p-6 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
                <div className="flex items-center gap-5">
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggle(); }}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg ${isCompleted
                            ? 'bg-green-500 text-white shadow-green-500/20'
                            : 'bg-white dark:bg-slate-700 text-slate-300 dark:text-slate-500 shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-600'}`}
                    >
                        {isCompleted ? <CheckCircle2 size={28} /> : <Dumbbell size={28} />}
                    </button>
                    <div>
                        <h3 className={`text-xl font-black transition-colors ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                            {exercise.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-xs font-bold text-slate-500"><Repeat size={12} className="text-blue-500" /> {exercise.sets} {t.sets}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                            <span className="flex items-center gap-1 text-xs font-bold text-slate-500">
                                <Zap size={12} className="text-orange-500" />
                                {exercise.reps.toLowerCase().includes(t.reps.toLowerCase().slice(0, 4)) ? exercise.reps : `${exercise.reps} ${t.reps}`}
                            </span>
                            {exercise.rest && (
                                <>
                                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                    <span className="flex items-center gap-1 text-xs font-bold text-slate-500"><Timer size={12} className="text-purple-500" /> {exercise.rest}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-center">
                    {!hasTips && !loading && (
                        <span
                            onClick={(e) => { e.stopPropagation(); handleExpand(); }}
                            className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full uppercase tracking-widest transition-all hover:bg-blue-500 hover:text-white cursor-pointer select-none"
                        >
                            {t.getTips}
                        </span>
                    )}
                    <button className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-slate-800 text-white rotate-90' : 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-400'}`}>
                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <ChevronRight size={20} />}
                    </button>
                </div>
            </div>

            {/* Expanded Content */}
            <div className={`transition-all duration-500 overflow-hidden ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {loading ? (
                    <div className="px-8 pb-10 flex flex-col items-center justify-center space-y-4">
                        <div className="w-10 h-10 border-4 border-slate-100 dark:border-slate-800 border-t-blue-500 rounded-full animate-spin" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.coachWriting}</p>
                    </div>
                ) : exercise.notes ? (
                    <div className="px-8 pb-8 pt-2 space-y-8 animate-fade-in">
                        {/* Notes Section */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <Info size={14} className="text-blue-500" /> {t.instructionsTitle}
                            </div>
                            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                <MarkdownContent content={exercise.notes} />
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
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
    const [askLoading, setAskLoading] = useState(false);
    const autoGenRef = useRef(false);

    const isRu = language === 'ru';

    // Check if we have a weekly plan
    const hasWeeklyPlan = userProfile?.weeklyPlan && userProfile.weeklyPlan.length > 0;
    const currentDayPlan = hasWeeklyPlan ? userProfile!.weeklyPlan![selectedDayIndex] : null;

    const completedCount = userProfile.completedExercises?.length || 0;
    const totalExercises = userProfile.weeklyPlan?.reduce((total, day) => total + (day.exercises?.length || 0), 0) ?? 0;
    const progressPercentage = totalExercises > 0 ? (completedCount / totalExercises) * 100 : 0;

    // Auto-generate if missing and profile is sufficiently filled
    useEffect(() => {
        const canGenerate = apiKey && userProfile?.name && !hasWeeklyPlan && !loading && !autoGenRef.current;
        if (canGenerate) {
            autoGenRef.current = true;
            handleGenerate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey, userProfile?.name, hasWeeklyPlan]);

    const handleGenerate = async () => {
        if (!apiKey || !userProfile) return;
        setLoading(true);
        setAnswer(null);
        setGenerateError(null);
        autoGenRef.current = true;

        try {
            const plan = await generateWeeklyPlan(userProfile, apiKey, language);
            setUserProfile(prev => ({
                ...prev,
                weeklyPlan: plan,
                planLanguage: language,
                isSetup: true
            }));
        } catch (e: any) {
            const raw = e?.message || '';
            const isNetworkErr = raw === 'Failed to fetch' || raw.toLowerCase().includes('network');
            setGenerateError(isNetworkErr
                ? (isRu
                    ? 'Нет соединения с Gemini API. Проверьте интернет или отключите блокировщики рекламы / расширения браузера, которые могут блокировать запросы к Google API.'
                    : 'Cannot reach Gemini API. Check your internet connection, or disable ad-blockers / browser extensions that may block Google API requests.')
                : (raw || (isRu ? 'Ошибка генерации плана' : 'Failed to generate plan')));
            // don't reset autoGenRef — prevents infinite auto-retry loop on failure
        } finally {
            setLoading(false);
        }
    };

    const handleLoadExerciseTips = async (exerciseIdx: number, dayIdx: number) => {
        if (!apiKey || !userProfile || !userProfile.weeklyPlan) return;
        try {
            const day = userProfile.weeklyPlan[dayIdx];
            if (!day) return;
            const exercise = day.exercises[exerciseIdx];
            const details = await generateExerciseDetails(exercise.name, userProfile, apiKey, language);

            setUserProfile(prev => {
                if (!prev.weeklyPlan) return prev;
                const newPlan = [...prev.weeklyPlan];
                const targetDay = { ...newPlan[dayIdx] };
                const exercises = [...targetDay.exercises];
                exercises[exerciseIdx] = { ...exercises[exerciseIdx], ...details };
                targetDay.exercises = exercises;
                newPlan[dayIdx] = targetDay;
                return { ...prev, weeklyPlan: newPlan };
            });
        } catch (e) {
            console.error('Failed to load exercise details:', e);
            throw e; // Bubble up to local card loading state
        }
    };

    const handleAskQuestion = async () => {
        if (!question.trim() || !currentDayPlan || !apiKey) return;
        setAskLoading(true);
        const planStr = JSON.stringify(currentDayPlan);
        const response = await askPlanQuestion(planStr, question, 'fitness', apiKey, language);
        setAnswer(response);
        setQuestion('');
        setAskLoading(false);
    };

    const days = isRu
        ? ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']
        : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    const noApiKey = !apiKey;

    return (
        <div className="max-w-6xl mx-auto pb-12 space-y-10 animate-fade-in font-sans">
            {/* Language Mismatch Banner */}
            {hasWeeklyPlan && userProfile.planLanguage && userProfile.planLanguage !== language && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shrink-0 group-hover:rotate-12 transition-transform">
                            <Wand2 size={20} />
                        </div>
                        <p className="text-sm font-bold text-orange-700 dark:text-orange-400">
                            {getTranslation(language).common.translatePrompt}
                        </p>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="px-6 py-2 bg-orange-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-500/20 flex items-center gap-2 whitespace-nowrap"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={14} /> : <Wand2 size={14} />}
                        {getTranslation(language).common.refresh}
                    </button>
                </div>
            )}

            {/* Apple style Top Banner */}
            <div className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-10 sm:p-14 text-white shadow-3xl">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-500/20 to-transparent z-0 blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="max-w-xl text-center md:text-left">
                        <p className="text-blue-400 text-xs font-black uppercase tracking-[0.3em] mb-4">
                            {t.aiTrainer}
                        </p>
                        <h1 className="text-5xl md:text-6xl font-black subpixel-antialiased tracking-tight leading-tight">
                            {t.pageTitle}
                        </h1>
                        <p className="text-slate-400 text-lg mt-6 font-medium leading-relaxed">
                            {t.pageSubtitle}
                        </p>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-6 text-center md:text-right">
                        <div className="bg-white/10 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 flex items-center gap-6 min-w-[240px]">
                            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/50">
                                <Zap size={24} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <div className="text-3xl font-black tracking-tighter">
                                    {userProfile.xp}
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t.totalXp}</div>
                            </div>
                            <div className="w-1 font-black text-white/20">|</div>
                            <div>
                                <div className="text-3xl font-black tracking-tighter text-blue-400">
                                    {Math.round(progressPercentage)}%
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t.progress}</div>
                            </div>
                        </div>
                        <button
                            onClick={() => { autoGenRef.current = false; handleGenerate(); }}
                            disabled={loading || noApiKey || !userProfile}
                            className={`group relative overflow-hidden px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest transition-all duration-500 active:scale-95 ${loading ? 'bg-slate-800' : 'bg-white text-slate-900 border-2 border-transparent hover:px-12'}`}
                        >
                            <span className="relative z-10 flex items-center gap-3">
                                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Wand2 size={18} />}
                                {loading ? common.curating : common.refreshPlan}
                            </span>
                        </button>
                    </div>
                </div>

                {!hasWeeklyPlan && !loading && noApiKey && (
                    <div className="mt-10 bg-red-500/10 border border-red-500/20 backdrop-blur-sm rounded-3xl p-6 flex items-center gap-4">
                        <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shrink-0">
                            <Info size={20} className="text-white" />
                        </div>
                        <p className="text-slate-300 font-bold text-sm leading-relaxed">
                            {t.apiKeyRequired}
                        </p>
                    </div>
                )}

                {!hasWeeklyPlan && !loading && !noApiKey && !generateError && (
                    <div className="mt-10 bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                            <CalendarDays size={32} className="text-white" />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-xl font-black text-blue-400 mb-1">{t.noWorkouts}</h3>
                            <p className="text-blue-400/80 font-bold text-sm">
                                {t.noWorkoutsDesc}
                            </p>
                        </div>
                    </div>
                )}

                {generateError && !loading && (
                    <div className="mt-10 bg-red-500/10 border border-red-500/30 backdrop-blur-sm rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shrink-0 shrink-0">
                            <Info size={32} className="text-white" />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-xl font-black text-red-400 mb-1">{common.genError}</h3>
                            <p className="text-red-400/80 font-bold text-sm break-all">{generateError}</p>
                            <button
                                onClick={() => { setGenerateError(null); autoGenRef.current = false; handleGenerate(); }}
                                className="mt-4 px-6 py-2 bg-red-500 hover:bg-red-400 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all"
                            >
                                {common.retry}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Day Selector */}
            {hasWeeklyPlan && (
                <div className="flex justify-center">
                    <div className="inline-flex p-2 bg-slate-100 dark:bg-slate-900 rounded-[2rem] shadow-inner border border-slate-200 dark:border-slate-800">
                        {days.map((day, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedDayIndex(idx)}
                                className={`px-6 py-4 rounded-[1.5rem] text-sm font-black transition-all duration-300 ${selectedDayIndex === idx
                                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xl scale-110 z-10'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* AI Workout Plan Section */}
            {loading ? (
                <div className="py-32 flex flex-col items-center justify-center space-y-8">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full border-[6px] border-slate-100 dark:border-slate-800 border-t-blue-500 animate-spin transition-all duration-700" />
                        <Zap size={32} className="absolute inset-0 m-auto text-blue-500 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">{t.optimizing}</h3>
                        <p className="text-slate-500 font-medium">{t.optimizingDesc}</p>
                    </div>
                </div>
            ) : currentDayPlan ? (
                <div className="space-y-12 animate-fade-in" key={selectedDayIndex}>
                    {/* Introduction / Day Title */}
                    <div className="px-6 py-4 text-center">
                        <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">
                            {currentDayPlan.workoutTitle || `${t.workout}: ${currentDayPlan.day}`}
                        </h2>
                        <p className="text-slate-500 font-bold mt-2 uppercase tracking-[0.2em] text-xs">
                            {t.balancedByAi}
                        </p>
                    </div>

                    {/* Exercise Grid */}
                    <div className="grid grid-cols-1 gap-6">
                        {currentDayPlan.exercises && currentDayPlan.exercises.length > 0 ? (
                            currentDayPlan.exercises.map((ex, idx) => (
                                <AppleExerciseCard
                                    key={idx}
                                    exercise={ex}
                                    isCompleted={userProfile.completedExercises?.includes(`${selectedDayIndex}-${idx}`) || false}
                                    onToggle={() => onToggleExercise(selectedDayIndex, idx)}
                                    isRu={isRu}
                                    t={t}
                                    onLoadTips={() => handleLoadExerciseTips(idx, selectedDayIndex)}
                                />
                            ))
                        ) : (
                            <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-16 shadow-lg border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center gap-6">
                                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600">
                                    <Zap size={40} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{t.restDay}</h3>
                                    <p className="text-slate-500 font-medium max-w-sm">
                                        {isRu ? 'Время для восстановления! Помните о растяжке и легкой активности.' : 'Recovery is key! Focus on mobility or light activity today.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Day Tip */}
                    {currentDayPlan.workoutTip && (
                        <div className="p-8 bg-slate-50 dark:bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-slate-200 dark:border-white/10 animate-fade-in mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-[10px] text-white dark:text-slate-900 font-black">AI</div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 leading-none">{t.coachingInsight}</span>
                            </div>
                            <div className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200 max-w-none">
                                <MarkdownContent content={currentDayPlan.workoutTip} />
                            </div>
                        </div>
                    )}
                </div>
            ) : null}

            {/* Q&A Section */}
            <div className="mt-10">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 text-slate-800 dark:text-white border border-slate-100 dark:border-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors duration-500" />

                    <div className="relative z-10 space-y-8">
                        <div>
                            <h2 className="text-3xl font-black mb-2 leading-tight">
                                {t.talkToCoach}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">
                                {t.talkToCoachDesc}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={question}
                                    onChange={e => setQuestion(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAskQuestion()}
                                    placeholder={t.inputPlaceholder}
                                    className="w-full pl-6 pr-16 py-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/30 transition-all focus:bg-slate-100 dark:focus:bg-white/10"
                                />
                                <button
                                    onClick={handleAskQuestion}
                                    disabled={askLoading || !question.trim()}
                                    className="absolute right-2 top-2 bottom-2 px-6 bg-blue-500 hover:bg-blue-400 text-slate-900 rounded-full font-black transition-all disabled:opacity-30 flex items-center justify-center shadow-lg shadow-blue-500/20 active:scale-90"
                                >
                                    {askLoading ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
                                </button>
                            </div>

                            {answer && (
                                <div className="p-8 bg-slate-50 dark:bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-slate-200 dark:border-white/10 animate-fade-in">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-[10px] text-white dark:text-slate-900 font-black">AI</div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 leading-none">{t.coachResponse}</span>
                                    </div>
                                    <div className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200 max-w-none">
                                        <MarkdownContent content={answer} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkoutsView;