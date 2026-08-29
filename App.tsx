import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tab, UserProfile, DailyStats, Language, Theme } from './types';
import { normalizeWeeklyPlan } from './services/geminiService';
import Sidebar from './components/Sidebar';
import AICoach from './components/AICoach';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardView from './views/DashboardView';
import WorkoutsView from './views/WorkoutsView';
import NutritionView from './views/NutritionView';
import ProfileView from './views/ProfileView';

const STORAGE_KEYS = {
  profile: 'zenith_user_profile',
  apiKey: 'zenith_gemini_key',
  water: 'zenith_water',
  weight: 'zenith_weight_history',
  theme: 'zenith_theme',
  language: 'zenith_language',
} as const;

const INITIAL_PROFILE: UserProfile = {
  name: '',
  level: 1,
  xp: 0,
  weight: 70,
  height: 175,
  age: 30,
  gender: 'Female',
  fitnessGoals: ['General Health'],
  fitnessLevel: 'Beginner',
  contraindications: '',
  preferredSports: ['Running'],
  workoutsPerWeek: 3,
  workoutDurationMin: 45,
  dietaryPreferences: 'Balanced',
  activityLevel: 'Moderate',
  isSetup: false,
  weeklyPlan: null,
  completedExercises: [],
  useSupplements: false
};

const DAILY_STATS: DailyStats = {
  caloriesBurned: 540,
  caloriesGoal: 600,
  moveMinutes: 25,
  moveGoal: 30,
  standHours: 10,
  standGoal: 12,
  waterConsumed: 0
};

const XP_PER_LEVEL = 500;
const todayKey = () => new Date().toISOString().split('T')[0];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Corrupted storage used to throw during the very first render → white screen.
    console.warn(`[Fit Genius] Could not read "${key}" from storage; using defaults.`);
    return fallback;
  }
}

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn(`[Fit Genius] Could not persist "${key}" (storage full or blocked).`);
  }
};

/**
 * Profiles saved by older versions can be missing fields the UI reads directly
 * (fitnessGoals, completedExercises…), so merge them onto the current defaults
 * and re-normalize the stored plan.
 */
const hydrateProfile = (raw: any): UserProfile => {
  if (!raw || typeof raw !== 'object') return INITIAL_PROFILE;
  const merged: UserProfile = { ...INITIAL_PROFILE, ...raw };
  merged.fitnessGoals = Array.isArray(raw.fitnessGoals) && raw.fitnessGoals.length
    ? raw.fitnessGoals
    : INITIAL_PROFILE.fitnessGoals;
  merged.preferredSports = Array.isArray(raw.preferredSports) ? raw.preferredSports : [];
  merged.completedExercises = Array.isArray(raw.completedExercises) ? raw.completedExercises : [];
  merged.weeklyPlan = Array.isArray(raw.weeklyPlan) && raw.weeklyPlan.length
    ? normalizeWeeklyPlan(raw.weeklyPlan, raw.planLanguage === 'ru' ? 'ru' : 'en')
    : null;
  merged.xp = Number.isFinite(raw.xp) ? raw.xp : 0;
  merged.level = Number.isFinite(raw.level) && raw.level > 0 ? raw.level : 1;
  return merged;
};

/** XP is cumulative, so a single reward can cross more than one level at once. */
const levelForXp = (xp: number): number => Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PROFILE);

  const [userProfile, setUserProfile] = useState<UserProfile>(() =>
    hydrateProfile(readJson<any>(STORAGE_KEYS.profile, null))
  );

  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.language);
    if (saved === 'en' || saved === 'ru') return saved;
    return navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [apiKey, setApiKeyState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEYS.apiKey) || ''
  );

  // Hydration is a daily goal — a value carried over from yesterday is wrong.
  const [waterConsumed, setWaterConsumed] = useState<number>(() => {
    const saved = readJson<{ date: string; ml: number } | null>(STORAGE_KEYS.water, null);
    return saved && saved.date === todayKey() && Number.isFinite(saved.ml) ? saved.ml : 0;
  });

  const [weightHistory, setWeightHistory] = useState<{ date: string; weight: number }[]>(() => {
    const saved = readJson<{ date: string; weight: number }[]>(STORAGE_KEYS.weight, []);
    return Array.isArray(saved) ? saved.filter(e => e && e.date && Number.isFinite(e.weight)) : [];
  });

  const prevWeightRef = useRef(userProfile.weight);

  // ── Persistence ────────────────────────────────────────────
  useEffect(() => { writeJson(STORAGE_KEYS.profile, userProfile); }, [userProfile]);
  useEffect(() => { writeJson(STORAGE_KEYS.weight, weightHistory); }, [weightHistory]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.language, language); }, [language]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.theme, theme); }, [theme]);
  useEffect(() => {
    writeJson(STORAGE_KEYS.water, { date: todayKey(), ml: waterConsumed });
  }, [waterConsumed]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    // Chromium does not reliably recalculate descendants styled through the
    // `dark:` variant when this class changes: backgrounds updated while text
    // stayed painted in the previous theme's colours. Detaching the root from
    // layout for one synchronous pass rebuilds the style tree. Both writes
    // happen in the same task with no paint in between, so nothing flashes.
    const previousDisplay = root.style.display;
    root.style.display = 'none';
    void root.offsetHeight;
    root.style.display = previousDisplay;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Reset hydration when the app stays open across midnight.
  useEffect(() => {
    let currentDay = todayKey();
    const id = window.setInterval(() => {
      if (todayKey() !== currentDay) {
        currentDay = todayKey();
        setWaterConsumed(0);
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Seed weight history on first setup
  useEffect(() => {
    if (!userProfile.isSetup || weightHistory.length > 0) return;
    const startWeight = Math.round((userProfile.weight + 3 + Math.random() * 2) * 10) / 10;
    const history: { date: string; weight: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const w = Math.round((startWeight - ((startWeight - userProfile.weight) * (7 - i) / 7)) * 10) / 10;
      history.push({ date: d.toISOString().split('T')[0], weight: w });
    }
    setWeightHistory(history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile.isSetup]);

  // Track weight changes
  useEffect(() => {
    if (!userProfile.isSetup) { prevWeightRef.current = userProfile.weight; return; }
    if (prevWeightRef.current === userProfile.weight) return;
    if (!Number.isFinite(userProfile.weight) || userProfile.weight <= 0) return;
    prevWeightRef.current = userProfile.weight;
    const today = todayKey();
    setWeightHistory(prev => {
      const filtered = prev.filter(e => e.date !== today);
      return [...filtered, { date: today, weight: userProfile.weight }].slice(-30);
    });
  }, [userProfile.weight, userProfile.isSetup]);

  const setApiKey = useCallback((key: string) => {
    if (key) localStorage.setItem(STORAGE_KEYS.apiKey, key);
    else localStorage.removeItem(STORAGE_KEYS.apiKey);
    setApiKeyState(key);
  }, []);

  /** Shared XP grant — keeps XP and level consistent across every screen. */
  const awardXp = useCallback((amount: number) => {
    setUserProfile(prev => {
      const xp = Math.max(0, prev.xp + amount);
      return { ...prev, xp, level: levelForXp(xp) };
    });
  }, []);

  const toggleExercise = useCallback((dayIndex: number, exerciseIndex: number) => {
    const id = `${dayIndex}-${exerciseIndex}`;
    // Functional update: the previous version read a captured `userProfile` and
    // could drop XP earned by another action in the same tick.
    setUserProfile(prev => {
      const completed = [...(prev.completedExercises || [])];
      const index = completed.indexOf(id);
      let xp = prev.xp;

      if (index === -1) {
        completed.push(id);
        xp += 50;
      } else {
        completed.splice(index, 1);
        xp = Math.max(0, xp - 50);
      }

      return { ...prev, completedExercises: completed, xp, level: levelForXp(xp) };
    });
  }, []);

  const handleSignOut = useCallback(() => {
    const confirmed = window.confirm(
      language === 'ru'
        ? 'Выйти и удалить профиль, план и историю веса с этого устройства?'
        : 'Sign out and erase your profile, plan and weight history from this device?'
    );
    if (!confirmed) return;

    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    setUserProfile(INITIAL_PROFILE);
    setApiKeyState('');
    setWaterConsumed(0);
    setWeightHistory([]);
    setActiveTab(Tab.PROFILE);
  }, [language]);

  const handlePlanGenerated = useCallback(() => {
    setActiveTab(Tab.WORKOUTS);
  }, []);

  // A locked tab must never stay selected after the profile is reset.
  useEffect(() => {
    if (!userProfile.isSetup && activeTab !== Tab.PROFILE) setActiveTab(Tab.PROFILE);
  }, [userProfile.isSetup, activeTab]);

  const content = useMemo(() => {
    switch (activeTab) {
      case Tab.WORKOUTS:
        return (
          <WorkoutsView
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            apiKey={apiKey}
            language={language}
            onToggleExercise={toggleExercise}
          />
        );
      case Tab.NUTRITION:
        return (
          <NutritionView
            language={language}
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            apiKey={apiKey}
            waterConsumed={waterConsumed}
            setWaterConsumed={setWaterConsumed}
            onAwardXp={awardXp}
          />
        );
      case Tab.PROFILE:
        return (
          <ProfileView
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            apiKey={apiKey}
            setApiKey={setApiKey}
            setWaterConsumed={setWaterConsumed}
            language={language}
            onPlanGenerated={handlePlanGenerated}
          />
        );
      case Tab.DASHBOARD:
      default:
        return (
          <DashboardView
            stats={DAILY_STATS}
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            language={language}
            weightHistory={weightHistory}
            waterConsumed={waterConsumed}
            setWaterConsumed={setWaterConsumed}
            onAwardXp={awardXp}
          />
        );
    }
  }, [activeTab, userProfile, apiKey, language, waterConsumed, weightHistory, awardXp, setApiKey, toggleExercise, handlePlanGenerated]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-brand-600 focus:text-white focus:font-semibold"
      >
        {language === 'ru' ? 'К основному содержимому' : 'Skip to main content'}
      </a>

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={language}
        setLanguage={setLanguage}
        theme={theme}
        setTheme={setTheme}
        isSetup={userProfile.isSetup}
        onSignOut={handleSignOut}
      />

      <main id="main-content" className="lg:pl-64 pt-16 lg:pt-0 pb-24 lg:pb-0">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          <ErrorBoundary key={activeTab} language={language}>
            {content}
          </ErrorBoundary>
        </div>
      </main>

      {userProfile.isSetup && (
        <AICoach
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          apiKey={apiKey}
          language={language}
        />
      )}
    </div>
  );
};

export default App;
