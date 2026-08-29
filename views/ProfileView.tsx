import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Language } from '../types';
import {
    Save, AlertTriangle, Activity, Calendar, Clock, Utensils, Key, CheckCircle, XCircle,
    Loader2, Wand2, Target, Check, TrendingUp, RefreshCw, Trash2, Eye, EyeOff,
    User as UserIcon, ExternalLink
} from 'lucide-react';
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

/**
 * Numeric field with its own text state: binding a number directly meant that
 * clearing the box produced NaN, which poisoned the profile and the AI prompt.
 */
const NumberField: React.FC<{
    id: string;
    label: React.ReactNode;
    value: number;
    min: number;
    max: number;
    step?: number;
    onCommit: (value: number) => void;
}> = ({ id, label, value, min, max, step = 1, onCommit }) => {
    const [draft, setDraft] = useState(String(value));
    const focused = useRef(false);

    useEffect(() => {
        if (!focused.current) setDraft(String(value));
    }, [value]);

    const commit = (raw: string) => {
        const parsed = parseFloat(raw.replace(',', '.'));
        if (!Number.isFinite(parsed)) { setDraft(String(value)); return; }
        const clamped = Math.min(max, Math.max(min, parsed));
        setDraft(String(clamped));
        onCommit(clamped);
    };

    return (
        <div>
            <label htmlFor={id} className="label flex items-center gap-1.5">{label}</label>
            <input
                id={id}
                type="number"
                inputMode="decimal"
                min={min}
                max={max}
                step={step}
                value={draft}
                onFocus={() => { focused.current = true; }}
                onChange={(e) => {
                    setDraft(e.target.value);
                    const parsed = parseFloat(e.target.value.replace(',', '.'));
                    if (Number.isFinite(parsed) && parsed >= min && parsed <= max) onCommit(parsed);
                }}
                onBlur={(e) => { focused.current = false; commit(e.target.value); }}
                className="input"
            />
        </div>
    );
};

const ProfileView: React.FC<ProfileViewProps> = ({
    userProfile, setUserProfile, apiKey, setApiKey, setWaterConsumed, language, onPlanGenerated
}) => {
    const [tempKey, setTempKey] = useState(apiKey);
    const [keyStatus, setKeyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [sportsInput, setSportsInput] = useState(userProfile.preferredSports.join(', '));
    const [showKey, setShowKey] = useState(false);
    const checkedRef = useRef(false);

    const t = getTranslation(language).profile;
    const tGoals = getTranslation(language).goals;
    const isRu = language === 'ru';

    const handleCheckKey = async (keyToCheck?: string) => {
        const key = (keyToCheck || tempKey).trim();
        if (!key) return;
        setKeyStatus('checking');
        const isValid = await validateApiKey(key);
        setKeyStatus(isValid ? 'valid' : 'invalid');
        if (isValid) {
            setApiKey(key);
            if (!keyToCheck) setTempKey(key);
        }
    };

    // Verify a stored key once on mount (the ref stops the re-render loop).
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

    const handleDisconnect = () => {
        setApiKey('');
        setTempKey('');
        setKeyStatus('idle');
    };

    const handleSportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSportsInput(val);
        handleChange('preferredSports', val.split(/[\s,]+/).filter(s => s.trim().length > 0));
    };

    const toggleGoal = (goalKey: string) => {
        const currentGoals = userProfile.fitnessGoals || [];
        if (currentGoals.includes(goalKey)) {
            handleChange('fitnessGoals', currentGoals.filter(g => g !== goalKey));
        } else if (currentGoals.length < 2) {
            handleChange('fitnessGoals', [...currentGoals, goalKey]);
        }
    };

    const handleSaveAndGenerate = async () => {
        if (!apiKey) {
            setGenerateError(isRu ? 'Введите и подключите ключ Gemini API' : 'Please connect a Gemini API key first.');
            return;
        }
        if (!userProfile.name.trim()) {
            setGenerateError(isRu ? 'Введите ваше имя' : 'Please enter your name.');
            return;
        }
        if (!userProfile.fitnessGoals.length) {
            setGenerateError(isRu ? 'Выберите хотя бы одну цель' : 'Pick at least one goal.');
            return;
        }

        setIsGenerating(true);
        setGenerateError(null);
        try {
            const plan = await generateWeeklyPlan(userProfile, apiKey, language);
            setUserProfile(prev => ({
                ...prev,
                weeklyPlan: plan,
                planLanguage: language,
                completedExercises: [],
                isSetup: true
            }));
            setWaterConsumed(0);
            onPlanGenerated();
        } catch (e: any) {
            setGenerateError(e?.message || (isRu ? 'Ошибка генерации плана' : 'Failed to generate plan'));
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

    const goalsFull = userProfile.fitnessGoals.length >= 2;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <h1 className="font-display text-3xl sm:text-4xl font-semibold uppercase text-slate-900 dark:text-white">
                        {userProfile.isSetup ? t.title : (isRu ? 'Добро пожаловать в Fit Genius' : 'Welcome to Fit Genius')}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">{t.subtitle}</p>
                </div>
                <button
                    onClick={handleSaveAndGenerate}
                    disabled={isGenerating}
                    className="btn-primary w-full sm:w-auto px-6 py-3"
                >
                    {isGenerating ? <Loader2 size={17} className="animate-spin" />
                        : userProfile.isSetup ? <Save size={17} /> : <Wand2 size={17} />}
                    {isGenerating ? t.generating : (userProfile.isSetup ? t.save : t.generatePlan)}
                </button>
            </div>

            {generateError && (
                <div role="alert" className="flex items-start gap-3 rounded-2xl p-4
                                bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                    <p className="text-sm font-medium text-red-700 dark:text-red-300 break-words">{generateError}</p>
                </div>
            )}

            {/* ── API key ───────────────────────────────────────── */}
            {/* The unset state is signalled with the brand accent, not a second
                warning colour: one accent per page (Colour Consistency Lock). */}
            <section className={`panel p-6 sm:p-8 ${!apiKey
                ? 'border-brand-400 dark:border-brand-600 ring-2 ring-brand-300/40'
                : ''}`}>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h2 className="font-display text-xl font-semibold uppercase text-slate-900 dark:text-white flex items-center gap-2.5">
                        <Key size={19} className="text-brand-700 dark:text-brand-300" />
                        {t.apiKeyConfig}
                    </h2>
                    {keyStatus === 'valid' ? (
                        <span className="chip bg-brand-300/20 text-brand-800 dark:text-brand-300 border-brand-500/30">
                            <CheckCircle size={12} />
                            {t.connected}
                        </span>
                    ) : !apiKey ? (
                        <span className="chip bg-slate-900 text-brand-300 border-slate-800 dark:bg-slate-800">
                            {isRu ? 'Шаг 1, обязательно' : 'Step 1, required'}
                        </span>
                    ) : null}
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                    {isRu
                        ? 'Для работы AI тренера нужен ключ Gemini API. Он хранится только в этом браузере.'
                        : 'The AI coach needs a Gemini API key. It is stored only in this browser.'}
                    {' '}
                    <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer"
                        className="text-brand-800 dark:text-brand-300 font-semibold underline underline-offset-2 inline-flex items-center gap-1">
                        ai.google.dev <ExternalLink size={12} />
                    </a>
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                        <label htmlFor="api-key" className="sr-only">{t.apiKeyConfig}</label>
                        <input
                            id="api-key"
                            type={showKey ? 'text' : 'password'}
                            value={tempKey}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={(e) => { setTempKey(e.target.value); setKeyStatus('idle'); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCheckKey(); }}
                            placeholder={t.apiKeyPlaceholder}
                            className={`input font-mono pr-20 py-3 ${keyStatus === 'valid'
                                ? 'border-brand-400 dark:border-brand-600'
                                : keyStatus === 'invalid'
                                    ? 'border-red-300 dark:border-red-800'
                                    : ''}`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(v => !v)}
                            aria-label={showKey ? (isRu ? 'Скрыть ключ' : 'Hide key') : (isRu ? 'Показать ключ' : 'Show key')}
                            className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                        {keyStatus === 'valid' && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-700 dark:text-brand-400" size={18} />}
                        {keyStatus === 'invalid' && <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" size={18} />}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => handleCheckKey()}
                            disabled={keyStatus === 'checking' || !tempKey}
                            className="btn-primary px-5 py-3"
                        >
                            {keyStatus === 'checking' ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} strokeWidth={3} />}
                            {keyStatus === 'valid' ? (isRu ? 'Проверить' : 'Re-check') : t.connect}
                        </button>

                        {apiKey && (
                            <button onClick={handleDisconnect} className="btn-danger px-3.5 py-3" title={t.disconnect} aria-label={t.disconnect}>
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {keyStatus === 'invalid' && (
                    <p className="mt-3 text-xs font-semibold text-red-500 flex items-center gap-1.5">
                        <AlertTriangle size={14} /> {t.invalidKey}
                    </p>
                )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ── Physical metrics ──────────────────────────── */}
                <section className="panel p-6 sm:p-7">
                    <h2 className="font-display text-xl font-semibold uppercase text-slate-900 dark:text-white mb-5 flex items-center gap-2.5">
                        <UserIcon size={18} className="text-brand-700 dark:text-brand-400" />
                        {t.physicalMetrics}
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label htmlFor="profile-name" className="label">{t.name}</label>
                            <input
                                id="profile-name"
                                type="text"
                                value={userProfile.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                placeholder={isRu ? 'Как к вам обращаться?' : 'What should we call you?'}
                                className="input"
                            />
                        </div>

                        <NumberField
                            id="profile-age" label={t.age} value={userProfile.age}
                            min={10} max={120} onCommit={(v) => handleChange('age', Math.round(v))}
                        />

                        <div>
                            <label htmlFor="profile-gender" className="label">{t.gender}</label>
                            <select
                                id="profile-gender"
                                value={userProfile.gender}
                                onChange={(e) => handleChange('gender', e.target.value)}
                                className="input"
                            >
                                <option value="Male">{t.male}</option>
                                <option value="Female">{t.female}</option>
                                <option value="Other">{t.other}</option>
                            </select>
                        </div>

                        <NumberField
                            id="profile-weight" label={t.weight} value={userProfile.weight}
                            min={20} max={400} step={0.1} onCommit={(v) => handleChange('weight', v)}
                        />
                        <NumberField
                            id="profile-height" label={t.height} value={userProfile.height}
                            min={80} max={260} onCommit={(v) => handleChange('height', Math.round(v))}
                        />
                    </div>
                </section>

                {/* ── Activity preferences ──────────────────────── */}
                <section className="panel p-6 sm:p-7">
                    <h2 className="font-display text-xl font-semibold uppercase text-slate-900 dark:text-white mb-5 flex items-center gap-2.5">
                        <Activity size={18} className="text-brand-700 dark:text-brand-400" />
                        {t.activityPrefs}
                    </h2>

                    <div className="space-y-5">
                        <div>
                            <span className="label flex items-center gap-1.5">
                                <Target size={13} /> {tGoals.label}
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {availableGoals.map(goal => {
                                    const isSelected = userProfile.fitnessGoals.includes(goal.key);
                                    const isDisabled = !isSelected && goalsFull;
                                    return (
                                        <button
                                            key={goal.key}
                                            type="button"
                                            onClick={() => toggleGoal(goal.key)}
                                            disabled={isDisabled}
                                            aria-pressed={isSelected}
                                            className={`chip ${isSelected
                                                ? 'bg-brand-300 text-slate-950 border-brand-300'
                                                : isDisabled
                                                    ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'}`}
                                        >
                                            {goal.label}
                                            {isSelected && <Check size={11} strokeWidth={3} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="fitness-level" className="label flex items-center gap-1.5">
                                <TrendingUp size={13} /> {t.fitnessLevel}
                            </label>
                            <select
                                id="fitness-level"
                                value={userProfile.fitnessLevel}
                                onChange={(e) => handleChange('fitnessLevel', e.target.value)}
                                className="input"
                            >
                                <option value="Beginner">{t.beginner}</option>
                                <option value="Amateur">{t.amateur}</option>
                                <option value="Professional">{t.professional}</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="activity-level" className="label flex items-center gap-1.5">
                                <Activity size={13} /> {t.lifestyle}
                            </label>
                            <select
                                id="activity-level"
                                value={userProfile.activityLevel}
                                onChange={(e) => handleChange('activityLevel', e.target.value)}
                                className="input"
                            >
                                <option value="Sedentary">{t.sedentary}</option>
                                <option value="Moderate">{t.moderate}</option>
                                <option value="Active">{t.active}</option>
                                <option value="Extra Active">{t.extraActive}</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="preferred-sports" className="label">{t.preferredSports}</label>
                            <input
                                id="preferred-sports"
                                type="text"
                                value={sportsInput}
                                onChange={handleSportChange}
                                placeholder={isRu ? 'бег, плавание, йога' : 'running, swimming, yoga'}
                                className="input"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <NumberField
                                id="workouts-per-week"
                                label={<><Calendar size={13} /> {t.freq}</>}
                                value={userProfile.workoutsPerWeek}
                                min={1} max={14}
                                onCommit={(v) => handleChange('workoutsPerWeek', Math.round(v))}
                            />
                            <NumberField
                                id="workout-duration"
                                label={<><Clock size={13} /> {t.duration}</>}
                                value={userProfile.workoutDurationMin}
                                min={10} max={240} step={5}
                                onCommit={(v) => handleChange('workoutDurationMin', Math.round(v))}
                            />
                        </div>
                    </div>
                </section>

                {/* ── Medical ───────────────────────────────────── */}
                <section className="panel p-6 sm:p-7">
                    <h2 className="font-display text-xl font-semibold uppercase text-slate-900 dark:text-white mb-5 flex items-center gap-2.5">
                        <AlertTriangle size={18} className="text-red-500" />
                        {t.medical}
                    </h2>
                    <label htmlFor="contraindications" className="label">{t.injuries}</label>
                    <textarea
                        id="contraindications"
                        value={userProfile.contraindications}
                        onChange={(e) => handleChange('contraindications', e.target.value)}
                        placeholder={isRu
                            ? 'Например: боль в пояснице, проблемы с коленями, астма…'
                            : 'e.g. lower back pain, bad knees, asthma…'}
                        className="input min-h-[110px] resize-y bg-red-50/40 dark:bg-red-950/10 border-red-100 dark:border-red-900/50"
                    />
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                        {isRu
                            ? 'Тренер учитывает это при подборе упражнений и питания.'
                            : 'The coach takes this into account for every exercise and meal.'}
                    </p>
                </section>

                {/* ── Nutrition ─────────────────────────────────── */}
                <section className="panel p-6 sm:p-7">
                    <h2 className="font-display text-xl font-semibold uppercase text-slate-900 dark:text-white mb-5 flex items-center gap-2.5">
                        <Utensils size={18} className="text-orange-500" />
                        {t.nutritionGoals}
                    </h2>

                    <label htmlFor="dietary-prefs" className="label">{t.dietaryPrefs}</label>
                    <select
                        id="dietary-prefs"
                        value={userProfile.dietaryPreferences}
                        onChange={(e) => handleChange('dietaryPreferences', e.target.value)}
                        className="input"
                    >
                        <optgroup label={isRu ? 'Диеты' : 'Diets'}>
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
                        </optgroup>
                        <optgroup label={isRu ? 'Религиозные ограничения' : 'Religious restrictions'}>
                            <option value="Halal (Islam)">{t.diets.halal}</option>
                            <option value="Kosher (Judaism)">{t.diets.kosher}</option>
                            <option value="Hinduism">{t.diets.hindu}</option>
                            <option value="Christianity">{t.diets.christian}</option>
                            <option value="Buddhism">{t.diets.buddhist}</option>
                        </optgroup>
                    </select>

                    <div className="pt-5 mt-5 border-t border-slate-200/70 dark:border-slate-800">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <span className="relative shrink-0">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={userProfile.useSupplements}
                                    onChange={(e) => handleChange('useSupplements', e.target.checked)}
                                />
                                <span className={`block w-11 h-6 rounded-full transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/25 ${userProfile.useSupplements ? 'bg-brand-400' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                <span className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${userProfile.useSupplements ? 'translate-x-5' : 'translate-x-0'}`} />
                            </span>
                            <span>
                                <span className="block text-sm font-semibold text-slate-800 dark:text-white">{t.useSupplements}</span>
                                <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5">{t.useSupplementsDesc}</span>
                            </span>
                        </label>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ProfileView;
