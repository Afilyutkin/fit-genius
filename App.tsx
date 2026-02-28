import React, { useState } from 'react';
import { Tab, UserProfile, DailyStats, Language, Theme } from './types';
import Sidebar from './components/Sidebar';
import AICoach from './components/AICoach';
import DashboardView from './views/DashboardView';
import WorkoutsView from './views/WorkoutsView';
import NutritionView from './views/NutritionView';
import ProfileView from './views/ProfileView';

// Initial Mock Data
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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PROFILE);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('zenith_user_profile');
    return saved ? JSON.parse(saved) : INITIAL_PROFILE;
  });
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');
  const [apiKey, setApiKeyState] = useState<string>(() => {
    return localStorage.getItem('zenith_gemini_key') || '';
  });
  const [waterConsumed, setWaterConsumed] = useState(() => {
    const saved = localStorage.getItem('zenith_water_consumed');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [weightHistory, setWeightHistory] = useState<{ date: string; weight: number }[]>(() => {
    try {
      const saved = localStorage.getItem('zenith_weight_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return [];
  });

  const prevWeightRef = React.useRef(userProfile.weight);

  // Persist Profile
  React.useEffect(() => {
    localStorage.setItem('zenith_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  // Persist Water
  React.useEffect(() => {
    localStorage.setItem('zenith_water_consumed', waterConsumed.toString());
  }, [waterConsumed]);

  // Seed weight history on first setup
  React.useEffect(() => {
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
  React.useEffect(() => {
    if (!userProfile.isSetup) { prevWeightRef.current = userProfile.weight; return; }
    if (prevWeightRef.current === userProfile.weight) return;
    prevWeightRef.current = userProfile.weight;
    const today = new Date().toISOString().split('T')[0];
    setWeightHistory(prev => {
      const filtered = prev.filter(e => e.date !== today);
      return [...filtered, { date: today, weight: userProfile.weight }].slice(-30);
    });
  }, [userProfile.weight, userProfile.isSetup]);

  // Persist weight history
  React.useEffect(() => {
    localStorage.setItem('zenith_weight_history', JSON.stringify(weightHistory));
  }, [weightHistory]);

  const setApiKey = (key: string) => {
    if (key) {
      localStorage.setItem('zenith_gemini_key', key);
    } else {
      localStorage.removeItem('zenith_gemini_key');
    }
    setApiKeyState(key);
  };

  const toggleExercise = (dayIndex: number, exerciseIndex: number) => {
    const id = `${dayIndex}-${exerciseIndex}`;
    const completed = [...(userProfile.completedExercises || [])];
    const index = completed.indexOf(id);

    let newXp = userProfile.xp;
    if (index === -1) {
      completed.push(id);
      newXp += 50; // Award 50 XP per exercise
    } else {
      completed.splice(index, 1);
      newXp = Math.max(0, newXp - 50);
    }

    // Level up logic
    const nextLevelXp = userProfile.level * 500;
    const newLevel = newXp >= nextLevelXp ? userProfile.level + 1 : userProfile.level;

    setUserProfile({
      ...userProfile,
      completedExercises: completed,
      xp: newXp,
      level: newLevel
    });
  };

  React.useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const handleSignOut = () => {
    localStorage.removeItem('zenith_user_profile');
    localStorage.removeItem('zenith_gemini_key');
    localStorage.removeItem('zenith_water_consumed');
    localStorage.removeItem('zenith_weight_history');
    setUserProfile(INITIAL_PROFILE);
    setApiKeyState('');
    setWaterConsumed(0);
    setWeightHistory([]);
    setActiveTab(Tab.PROFILE);
  };

  const handlePlanGenerated = () => {
    setActiveTab(Tab.WORKOUTS);
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.DASHBOARD:
        return (
          <DashboardView
            stats={DAILY_STATS}
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            language={language}
            weightHistory={weightHistory}
            waterConsumed={waterConsumed}
            setWaterConsumed={setWaterConsumed}
          />
        );
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
          />
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
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

      <main className="flex-1 lg:ml-64 pt-16 pb-20 px-4 lg:p-8 xl:p-12 max-w-[1600px] mx-auto transition-all duration-300">
        {renderContent()}
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
