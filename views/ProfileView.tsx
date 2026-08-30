import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Language, SportPreference, CompetitionTarget } from '../types';
import {
    Save, AlertTriangle, Activity, Calendar, Clock, Utensils, Key, CheckCircle, XCircle,
    Loader2, Wand2, Target, Check, TrendingUp, RefreshCw, Trash2, Eye, EyeOff,
    User as UserIcon, ExternalLink, Plus, Trophy
} from 'lucide-react';
import { validateApiKey, generateWeeklyPlan, describeGeminiError, describeKeyCheck } from '../services/geminiService';
import { getTranslation } from '../utils/translations';
import { archiveFinishedWeek } from '../utils/planHistory';
import { Stage, Reveal, StageStat } from '../components/Stage';
import { DEFAULT_SPORT, SPORT_LIMITS, totalWorkoutsPerWeek, totalMinutesPerWeek, sportNames } from '../utils/profile';
import { DEFAULT_COMPETITION, PHASE_LABELS, phaseForWeeks, weeksUntil } from '../utils/competition';

/** How many fitness goals the plan generator accepts at once. */
const MAX_GOALS = 5;

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
    compact?: boolean;
    onCommit: (value: number) => void;
}> = ({ id, label, value, min, max, step = 1, compact = false, onCommit }) => {
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
            <label
                htmlFor={id}
                className={`label flex items-center gap-1 ${compact ? 'text-[10px] whitespace-nowrap' : 'gap-1.5'}`}
            >
                {label}
            </label>
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
    // Why the check failed, so the field can say more than "invalid key".
    const [keyProblem, setKeyProblem] = useState<{ message: string; detail?: string } | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);
    const checkedRef = useRef(false);

    const t = getTranslation(language).profile;
    const tGoals = getTranslation(language).goals;
    const isRu = language === 'ru';

    const handleCheckKey = async (keyToCheck?: string) => {
        const key = (keyToCheck || tempKey).trim();
        if (!key) return;
        setKeyStatus('checking');
        const result = await validateApiKey(key);
        setKeyStatus(result.ok ? 'valid' : 'invalid');
        setKeyProblem(result.ok ? null : { message: describeKeyCheck(result, language), detail: result.detail });
        if (result.ok) {
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
        setKeyProblem(null);
    };

    const updateSport = (index: number, patch: Partial<SportPreference>) => {
        setUserProfile(prev => ({
            ...prev,
            sports: prev.sports.map((sport, i) => (i === index ? { ...sport, ...patch } : sport)),
        }));
    };

    const addSport = () => {
        setUserProfile(prev => ({ ...prev, sports: [...prev.sports, { ...DEFAULT_SPORT }] }));
    };

    const competition = userProfile.competition ?? DEFAULT_COMPETITION;
    const updateCompetition = (patch: Partial<CompetitionTarget>) => {
        setUserProfile(prev => ({
            ...prev,
            competition: { ...DEFAULT_COMPETITION, ...prev.competition, ...patch },
        }));
    };

    const removeSport = (index: number) => {
        setUserProfile(prev => ({ ...prev, sports: prev.sports.filter((_, i) => i !== index) }));
    };

    const toggleGoal = (goalKey: string) => {
        const currentGoals = userProfile.fitnessGoals || [];
        if (currentGoals.includes(goalKey)) {
            handleChange('fitnessGoals', currentGoals.filter(g => g !== goalKey));
        } else if (currentGoals.length < MAX_GOALS) {
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
            // File the week being replaced before the new plan overwrites it.
            archiveFinishedWeek(userProfile);
            const plan = await generateWeeklyPlan(userProfile, apiKey, language);
            setUserProfile(prev => ({
                ...prev,
                weeklyPlan: plan,
                planLanguage: language,
                planCreatedAt: new Date().toISOString(),
                completedExercises: [],
                isSetup: true
            }));
            setWaterConsumed(0);
            onPlanGenerated();
        } catch (e: any) {
            setGenerateError(describeGeminiError(e, language));
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

    const goalsFull = userProfile.fitnessGoals.length >= MAX_GOALS;
    const competitionWeeks = competition.date ? weeksUntil(competition.date) : NaN;
    const weeklyTotal = totalWorkoutsPerWeek(userProfile);
    const weeklyHours = Math.round(totalMinutesPerWeek(userProfile) / 6) / 10;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Header: the same lit stage the other tabs open with */}
            <Stage>
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                    <Reveal delay={100} className="max-w-xl">
                        <p className="eyebrow text-brand-300">Fit Genius</p>
                        <h1 className="mt-3 font-display text-3xl sm:text-4xl lg:text-[3.25rem] font-semibold
                                       uppercase leading-[0.95] tracking-tight">
                            {userProfile.isSetup ? t.title : (isRu ? 'Добро пожаловать в Fit Genius' : 'Welcome to Fit Genius')}
                        </h1>
                        <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed max-w-[52ch]">
                            {t.subtitle}
                        </p>
                    </Reveal>

                    <Reveal delay={300} from="left" className="shrink-0">
                        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-4 lg:items-end">
                            <div className="flex items-stretch gap-5 rounded-[var(--radius-card)] border border-white/10
                                            bg-white/[0.07] backdrop-blur-xl px-5 py-4">
                                <StageStat
                                    icon={Calendar}
                                    value={weeklyTotal}
                                    label={isRu ? 'трен. в неделю' : 'sessions a week'}
                                />
                                <div className="w-px bg-white/10" aria-hidden="true" />
                                <StageStat
                                    icon={Utensils}
                                    value={userProfile.mealsPerDay}
                                    label={isRu ? 'приёмов пищи' : 'meals a day'}
                                />
                            </div>

                            <button
                                onClick={handleSaveAndGenerate}
                                disabled={isGenerating}
                                className="btn-primary px-6 py-3 justify-center"
                            >
                                {isGenerating ? <Loader2 size={17} className="animate-spin" />
                                    : userProfile.isSetup ? <Save size={17} /> : <Wand2 size={17} />}
                                {isGenerating ? t.generating : (userProfile.isSetup ? t.save : t.generatePlan)}
                            </button>
                        </div>
                    </Reveal>
                </div>
            </Stage>

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
                            onChange={(e) => { setTempKey(e.target.value); setKeyStatus('idle'); setKeyProblem(null); }}
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

                {keyStatus === 'invalid' && keyProblem && (
                    <div className="mt-3 rounded-[var(--radius-control)] border border-red-200 dark:border-red-900/60
                                    bg-red-50 dark:bg-red-950/40 p-3">
                        <p className="text-xs font-semibold text-red-700 dark:text-red-300 flex items-start gap-1.5">
                            <AlertTriangle size={14} className="shrink-0 mt-px" />
                            <span>{keyProblem.message}</span>
                        </p>
                        {keyProblem.detail && (
                            <details className="mt-2">
                                <summary className="text-[11px] text-red-700/70 dark:text-red-300/70 cursor-pointer">
                                    {isRu ? 'Ответ Google' : 'Google response'}
                                </summary>
                                <p className="mt-1 text-[11px] font-mono text-slate-600 dark:text-slate-400 break-words">
                                    {keyProblem.detail}
                                </p>
                            </details>
                        )}
                    </div>
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

                        {/* Each sport carries its own rhythm: a runner who also
                            swims twice a week is not one global number. */}
                        <div>
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <label className="label mb-0">{t.preferredSports}</label>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                    {t.weeklyTotal}: {weeklyTotal} {t.sessionsShort} · {weeklyHours} {isRu ? 'ч' : 'h'}
                                </span>
                            </div>

                            <div className="space-y-2">
                                {userProfile.sports.map((sport, index) => (
                                    <div key={index} className="surface-muted rounded-[var(--radius-control)] p-2.5 space-y-2">
                                        {/* Name on its own line: side by side there was no room for
                                            full labels, and both of them wrapped to two lines. */}
                                        <div className="flex items-center gap-2">
                                            <label htmlFor={`sport-name-${index}`} className="sr-only">{t.sportName}</label>
                                            <input
                                                id={`sport-name-${index}`}
                                                type="text"
                                                value={sport.name}
                                                onChange={(e) => updateSport(index, { name: e.target.value })}
                                                placeholder={isRu ? 'бег' : 'running'}
                                                className="input flex-1 min-w-0"
                                            />
                                            <button
                                                onClick={() => removeSport(index)}
                                                className="btn-danger p-2.5 shrink-0"
                                                title={t.removeSport}
                                                aria-label={`${t.removeSport}: ${sport.name || index + 1}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <NumberField
                                                id={`sport-freq-${index}`}
                                                compact
                                                label={<><Calendar size={11} /> {t.perWeek}</>}
                                                value={sport.timesPerWeek}
                                                min={SPORT_LIMITS.timesPerWeek.min}
                                                max={SPORT_LIMITS.timesPerWeek.max}
                                                onCommit={(v) => updateSport(index, { timesPerWeek: Math.round(v) })}
                                            />
                                            <NumberField
                                                id={`sport-dur-${index}`}
                                                compact
                                                step={5}
                                                label={<><Clock size={11} /> {t.minutes}</>}
                                                value={sport.durationMin}
                                                min={SPORT_LIMITS.durationMin.min}
                                                max={SPORT_LIMITS.durationMin.max}
                                                onCommit={(v) => updateSport(index, { durationMin: Math.round(v) })}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {!userProfile.sports.length && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 py-2">
                                    {t.noSports}
                                </p>
                            )}

                            <button onClick={addSport} className="btn-secondary w-full mt-2">
                                <Plus size={16} /> {t.addSport}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Competition target: turns the plan into a periodised build-up */}
                <div className="card p-6 sm:p-8 md:col-span-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <span className="relative inline-flex shrink-0 mt-0.5">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={competition.enabled}
                                onChange={(e) => updateCompetition({ enabled: e.target.checked })}
                            />
                            <span className="block w-10 h-6 rounded-full transition-colors bg-slate-300 dark:bg-slate-700
                                             peer-checked:bg-brand-300" />
                            <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform
                                             peer-checked:translate-x-4" />
                        </span>
                        <span>
                            <span className="font-display text-lg font-semibold uppercase tracking-wide
                                             text-slate-900 dark:text-white flex items-center gap-2">
                                <Trophy size={17} className="text-brand-700 dark:text-brand-300" />
                                {t.competition}
                            </span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                {t.competitionHint}
                            </span>
                        </span>
                    </label>

                    {competition.enabled && (
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                            <div>
                                <label htmlFor="comp-sport" className="label">{t.competitionSport}</label>
                                <input
                                    id="comp-sport"
                                    type="text"
                                    list="comp-sport-options"
                                    value={competition.sport}
                                    onChange={(e) => updateCompetition({ sport: e.target.value })}
                                    placeholder={sportNames(userProfile)[0] || (isRu ? 'например, бег' : 'e.g. running')}
                                    className="input"
                                />
                                <datalist id="comp-sport-options">
                                    {sportNames(userProfile).map(name => <option key={name} value={name} />)}
                                </datalist>
                            </div>

                            <div>
                                <label htmlFor="comp-date" className="label">{t.competitionDate}</label>
                                <input
                                    id="comp-date"
                                    type="date"
                                    value={competition.date}
                                    min={new Date().toISOString().slice(0, 10)}
                                    onChange={(e) => updateCompetition({ date: e.target.value })}
                                    className="input"
                                />
                            </div>

                            <div>
                                <label htmlFor="comp-goal" className="label">{t.competitionGoal}</label>
                                <input
                                    id="comp-goal"
                                    type="text"
                                    value={competition.goal}
                                    onChange={(e) => updateCompetition({ goal: e.target.value })}
                                    placeholder={isRu ? 'например, полумарафон за 1:45' : 'e.g. half marathon under 1:45'}
                                    className="input"
                                />
                            </div>

                            {competition.date && (
                                <p className="sm:col-span-3 text-[11px] text-slate-500 dark:text-slate-400">
                                    {competitionWeeks < 0
                                        ? t.competitionPast
                                        : `${PHASE_LABELS[language][phaseForWeeks(competitionWeeks)]} · ${
                                            competitionWeeks === 0
                                                ? (isRu ? 'старт на этой неделе' : 'event this week')
                                                : (isRu ? `осталось ${competitionWeeks} нед.` : `${competitionWeeks} week(s) to go`)}`}
                                </p>
                            )}
                        </div>
                    )}
                </div>

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

                    {/* Meal rhythm: drives how many meals the generated plan has. */}
                    <div className="mb-5">
                        <label className="label flex items-center gap-1.5">
                            <Utensils size={12} /> {t.mealsPerDay}
                        </label>
                        <div className="flex flex-wrap gap-2" role="group" aria-label={t.mealsPerDay}>
                            {[2, 3, 4, 5, 6].map(count => {
                                const isSelected = userProfile.mealsPerDay === count;
                                return (
                                    <button
                                        key={count}
                                        onClick={() => handleChange('mealsPerDay', count)}
                                        aria-pressed={isSelected}
                                        className={`chip min-w-11 justify-center ${isSelected
                                            ? 'bg-brand-300 text-slate-950 border-brand-300'
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'}`}
                                    >
                                        {count}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                            {t.mealsPerDayHint}
                        </p>
                    </div>

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
