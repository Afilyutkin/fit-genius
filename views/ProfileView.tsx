import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Language } from '../types';
import { Save, AlertTriangle, Activity, Calendar, Clock, Utensils, Key, CheckCircle, XCircle, Loader2, Wand2, Target, Check, TrendingUp, RefreshCw, Trash2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { validateApiKey, generateWeeklyPlan } from '../services/geminiService';
import { getTranslation } from '../utils/translations';

interface ProfileViewProps {
    userProfile: UserProfile;
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    apiKey: string;
    setApiKey: (key: string) => void;
    setWaterConsumed: React.Dispatch<React.SetStateAction<number>>;
    language: Language;
    onPlanGenerated: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ userProfile, setUserProfile, apiKey, setApiKey, setWaterConsumed, language, onPlanGenerated }) => {
    const [tempKey, setTempKey] = useState(apiKey);
    const [keyStatus, setKeyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [sportsInput, setSportsInput] = useState(userProfile.preferredSports.join(' '));
    const [showKey, setShowKey] = useState(false);
    const checkedRef = useRef(false);

    const t = getTranslation(language).profile;
    const tGoals = getTranslation(language).goals;

    // Bug fix: use a ref to prevent infinite loop —
    // previously setApiKey triggered re-render → useEffect re-ran → infinite loop
    useEffect(() => {
        if (apiKey && !checkedRef.current) {
            checkedRef.current = true;
            handleCheckKey(apiKey);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey]);

    const handleChange = (field: keyof UserProfile, value: any) => {
        setUserProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleCheckKey = async (keyToCheck?: string) => {
        const key = keyToCheck || tempKey;
        if (!key) return;
        setKeyStatus('checking');
        const isValid = await validateApiKey(key);
        setKeyStatus(isValid ? 'valid' : 'invalid');
        if (isValid) {
            setApiKey(key);
            if (!keyToCheck) setTempKey(key);
        }
    };

    const handleDisconnect = () => {
        setApiKey('');
        setTempKey('');
        setKeyStatus('idle');
    };

    const handleSportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSportsInput(val);
        // Split by comma or space, filter empty
        const sports = val.split(/[\s,]+/).filter(s => s.trim().length > 0);
        handleChange('preferredSports', sports);
    };

    const toggleGoal = (goalKey: string) => {
        const currentGoals = userProfile.fitnessGoals || [];
        if (currentGoals.includes(goalKey)) {
            handleChange('fitnessGoals', currentGoals.filter(g => g !== goalKey));
        } else {
            if (currentGoals.length < 2) {
                handleChange('fitnessGoals', [...currentGoals, goalKey]);
            }
        }
    };

    const handleSaveAndGenerate = async () => {
        if (!apiKey) {
            setGenerateError(language === 'ru' ? 'Введите и подключите Gemini API ключ' : 'Please connect a Gemini API key first.');
            return;
        }
        if (!userProfile.name) {
            setGenerateError(language === 'ru' ? 'Введите ваше имя' : 'Please enter your name.');
            return;
        }

        setIsGenerating(true);
        setGenerateError(null);
        try {
            const plan = await generateWeeklyPlan(userProfile, apiKey, language);
            setUserProfile(prev => ({
                ...prev,
                weeklyPlan: plan,
                completedExercises: [],
                isSetup: true
            }));
            setWaterConsumed(0);
            onPlanGenerated();
        } catch (e: any) {
            const raw = e?.message || '';
            const isNetworkErr = raw === 'Failed to fetch' || raw.toLowerCase().includes('network');
            setGenerateError(isNetworkErr
                ? (language === 'ru'
                    ? 'Нет соединения с Gemini API. Проверьте интернет или отключите блокировщики рекламы / расширения браузера, которые могут блокировать запросы к Google API.'
                    : 'Cannot reach Gemini API. Check your internet connection, or disable ad-blockers / browser extensions that may block Google API requests.')
                : (raw || (language === 'ru' ? 'Ошибка генерации плана' : 'Failed to generate plan')));
        } finally {
            setIsGenerating(false);
        }
    };

    const availableGoals = [
        { key: 'Strength', label: tGoals.strength },
        { key: 'Endurance', label: tGoals.endurance },
        { key: 'Flexibility', label: tGoals.flexibility },
        { key: 'Speed', label: tGoals.speed },
        { key: 'Stress Relief', label: tGoals.stressRelief },
        { key: 'General Health', label: tGoals.health },
        { key: 'Muscle Gain', label: tGoals.muscleGain },
        { key: 'Lose Weight', label: tGoals.weightLoss },
    ];

    return (
        <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-10">
            {/* Mobile-friendly header: stacks vertically on small screens */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{userProfile.isSetup ? t.title : "Welcome to Fit Genius"}</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">{t.subtitle}</p>
                </div>
                <button
                    onClick={handleSaveAndGenerate}
                    disabled={isGenerating}
                    className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-200 dark:shadow-none ${isGenerating
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
                        }`}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            <span>{t.generating}</span>
                        </>
                    ) : (
                        <>
                            {userProfile.isSetup ? <Save size={18} /> : <Wand2 size={18} />}
                            <span>{userProfile.isSetup ? t.save : t.generatePlan}</span>
                        </>
                    )}
                </button>
            </div>

            {/* Generation error */}
            {generateError && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                    <p className="text-sm font-bold text-red-600 dark:text-red-400 break-words">{generateError}</p>
                </div>
            )}

            {/* API Key Configuration - Highlight if not set */}
            <div className={`p-8 rounded-3xl border shadow-sm relative overflow-hidden transition-all duration-500 ${!apiKey ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-700 ring-2 ring-yellow-400 ring-opacity-50' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                {!apiKey && <div className="absolute top-4 right-4 animate-bounce text-yellow-600 dark:text-yellow-400 font-bold text-[10px] uppercase tracking-widest bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 rounded-full border border-yellow-200 dark:border-yellow-800">Required Step 1</div>}
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-100/30 dark:bg-yellow-900/5 rounded-bl-[4rem]"></div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex-1">
                        <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2 flex items-center">
                            <Key className={`w-5 h-5 mr-3 ${apiKey ? 'text-green-500' : 'text-yellow-500'}`} />
                            {t.apiKeyConfig}
                            {keyStatus === 'valid' && (
                                <div className="ml-3 flex items-center px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-200 dark:border-green-800">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></div>
                                    {t.connected}
                                </div>
                            )}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                            {language === 'ru'
                                ? 'Для работы AI тренера необходим ключ Gemini API. Получите его бесплатно на ai.google.dev'
                                : 'Gemini API Key is required for the AI Coach. Get it for free at ai.google.dev'}
                        </p>

                        <div className="flex gap-3 flex-col sm:flex-row">
                            <div className="flex-1 relative group">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={tempKey}
                                    onChange={(e) => {
                                        setTempKey(e.target.value);
                                        setKeyStatus('idle');
                                    }}
                                    placeholder={t.apiKeyPlaceholder}
                                    className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-2xl px-5 py-3.5 pr-20 text-slate-700 dark:text-white outline-none transition-all shadow-inner font-mono text-sm ${keyStatus === 'valid'
                                        ? 'border-green-200 dark:border-green-800 focus:ring-2 focus:ring-green-500'
                                        : keyStatus === 'invalid'
                                            ? 'border-red-200 dark:border-red-800 focus:ring-2 focus:ring-red-500'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-yellow-500'
                                        }`}
                                />
                                {/* Eye toggle — always visible to the left of status icon */}
                                <button
                                    type="button"
                                    onClick={() => setShowKey(v => !v)}
                                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    title={showKey ? 'Скрыть ключ' : 'Показать ключ'}
                                >
                                    {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                                {/* Status icon */}
                                {keyStatus === 'valid' && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />}
                                {keyStatus === 'invalid' && <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" size={18} />}
                            </div>


                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleCheckKey()}
                                    disabled={keyStatus === 'checking' || !tempKey}
                                    className={`px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center disabled:opacity-50 shadow-lg ${keyStatus === 'valid'
                                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-200 dark:shadow-none'
                                        : 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-200 dark:shadow-none'
                                        }`}
                                >
                                    {keyStatus === 'checking' ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Check className="mr-2" size={16} strokeWidth={3} />}
                                    {keyStatus === 'valid' ? (language === 'ru' ? 'Проверить снова' : 'Re-check') : t.connect}
                                </button>

                                {apiKey && (
                                    <button
                                        onClick={handleDisconnect}
                                        className="p-3.5 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-2xl transition-all border border-red-100 dark:border-red-800/50"
                                        title={t.disconnect}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {keyStatus === 'invalid' && (
                            <motion.p
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-3 text-xs font-bold text-red-500 flex items-center px-2"
                            >
                                <AlertTriangle size={14} className="mr-1.5" />
                                {t.invalidKey}
                            </motion.p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Physical Stats */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center">
                        <UserIcon className="w-5 h-5 mr-2 text-blue-500" />
                        {t.physicalMetrics}
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.name}</label>
                            <input
                                type="text"
                                value={userProfile.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.age}</label>
                            <input
                                type="number"
                                value={userProfile.age}
                                onChange={(e) => handleChange('age', parseInt(e.target.value))}
                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.gender}</label>
                            <select
                                value={userProfile.gender}
                                onChange={(e) => handleChange('gender', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="Male">{t.male}</option>
                                <option value="Female">{t.female}</option>
                                <option value="Other">{t.other}</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.weight}</label>
                            <input
                                type="number"
                                value={userProfile.weight}
                                onChange={(e) => handleChange('weight', parseFloat(e.target.value))}
                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.height}</label>
                            <input
                                type="number"
                                value={userProfile.height}
                                onChange={(e) => handleChange('height', parseFloat(e.target.value))}
                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Workout Preferences */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center">
                        <Activity className="w-5 h-5 mr-2 text-green-500" />
                        {t.activityPrefs}
                    </h2>
                    <div className="space-y-4">
                        {/* New Goal Selector (Multi-select) */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                                <Target size={12} className="mr-1" /> {tGoals.label}
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {availableGoals.map(goal => {
                                    const isSelected = userProfile.fitnessGoals.includes(goal.key);
                                    return (
                                        <button
                                            key={goal.key}
                                            onClick={() => toggleGoal(goal.key)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isSelected
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-300'
                                                }`}
                                        >
                                            {goal.label} {isSelected && <Check size={10} className="inline ml-1" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Fitness Level Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                                <TrendingUp size={12} className="mr-1" /> {t.fitnessLevel}
                            </label>
                            <select
                                value={userProfile.fitnessLevel}
                                onChange={(e) => handleChange('fitnessLevel', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="Beginner">{t.beginner}</option>
                                <option value="Amateur">{t.amateur}</option>
                                <option value="Professional">{t.professional}</option>
                            </select>
                        </div>

                        {/* Activity Level / Lifestyle Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                                <Activity size={12} className="mr-1" strokeWidth={3} /> {t.lifestyle}
                            </label>
                            <select
                                value={userProfile.activityLevel}
                                onChange={(e) => handleChange('activityLevel', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                            >
                                <option value="Sedentary">{t.sedentary}</option>
                                <option value="Moderate">{t.moderate}</option>
                                <option value="Active">{t.active}</option>
                                <option value="Extra Active">{t.extraActive}</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.preferredSports}</label>
                            <input
                                type="text"
                                value={sportsInput}
                                onChange={handleSportChange}
                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder={t.preferredSports}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                                    <Calendar size={12} className="mr-1" /> {t.freq}
                                </label>
                                <input
                                    type="number"
                                    value={userProfile.workoutsPerWeek}
                                    onChange={(e) => handleChange('workoutsPerWeek', parseInt(e.target.value))}
                                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                                    <Clock size={12} className="mr-1" /> {t.duration}
                                </label>
                                <input
                                    type="number"
                                    value={userProfile.workoutDurationMin}
                                    onChange={(e) => handleChange('workoutDurationMin', parseInt(e.target.value))}
                                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contraindications - Critical for Health AI */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-bl-[4rem]"></div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center relative z-10">
                        <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                        {t.medical}
                    </h2>
                    <div className="space-y-2 relative z-10">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.injuries}</label>
                        <textarea
                            value={userProfile.contraindications}
                            onChange={(e) => handleChange('contraindications', e.target.value)}
                            className="w-full bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-xl px-4 py-3 text-slate-700 dark:text-white focus:ring-2 focus:ring-red-500 outline-none min-h-[100px]"
                            placeholder="e.g. Lower back pain, bad knees, asthma..."
                        />
                    </div>
                </div>

                {/* Nutrition */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center">
                        <Utensils className="w-5 h-5 mr-2 text-orange-500" />
                        {t.nutritionGoals}
                    </h2>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.dietaryPrefs}</label>
                        <select
                            value={userProfile.dietaryPreferences}
                            onChange={(e) => handleChange('dietaryPreferences', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        >
                            <option value="Balanced">{t.diets.balanced}</option>
                            <option value="Keto">{t.diets.keto}</option>
                            <option value="Vegan">{t.diets.vegan}</option>
                            <option value="Vegetarian">{t.diets.vegetarian}</option>
                            <option value="Paleo">{t.diets.paleo}</option>
                            <option value="High Protein">{t.diets.highProtein}</option>
                            <option value="Low Carb">{t.diets.lowCarb}</option>
                            <option value="Low Fat">{t.diets.lowFat}</option>
                            <option value="Mediterranean">{t.diets.mediterranean}</option>
                            <option value="Pescatarian">{t.diets.pescatarian}</option>
                            <option value="Gluten-Free">{t.diets.glutenFree}</option>
                            <option value="Intermittent Fasting">{t.diets.intermittentFasting}</option>
                            <option disabled className="text-slate-400 dark:text-slate-500 mt-2">------------------------------</option>
                            <option value="Halal (Islam)">{t.diets.halal}</option>
                            <option value="Kosher (Judaism)">{t.diets.kosher}</option>
                            <option value="Hinduism">{t.diets.hindu}</option>
                            <option value="Christianity">{t.diets.christian}</option>
                            <option value="Buddhism">{t.diets.buddhist}</option>
                        </select>
                    </div>
                </div>

            </div>
        </div>
    );
};

const UserIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);

export default ProfileView;