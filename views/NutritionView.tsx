import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Utensils, Coffee, Sun, Moon, Info, ChefHat, Scale, Droplet, Apple, RotateCcw,
    Wand2, RefreshCw, Zap, Flame, ChevronRight, Send, AlertTriangle
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import MarkdownContent from '../components/MarkdownContent';
import DaySelector from '../components/DaySelector';
import PlanHero from '../components/PlanHero';
import AnimatedNumber from '../components/AnimatedNumber';
import { Language, UserProfile, MealDetails, DayPlan } from '../types';
import { generateWeeklyPlan, askPlanQuestion, generateMealDetails, generateSupplementTips, describeGeminiError } from '../services/geminiService';
import { getTranslation } from '../utils/translations';
import { archiveFinishedWeek } from '../utils/planHistory';
import { dayLabel, shortDayLabel } from '../utils/days';

interface NutritionViewProps {
    language: Language;
    userProfile?: UserProfile;
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    apiKey?: string;
    waterConsumed: number;
    setWaterConsumed: React.Dispatch<React.SetStateAction<number>>;
    onAwardXp: (amount: number) => void;
}

/** Icon by position in the day: the slot names are free-form model output. */
const mealIcon = (index: number, total: number): React.ElementType => {
  if (index === 0) return Coffee;
  if (index === total - 1) return Moon;
  return index % 2 === 1 ? Sun : Apple;
};

const MealCard: React.FC<{
    meal: MealDetails;
    type: string;
    icon: React.ElementType;
    accent: string;
    isRu: boolean;
    t: any;
    canLoadDetails: boolean;
    isSupplement?: boolean;
    onLoadDetails: () => Promise<void>;
}> = ({ meal, type, icon: Icon, accent, isRu, t, canLoadDetails, isSupplement = false, onLoadDetails }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasDetails = isSupplement ? !!meal.recipe : !!(meal.ingredients?.length && meal.recipe);
    const detailsLabel = isSupplement ? (isRu ? 'Советы' : 'Get tips') : t.getRecipe;

    const handleExpand = async () => {
        if (isExpanded) { setIsExpanded(false); return; }
        setIsExpanded(true);
        if (!hasDetails && canLoadDetails) {
            setLoading(true);
            setError(null);
            try {
                await onLoadDetails();
            } catch (e: any) {
                setError(describeGeminiError(e, isRu ? 'ru' : 'en'));
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <article className="card card-hover overflow-hidden">
            <div className="p-4 sm:p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-[var(--radius-control)] ${accent} flex items-center justify-center shrink-0`}>
                    {loading ? <RefreshCw className="animate-spin" size={20} /> : <Icon size={22} />}
                </div>

                <div className="flex-1 min-w-0">
                    <span className="eyebrow block">{type}</span>
                    <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-slate-900 dark:text-white break-words mt-0.5">
                        {meal.name || (isRu ? 'Без названия' : 'Unnamed')}
                    </h3>
                    {/* Macros as separate readouts: a dot-separated string is a metadata smear.
                        Labels are spelled out. The previous "g P" under `uppercase`
                        rendered as "GP", which reads as nothing at all. */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="chip bg-flame-500/10 text-flame-700 dark:text-flame-400">
                            <Flame size={12} />
                            <span className="stat text-sm">{meal.calories}</span>
                            <span className="text-[11px] opacity-80">{t.kcal}</span>
                        </span>
                        {[
                            { label: t.protein, value: meal.protein },
                            { label: t.fats, value: meal.fats },
                            { label: t.carbs, value: meal.carbs },
                        ].map(macro => (
                            <span key={macro.label} className="chip surface-muted text-slate-600 dark:text-slate-300">
                                <span className="text-[11px] opacity-70">{macro.label}</span>
                                <span className="stat text-sm">{macro.value}</span>
                                <span className="text-[11px] opacity-70">{t.gram}</span>
                            </span>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleExpand}
                    aria-expanded={isExpanded}
                    aria-label={detailsLabel}
                    className="btn-secondary shrink-0 px-3.5 py-2 text-sm"
                >
                    <ChevronRight size={16} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <span className="hidden sm:inline">{hasDetails ? (isRu ? 'Детали' : 'Details') : detailsLabel}</span>
                </button>
            </div>

            {isExpanded && (
                <div className="px-4 sm:px-5 pb-5 space-y-5 animate-fade-in">
                    {loading ? (
                        <div className="surface-muted rounded-2xl p-5 space-y-2.5">
                            <p className="eyebrow mb-3">
                                {isSupplement ? (isRu ? 'Эксперт готовит советы…' : 'Expert is writing tips…') : t.chefWriting}
                            </p>
                            <div className="skeleton h-3 w-full" />
                            <div className="skeleton h-3 w-10/12" />
                            <div className="skeleton h-3 w-7/12" />
                        </div>
                    ) : error ? (
                        <div className="flex items-start gap-2.5 rounded-2xl p-4 text-sm
                                        bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300
                                        border border-red-200 dark:border-red-900/60">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <span className="break-words">{error}</span>
                        </div>
                    ) : hasDetails ? (
                        <>
                            {!!meal.ingredients?.length && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3 eyebrow">
                                        {isSupplement
                                            ? <><Zap size={14} className="text-brand-700 dark:text-brand-400" />{isRu ? 'Состав и дозировка' : 'Compounds & dosage'}</>
                                            : <><Scale size={14} className="text-brand-700 dark:text-brand-400" />{isRu ? 'Ингредиенты' : 'Ingredients'}</>}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {meal.ingredients.map((ing, i) => (
                                            <span
                                                key={i}
                                                className={`chip ${isSupplement
                                                    ? 'bg-brand-300/15 text-brand-800 dark:text-brand-300 border-brand-500/30'
                                                    : 'surface-muted text-slate-700 dark:text-slate-300'}`}
                                            >
                                                {ing}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {meal.recipe && (
                                <div className="surface-muted rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-3 eyebrow">
                                        {isSupplement
                                            ? <><Zap size={14} className="text-brand-700 dark:text-brand-400" />{isRu ? 'Руководство по приёму' : 'Supplement guide'}</>
                                            : <><ChefHat size={14} className="text-flame-500" />{t.preparationGuide}</>}
                                    </div>
                                    <div className="text-slate-700 dark:text-slate-300">
                                        <MarkdownContent content={meal.recipe} />
                                    </div>
                                </div>
                            )}

                            {meal.tip && (
                                <div className="flex gap-3 p-4 rounded-[var(--radius-card)] bg-brand-300/12 border border-brand-500/25">
                                    <div className="w-9 h-9 rounded-[var(--radius-control)] bg-brand-300 flex items-center justify-center text-slate-950 shrink-0">
                                        <Info size={17} />
                                    </div>
                                    <div>
                                        <span className="eyebrow text-brand-800 dark:text-brand-300">{t.expertAdvice}</span>
                                        <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">{meal.tip}</p>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400 px-1">
                            {isRu
                                ? 'Добавьте ключ Gemini в профиле, чтобы получить рецепт.'
                                : 'Add your Gemini key in Profile to get the recipe.'}
                        </p>
                    )}
                </div>
            )}
        </article>
    );
};

const NutritionView: React.FC<NutritionViewProps> = ({
    language, userProfile, setUserProfile, apiKey = '', waterConsumed, setWaterConsumed, onAwardXp
}) => {
    const trans = getTranslation(language);
    const t = trans.nutrition;
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
    const safeDayIndex = Math.min(selectedDayIndex, Math.max(0, weeklyPlan.length - 1));
    const currentDayPlan = hasWeeklyPlan ? weeklyPlan[safeDayIndex] : null;
    const noApiKey = !apiKey;

    const waterGoal = userProfile?.weight ? Math.round(userProfile.weight * 35) : 2500;
    const waterPercentage = waterGoal > 0 ? Math.min((waterConsumed / waterGoal) * 100, 100) : 0;

    const dayLabels = useMemo(
        () => weeklyPlan.map((_, i) => shortDayLabel(i, language)),
        [weeklyPlan, language]);

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
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (apiKey && userProfile?.name && !hasWeeklyPlan && !loading && !autoGenRef.current) {
            handleGenerate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey, userProfile?.name, hasWeeklyPlan]);

    const handleLoadMealDetails = async (index: number) => {
        if (!apiKey || !userProfile || !currentDayPlan) return;
        const meal = currentDayPlan.meals?.items?.[index];
        if (!meal) return;

        const details = await generateMealDetails(meal.name, userProfile, apiKey, language);
        setUserProfile(prev => {
            if (!prev.weeklyPlan?.[safeDayIndex]) return prev;
            const newPlan = [...prev.weeklyPlan];
            const day = { ...newPlan[safeDayIndex] };
            const items = [...(day.meals.items || [])];
            items[index] = { ...items[index], ...details };
            day.meals = { ...day.meals, items };
            newPlan[safeDayIndex] = day;
            return { ...prev, weeklyPlan: newPlan };
        });
    };

    const handleLoadSupplementDetails = async (index: number) => {
        if (!apiKey || !userProfile || !currentDayPlan) return;
        const supplement = currentDayPlan.meals?.sportsNutrition?.[index];
        if (!supplement) return;

        const details = await generateSupplementTips(supplement.name, userProfile, apiKey, language);
        setUserProfile(prev => {
            if (!prev.weeklyPlan?.[safeDayIndex]) return prev;
            const newPlan = [...prev.weeklyPlan];
            const day = { ...newPlan[safeDayIndex] };
            const sportsNutrition = [...(day.meals.sportsNutrition || [])];
            sportsNutrition[index] = { ...sportsNutrition[index], ...details };
            day.meals = { ...day.meals, sportsNutrition };
            newPlan[safeDayIndex] = day;
            return { ...prev, weeklyPlan: newPlan };
        });
    };

    const handleAskQuestion = async () => {
        const q = question.trim();
        if (!q || !currentDayPlan || !apiKey || askLoading) return;
        setAskLoading(true);
        setAnswerError(null);
        try {
            const response = await askPlanQuestion(JSON.stringify(currentDayPlan), q, 'dietary', apiKey, language);
            setAnswer(response);
            setQuestion('');
        } catch (e: any) {
            setAnswerError(describeGeminiError(e, language));
        } finally {
            setAskLoading(false);
        }
    };

    // Hydration rewards XP here too — the Dashboard tracker always did.
    const handleAddWater = (ml: number) => {
        setWaterConsumed(prev => prev + ml);
        onAwardXp(Math.floor(ml / 50));
    };

    const meals = currentDayPlan?.meals;
    const mealItems = meals?.items ?? [];
    const supplements = meals?.sportsNutrition ?? [];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Language mismatch banner */}
            {hasWeeklyPlan && userProfile?.planLanguage && userProfile.planLanguage !== language && (
                <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4
                                border-brand-400/60 dark:border-brand-700 bg-brand-50 dark:bg-brand-950/40">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-300 flex items-center justify-center text-slate-950 shrink-0">
                            <Wand2 size={18} />
                        </div>
                        <p className="text-sm font-semibold text-brand-900 dark:text-brand-200">{common.translatePrompt}</p>
                    </div>
                    <button onClick={handleGenerate} disabled={loading} className="btn-primary shrink-0">
                        {loading ? <RefreshCw size={15} className="animate-spin" /> : <Wand2 size={15} />}
                        {common.refresh}
                    </button>
                </div>
            )}

            <PlanHero
                variant="nutrition"
                eyebrow={t.aiNutritionist}
                title={t.pageTitle}
                subtitle={t.pageSubtitle}
                stats={[{
                    icon: Utensils,
                    value: currentDayPlan ? <AnimatedNumber value={currentDayPlan.totalCalories} /> : '0',
                    label: t.targetKcal,
                }]}
                actionLabel={common.refreshPlan}
                loadingLabel={common.curating}
                loading={loading}
                disabled={noApiKey}
                onAction={handleGenerate}
            >
                {noApiKey && !hasWeeklyPlan && !loading && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex items-start gap-3">
                        <Info size={20} className="text-red-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-200 leading-relaxed">
                            {isRu
                                ? 'Добавьте ключ Gemini в профиле, чтобы составить план питания.'
                                : 'Add your Gemini API key in Profile to build a meal plan.'}
                        </p>
                    </div>
                )}

                {generateError && !loading && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex items-start gap-4">
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
                        <div className="w-20 h-20 rounded-full border-[5px] border-slate-200 dark:border-slate-800 border-t-brand-400 animate-spin" />
                        <Utensils size={24} className="absolute inset-0 m-auto text-brand-700 dark:text-brand-400" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t.analyzing}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.chefReady}</p>
                    </div>
                </div>
            ) : currentDayPlan && meals ? (
                <div className="space-y-8 animate-fade-in" key={safeDayIndex}>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <p className="eyebrow">{t.balancedByAi}</p>
                            <h2 className="font-display text-2xl sm:text-4xl font-semibold uppercase leading-none
                                           text-slate-900 dark:text-white mt-2">
                                {`${t.menuFor} ${dayLabel(safeDayIndex, language)}`}
                            </h2>
                        </div>
                        <div className="sm:text-right shrink-0">
                            <div className="stat text-3xl text-slate-900 dark:text-white">
                                <AnimatedNumber value={currentDayPlan.totalCalories} />
                            </div>
                            <p className="eyebrow mt-1">{t.kcal}</p>
                        </div>
                    </div>

                    {/* Daily meals */}
                    <section>
                        <header className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-[var(--radius-control)] bg-slate-950 dark:bg-slate-800 flex items-center justify-center">
                                <Utensils size={15} className="text-brand-300" />
                            </div>
                            <h3 className="font-display text-base font-semibold uppercase tracking-wide text-slate-900 dark:text-white">
                                {isRu ? 'Основное питание' : 'Daily meals'}
                            </h3>
                            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                        </header>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {mealItems.map((meal, i) => (
                                <MealCard
                                    key={`${meal.slot}-${i}`}
                                    meal={meal}
                                    type={meal.slot}
                                    icon={mealIcon(i, mealItems.length)}
                                    accent={i % 2 === 0
                                        ? 'bg-brand-300 text-slate-950'
                                        : 'bg-slate-950 text-brand-300 dark:bg-slate-800'}
                                    isRu={isRu}
                                    t={t}
                                    canLoadDetails={!noApiKey}
                                    onLoadDetails={() => handleLoadMealDetails(i)}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Sports nutrition */}
                    {userProfile?.useSupplements && supplements.length > 0 && (
                        <section className="panel p-5 sm:p-6 bg-brand-300/8 border-brand-500/25">
                            <header className="flex items-center gap-3 mb-5">
                                <div className="w-8 h-8 rounded-[var(--radius-control)] bg-brand-300 flex items-center justify-center">
                                    <Zap size={15} className="text-slate-950" />
                                </div>
                                <h3 className="font-display text-base font-semibold uppercase tracking-wide text-slate-900 dark:text-white">
                                    {isRu ? 'Спортивное питание' : 'Sports nutrition'}
                                </h3>
                                <div className="flex-1 h-px bg-brand-500/25" />
                                <span className="chip bg-brand-300/30 text-brand-900 dark:text-brand-300 border-brand-500/40 py-1">
                                    {(() => {
                                        const n = supplements.length;
                                        if (isRu) {
                                            const word = n === 1 ? 'приём' : n >= 2 && n <= 4 ? 'приёма' : 'приёмов';
                                            return `${n} ${word}`;
                                        }
                                        return `${n} ${n === 1 ? 'intake' : 'intakes'}`;
                                    })()}
                                </span>
                            </header>

                            {/* Timeline */}
                            <div className="relative pl-6">
                                <div className="absolute left-[0.3rem] top-3 bottom-3 w-px bg-brand-500/30" aria-hidden="true" />
                                <div className="space-y-3">
                                    {supplements.map((item, idx) => (
                                        <div key={`supp-${idx}`} className="relative">
                                            <span className="absolute -left-6 top-7 w-2.5 h-2.5 rounded-full bg-brand-400 border-2 border-white dark:border-slate-900" aria-hidden="true" />
                                            <MealCard
                                                meal={item}
                                                type={t.sportsNutrition}
                                                icon={Zap}
                                                accent="bg-brand-300 text-slate-950"
                                                isRu={isRu}
                                                t={t}
                                                isSupplement
                                                canLoadDetails={!noApiKey}
                                                onLoadDetails={() => handleLoadSupplementDetails(idx)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {currentDayPlan.nutritionTip && (
                        <div className="card p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-6 h-6 rounded-full bg-brand-300 text-slate-950 text-[10px] font-bold flex items-center justify-center">AI</span>
                                <span className="eyebrow">{t.nutritionInsight}</span>
                            </div>
                            <div className="text-slate-700 dark:text-slate-300">
                                <MarkdownContent content={currentDayPlan.nutritionTip} />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card p-10 sm:p-14 text-center border-dashed">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-5">
                        <Utensils size={28} />
                    </div>
                    <h3 className="font-display text-2xl font-semibold uppercase text-slate-900 dark:text-white mb-2">{t.noData}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-7">{t.noDataDesc}</p>
                    <button onClick={handleGenerate} disabled={noApiKey || loading} className="btn-primary">
                        <Wand2 size={16} />
                        {common.refreshPlan}
                    </button>
                </div>
            )}

            {/* Q&A + hydration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="panel p-6 sm:p-8">
                    <h2 className="font-display text-2xl sm:text-3xl font-semibold uppercase text-slate-900 dark:text-white mb-1.5">{t.talkToExpert}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t.talkToExpertDesc}</p>

                    <div className="relative">
                        <label htmlFor="nutrition-question" className="sr-only">{t.talkToExpert}</label>
                        <input
                            id="nutrition-question"
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
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                                       bg-brand-300 text-slate-950 hover:bg-brand-200 disabled:opacity-40
                                       flex items-center justify-center transition-colors"
                        >
                            {askLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </div>

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
                                <span className="eyebrow">{t.expertAdvice}</span>
                            </div>
                            <div className="text-slate-700 dark:text-slate-300">
                                <MarkdownContent content={answer} />
                            </div>
                        </div>
                    )}
                </section>

                <section className="panel p-6 sm:p-8 flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-[var(--radius-control)] bg-aqua-500/15 text-aqua-500 flex items-center justify-center mb-4">
                        <Droplet size={28} />
                    </div>
                    <h2 className="font-display text-2xl font-semibold uppercase text-slate-900 dark:text-white">{t.hydration}</h2>
                    <p className="eyebrow mt-1.5">{t.dailyGoal}: {waterGoal} ml</p>

                    <div className="relative py-7 flex items-center justify-center">
                        <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100" role="img"
                            aria-label={`${Math.round(waterPercentage)}%`}>
                            <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8"
                                className="stroke-slate-200 dark:stroke-slate-800" />
                            <circle
                                cx="50" cy="50" r="45" fill="none" stroke="url(#water-grad)" strokeWidth="8"
                                strokeDasharray="283"
                                strokeDashoffset={283 - (283 * waterPercentage / 100)}
                                strokeLinecap="round"
                                className="transition-all duration-700 ease-out"
                            />
                            <defs>
                                <linearGradient id="water-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#12c2e0" />
                                    <stop offset="100%" stopColor="#38dcf4" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="stat text-4xl text-slate-900 dark:text-white">
                                <AnimatedNumber value={waterConsumed} />
                            </span>
                            <span className="eyebrow mt-1">ML</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center">
                        {[250, 500].map(ml => (
                            <button
                                key={ml}
                                onClick={() => handleAddWater(ml)}
                                className="btn-secondary px-5"
                            >
                                <Droplet size={14} className="text-aqua-500" />
                                +{ml} ml
                            </button>
                        ))}
                        <button
                            onClick={() => setWaterConsumed(0)}
                            aria-label={isRu ? 'Сбросить счётчик воды' : 'Reset water counter'}
                            className="btn-secondary px-3"
                        >
                            <RotateCcw size={17} />
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default NutritionView;
