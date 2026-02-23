import React, { useState, useEffect, useRef } from 'react';
import { Utensils, CalendarDays, Coffee, Sun, Moon, Info, ChefHat, Scale, Droplet, Apple, RotateCcw, Wand2, RefreshCw, Zap, Flame, ChevronRight, Send } from 'lucide-react';
import MarkdownContent from '../components/MarkdownContent';
import { Language, UserProfile, MealDetails, DayPlan } from '../types';
import { generateWeeklyPlan, askPlanQuestion, generateMealDetails } from '../services/geminiService';
import { getTranslation } from '../utils/translations';

interface NutritionViewProps {
    language: Language;
    userProfile?: UserProfile;
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    apiKey?: string;
    waterConsumed: number;
    setWaterConsumed: React.Dispatch<React.SetStateAction<number>>;
}


const AppleMealCard: React.FC<{
    meal: MealDetails;
    type: string;
    icon: React.ElementType;
    color: string;
    isRu: boolean;
    t: any;
    onLoadDetails: () => Promise<void>;
}> = ({ meal, type, icon: Icon, color, isRu, t, onLoadDetails }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(false);

    const hasDetails = !!(meal.ingredients && meal.recipe);

    const handleExpand = async () => {
        if (!isExpanded && !hasDetails) {
            setLoading(true);
            try {
                await onLoadDetails();
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
                    <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-white shadow-lg shadow-current/20 group-hover:scale-110 transition-transform duration-300`}>
                        {loading ? <RefreshCw className="animate-spin" size={24} /> : <Icon size={28} />}
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">{type}</span>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors uppercase tracking-tight">
                            {meal.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-xs font-bold text-slate-500"><Flame size={12} className="text-orange-500" /> {meal.calories} kcal</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{meal.protein}g P · {meal.carbs}g C · {meal.fats}g F</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-center">
                    {!hasDetails && !loading && (
                        <span className="text-[10px] font-black text-green-500 bg-green-500/10 px-3 py-1 rounded-full uppercase tracking-widest transition-all group-hover:bg-green-500 group-hover:text-white animate-pulse">
                            {t.getRecipe}
                        </span>
                    )}
                    <button className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-slate-800 text-white rotate-90' : 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-400'}`}>
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Expanded Content */}
            <div className={`transition-all duration-500 overflow-hidden ${isExpanded ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {loading ? (
                    <div className="px-8 pb-10 flex flex-col items-center justify-center space-y-4">
                        <div className="w-10 h-10 border-4 border-slate-100 dark:border-slate-800 border-t-green-500 rounded-full animate-spin" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.chefWriting}</p>
                    </div>
                ) : hasDetails ? (
                    <div className="px-8 pb-8 pt-2 space-y-8 animate-fade-in">
                        {/* Ingredients Section */}
                        {meal.ingredients && meal.ingredients.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    <Scale size={14} className="text-green-500" /> {isRu ? 'Ингредиенты' : 'Ingredients'}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {meal.ingredients.map((ing, i) => (
                                        <span key={i} className="px-4 py-2 bg-slate-100 dark:bg-slate-700/50 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 transition-hover hover:border-green-400 cursor-default">
                                            {ing}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recipe Section */}
                        {meal.recipe && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700">
                                <div className="flex items-center gap-2 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    <ChefHat size={14} className="text-orange-500" /> {t.preparationGuide}
                                </div>
                                <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                    <MarkdownContent content={meal.recipe} />
                                </div>
                            </div>
                        )}

                        {/* Tip Section */}
                        {meal.tip && (
                            <div className="flex gap-4 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-[1.5rem] border border-blue-100/50 dark:border-blue-900/20">
                                <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20">
                                    <div className="flex items-center justify-center text-white"><Info size={18} /></div>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{t.expertAdvice}</span>
                                    <p className="text-xs text-blue-800 dark:text-blue-300 font-bold mt-1 leading-relaxed italic">
                                        "{meal.tip}"
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

const NutritionView: React.FC<NutritionViewProps> = ({ language, userProfile, setUserProfile, apiKey = '', waterConsumed, setWaterConsumed }) => {
    const trans = getTranslation(language);
    const t = trans.nutrition;
    const common = trans.common;
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState<string | null>(null);
    const [askLoading, setAskLoading] = useState(false);
    const autoGenRef = useRef(false);

    const isRu = language === 'ru';
    const weeklyPlan = Array.isArray(userProfile?.weeklyPlan) ? userProfile.weeklyPlan : [];
    const hasWeeklyPlan = weeklyPlan.length > 0;
    const currentDayPlan = (hasWeeklyPlan && weeklyPlan[selectedDayIndex]) ? weeklyPlan[selectedDayIndex] : null;

    const waterGoal = userProfile?.weight ? Math.round(userProfile.weight * 35) : 2500;
    const waterPercentage = Math.min((waterConsumed / waterGoal) * 100, 100);

    useEffect(() => {
        const canGenerate = apiKey && userProfile?.name && !hasWeeklyPlan && !loading && !autoGenRef.current;
        if (canGenerate) {
            autoGenRef.current = true;
            handleGenerate();
        }
    }, [apiKey, userProfile?.name, hasWeeklyPlan]);

    const handleGenerate = async () => {
        if (!apiKey || !userProfile) return;
        setLoading(true);
        setAnswer(null);
        setGenerateError(null);
        autoGenRef.current = true;
        try {
            const plan = await generateWeeklyPlan(userProfile, apiKey, language);
            setUserProfile(prev => ({ ...prev, weeklyPlan: plan, planLanguage: language, isSetup: true }));
        } catch (e: any) {
            setGenerateError(e?.message || (isRu ? 'Ошибка генерации плана' : 'Failed to generate plan'));
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMealDetails = async (mealKey: keyof DayPlan['meals']) => {
        if (!apiKey || !userProfile || !currentDayPlan) return;
        try {
            const meal = currentDayPlan.meals[mealKey];
            const details = await generateMealDetails(meal.name, userProfile, apiKey, language);
            setUserProfile(prev => {
                if (!prev.weeklyPlan) return prev;
                const newPlan = [...prev.weeklyPlan];
                const day = { ...newPlan[selectedDayIndex] };
                const meals = { ...day.meals };
                meals[mealKey] = { ...meals[mealKey], ...details };
                day.meals = meals;
                newPlan[selectedDayIndex] = day;
                return { ...prev, weeklyPlan: newPlan };
            });
        } catch (e) {
            console.error('Failed to load meal details:', e);
        }
    };

    const handleAskQuestion = async () => {
        if (!question.trim() || !currentDayPlan || !apiKey) return;
        setAskLoading(true);
        const planStr = JSON.stringify(currentDayPlan);
        const response = await askPlanQuestion(planStr, question, 'dietary', apiKey, language);
        setAnswer(response);
        setQuestion('');
        setAskLoading(false);
    };

    const days = isRu ? ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'] : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const noApiKey = !apiKey;

    return (
        <div className="max-w-6xl mx-auto pb-12 space-y-10 animate-fade-in font-sans">
            {/* Language Mismatch Banner */}
            {hasWeeklyPlan && userProfile?.planLanguage && userProfile.planLanguage !== language && (
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

            <div className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-10 sm:p-14 text-white shadow-3xl">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-green-500/20 to-transparent z-0 blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="max-w-xl text-center md:text-left">
                        <p className="text-green-400 text-xs font-black uppercase tracking-[0.3em] mb-4">{t.aiNutritionist}</p>
                        <h1 className="text-5xl md:text-6xl font-black subpixel-antialiased tracking-tight leading-tight">{t.pageTitle}</h1>
                        <p className="text-slate-400 text-lg mt-6 font-medium leading-relaxed">{t.pageSubtitle}</p>
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-6">
                        <div className="bg-white/10 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 flex items-center gap-6 min-w-[200px]">
                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50"><Utensils size={24} className="text-white" /></div>
                            <div>
                                <div className="text-3xl font-black tracking-tighter">{currentDayPlan?.totalCalories || 2200}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t.targetKcal}</div>
                            </div>
                        </div>
                        <button onClick={() => { autoGenRef.current = false; handleGenerate(); }} disabled={loading || noApiKey || !userProfile} className={`group relative overflow-hidden px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest transition-all duration-500 active:scale-95 ${loading ? 'bg-slate-800' : 'bg-white text-slate-900 border-2 border-transparent hover:px-12'}`}>
                            <span className="relative z-10 flex items-center gap-3">
                                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Wand2 size={18} />}
                                {loading ? common.curating : common.refreshPlan}
                            </span>
                        </button>
                    </div>
                </div>
                {generateError && !loading && (
                    <div className="mt-10 bg-red-500/10 border border-red-500/30 backdrop-blur-sm rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shrink-0"><Info size={32} className="text-white" /></div>
                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-xl font-black text-red-400 mb-1">{common.genError}</h3>
                            <p className="text-red-400/80 font-bold text-sm">{generateError}</p>
                            <button onClick={() => { setGenerateError(null); autoGenRef.current = false; handleGenerate(); }} className="mt-4 px-6 py-2 bg-red-500 hover:bg-red-400 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all">{common.retry}</button>
                        </div>
                    </div>
                )}
            </div>

            {hasWeeklyPlan && (
                <div className="flex justify-center">
                    <div className="inline-flex p-2 bg-slate-100 dark:bg-slate-900 rounded-[2rem] shadow-inner border border-slate-200 dark:border-slate-800">
                        {days.map((day, idx) => (
                            <button key={idx} onClick={() => setSelectedDayIndex(idx)} className={`px-6 py-4 rounded-[1.5rem] text-sm font-black transition-all duration-300 ${selectedDayIndex === idx ? 'bg-white dark:bg-slate-800 text-green-600 dark:text-green-400 shadow-xl scale-110 z-10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>{day}</button>
                        ))}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="py-32 flex flex-col items-center justify-center space-y-8">
                    <div className="relative"><div className="w-24 h-24 rounded-full border-[6px] border-slate-100 dark:border-slate-800 border-t-green-500 animate-spin transition-all duration-700" /><Zap size={32} className="absolute inset-0 m-auto text-green-500 animate-pulse" /></div>
                    <div className="text-center space-y-2"><h3 className="text-2xl font-black text-slate-800 dark:text-white">{t.analyzing}</h3><p className="text-slate-500 font-medium">{t.chefReady}</p></div>
                </div>
            ) : currentDayPlan ? (
                <div className="space-y-12 animate-fade-in" key={selectedDayIndex}>
                    <div className="px-6 py-4 text-center">
                        <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">{`${t.menuFor} ${currentDayPlan.day}`}</h2>
                        <p className="text-slate-500 font-bold mt-2 uppercase tracking-[0.2em] text-xs">{t.balancedByAi}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        <AppleMealCard meal={currentDayPlan.meals.breakfast} type={t.breakfast} icon={Coffee} color="bg-orange-500" isRu={isRu} t={t} onLoadDetails={() => handleLoadMealDetails('breakfast')} />
                        <AppleMealCard meal={currentDayPlan.meals.lunch} type={t.lunch} icon={Sun} color="bg-yellow-500" isRu={isRu} t={t} onLoadDetails={() => handleLoadMealDetails('lunch')} />
                        <AppleMealCard meal={currentDayPlan.meals.snack} type={t.snack} icon={Apple} color="bg-pink-500" isRu={isRu} t={t} onLoadDetails={() => handleLoadMealDetails('snack')} />
                        <AppleMealCard meal={currentDayPlan.meals.dinner} type={t.dinner} icon={Moon} color="bg-indigo-600" isRu={isRu} t={t} onLoadDetails={() => handleLoadMealDetails('dinner')} />
                    </div>

                    {/* Day Tip */}
                    {currentDayPlan.nutritionTip && (
                        <div className="p-8 bg-slate-50 dark:bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-slate-200 dark:border-white/10 animate-fade-in mb-10">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white dark:text-slate-900 font-black">AI</div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 leading-none">{t.nutritionInsight}</span>
                            </div>
                            <div className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200 max-w-none">
                                <MarkdownContent content={currentDayPlan.nutritionTip} />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                        <Utensils size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
                        {t.noData}
                    </h3>
                    <p className="text-slate-500 font-medium max-w-sm mx-auto mb-8">
                        {t.noDataDesc}
                    </p>
                    <button
                        onClick={() => { autoGenRef.current = false; handleGenerate(); }}
                        className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-full font-black text-sm uppercase tracking-widest transition-all"
                    >
                        {common.refreshPlan}
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 text-slate-800 dark:text-white border border-slate-100 dark:border-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-green-500/5 dark:bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-colors duration-500" />
                    <div className="relative z-10 space-y-8">
                        <div><h2 className="text-3xl font-black mb-2 leading-tight">{t.talkToExpert}</h2><p className="text-slate-500 dark:text-slate-400 font-medium">{t.talkToExpertDesc}</p></div>
                        <div className="space-y-4">
                            <div className="relative">
                                <input type="text" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAskQuestion()} placeholder={t.inputPlaceholder} className="w-full pl-6 pr-16 py-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-4 focus:ring-green-500/30 transition-all focus:bg-slate-100 dark:focus:bg-white/10" />
                                <button onClick={handleAskQuestion} disabled={askLoading || !question.trim()} className="absolute right-2 top-2 bottom-2 px-6 bg-green-500 hover:bg-green-400 text-white dark:text-slate-900 rounded-full font-black transition-all disabled:opacity-30 flex items-center justify-center shadow-lg shadow-green-500/20 active:scale-90">{askLoading ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}</button>
                            </div>
                            {answer && (
                                <div className="p-8 bg-slate-50 dark:bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-slate-200 dark:border-white/10 animate-fade-in">
                                    <div className="flex items-center gap-2 mb-4"><div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white dark:text-slate-900 font-black">AI</div><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 leading-none">{t.expertAdvice}</span></div>
                                    <div className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200 max-w-none"><MarkdownContent content={answer} /></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-between text-center overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-2 bg-blue-500 transition-all duration-1000" style={{ opacity: waterGoal > 0 ? waterConsumed / waterGoal : 0 }} />
                    <div className="space-y-2">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center text-blue-500 mx-auto mb-4"><Droplet size={32} /></div>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">{t.hydration}</h2>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{t.dailyGoal}: {waterGoal}ml</p>
                    </div>
                    <div className="relative py-6 flex items-center justify-center">
                        <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="8" className="dark:stroke-slate-700/50" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke="url(#water-grad)" strokeWidth="8" strokeDasharray="283" strokeDashoffset={isNaN(waterPercentage) ? 283 : 283 - (283 * waterPercentage / 100)} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                            <defs><linearGradient id="water-grad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#60a5fa" /></linearGradient></defs>
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center"><span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">{waterConsumed}</span><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ML</span></div>
                    </div>
                    <div className="w-full space-y-4">
                        <div className="flex gap-2 justify-center">
                            {[250, 500].map(ml => (<button key={ml} onClick={() => setWaterConsumed(prev => prev + ml)} className="px-6 py-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-black text-sm hover:scale-105 active:scale-95 transition-all">+{ml}ml</button>))}
                            <button onClick={() => setWaterConsumed(0)} className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors"><RotateCcw size={20} /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NutritionView;