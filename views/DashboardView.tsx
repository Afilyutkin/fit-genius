import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis } from 'recharts';
import { DailyStats, UserProfile, Language, Achievement } from '../types';
import {
  Flame, Footprints, Clock, Activity, Watch, RefreshCw, Zap, Star,
  Trophy, Target, Scale, Droplet, Check, Users, Crown, Medal, ArrowDown, ArrowUp, Minus, AlertTriangle
} from 'lucide-react';
import { getTranslation } from '../utils/translations';
import { motion, useReducedMotion } from 'motion/react';
import AnimatedNumber from '../components/AnimatedNumber';

interface DashboardProps {
  stats: DailyStats;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  language: Language;
  weightHistory: { date: string; weight: number }[];
  waterConsumed: number;
  setWaterConsumed: React.Dispatch<React.SetStateAction<number>>;
  onAwardXp: (amount: number) => void;
}

const XP_PER_LEVEL = 500;

/* Data-encoding hues, distinct at a glance and legible on both themes */
const RING_COLORS = {
  move: '#ff4d2e',      // flame  - energy burned
  exercise: '#b7ec1e',  // volt   - training minutes
  stand: '#12c2e0',     // aqua   - standing hours
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase() || '?';

const DashboardView: React.FC<DashboardProps> = ({
  stats, userProfile, setUserProfile, language, weightHistory, waterConsumed, setWaterConsumed, onAwardXp
}) => {
  const t = getTranslation(language).dashboard;
  const AT = getTranslation(language).achievements;
  const isRu = language === 'ru';

  const [isWatchConnected, setIsWatchConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [newWeight, setNewWeight] = useState('');

  const today = new Date().toLocaleDateString(isRu ? 'ru-RU' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleConnectWatch = async () => {
    const nav = navigator as any;
    setWatchError(null);

    if (!nav.bluetooth) {
      setWatchError(isRu
        ? 'Web Bluetooth не поддерживается этим браузером. Откройте приложение в Chrome или Edge.'
        : 'Web Bluetooth is not supported by this browser. Try Chrome or Edge.');
      return;
    }

    setIsSyncing(true);
    try {
      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }, { services: ['fitness_machine'] }],
        optionalServices: ['battery_service', 'device_information']
      });
      await device.gatt?.connect();
      setIsWatchConnected(true);
      setLastSync(stamp());
      device.addEventListener('gattserverdisconnected', () => setIsWatchConnected(false));
    } catch (error) {
      // The previous version faked a successful connection here, so a real
      // failure still showed made-up "live" metrics.
      if ((error as Error).name !== 'NotFoundError') {
        setWatchError(isRu
          ? `Не удалось подключить устройство: ${(error as Error).message}`
          : `Could not connect the device: ${(error as Error).message}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSync = () => {
    setIsSyncing(true);
    window.setTimeout(() => {
      setIsSyncing(false);
      setLastSync(stamp());
    }, 1200);
  };

  const handleUpdateWeight = () => {
    const w = parseFloat(newWeight.replace(',', '.'));
    if (!Number.isFinite(w) || w < 20 || w > 400) return;
    setUserProfile(prev => ({ ...prev, weight: Math.round(w * 10) / 10 }));
    setNewWeight('');
  };

  const handleAddWater = (amount: number) => {
    setWaterConsumed(prev => prev + amount);
    onAwardXp(Math.floor(amount / 50));
  };

  const waterGoal = userProfile.weight ? Math.round(userProfile.weight * 35) : 2500;
  const waterPercentage = Math.min((waterConsumed / waterGoal) * 100, 100);

  const rings = [
    { key: 'move', label: t.move, current: stats.caloriesBurned, goal: stats.caloriesGoal, color: RING_COLORS.move },
    { key: 'exercise', label: t.exercise, current: stats.moveMinutes, goal: stats.moveGoal, color: RING_COLORS.exercise },
    { key: 'stand', label: t.stand, current: stats.standHours, goal: stats.standGoal, color: RING_COLORS.stand },
  ];

  const weightStart = weightHistory.length > 0 ? weightHistory[0].weight : userProfile.weight;
  const weightChange = Math.round((userProfile.weight - weightStart) * 10) / 10;
  const WeightIcon = weightChange < 0 ? ArrowDown : weightChange > 0 ? ArrowUp : Minus;
  const weightBadgeClass = weightChange < 0
    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
    : weightChange > 0
      ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';

  const chartData = weightHistory.map(entry => {
    const [y, m, d] = entry.date.split('-').map(Number);
    const date = new Date(y, m - 1, d).toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' });
    return { date, weight: entry.weight };
  });

  const completedExercisesCount = userProfile.completedExercises?.length || 0;
  const totalExercises = userProfile.weeklyPlan?.reduce((sum, day) => sum + (day.exercises?.length || 0), 0) ?? 0;

  // Achievements now reflect real activity instead of being hard-coded as unlocked.
  const achievements: Achievement[] = [
    {
      id: 'first-step',
      title: isRu ? 'Первый шаг' : 'First Step',
      description: isRu ? 'Выполните первое упражнение' : 'Complete your first exercise',
      icon: 'check', unlocked: completedExercisesCount >= 1,
      progress: Math.min(completedExercisesCount, 1), total: 1, xpReward: 100,
    },
    {
      id: 'exercise-master',
      title: isRu ? 'Мастер упражнений' : 'Exercise Master',
      description: isRu ? 'Выполните 10 упражнений' : 'Complete 10 exercises',
      icon: 'run', unlocked: completedExercisesCount >= 10,
      progress: Math.min(completedExercisesCount, 10), total: 10, xpReward: 1000,
    },
    {
      id: 'week-done',
      title: isRu ? 'Неделя закрыта' : 'Week Complete',
      description: isRu ? 'Выполните все упражнения недели' : 'Complete every exercise this week',
      icon: 'trophy', unlocked: totalExercises > 0 && completedExercisesCount >= totalExercises,
      progress: Math.min(completedExercisesCount, Math.max(totalExercises, 1)),
      total: Math.max(totalExercises, 1), xpReward: 1500,
    },
    {
      id: 'hydrated',
      title: isRu ? 'Гидратация' : 'Well Hydrated',
      description: isRu ? 'Выполните дневную норму воды' : 'Hit your daily water goal',
      icon: 'droplet', unlocked: waterConsumed >= waterGoal,
      progress: Math.min(waterConsumed, waterGoal), total: waterGoal, xpReward: 300,
    },
  ];

  const activeQuests = achievements.filter(a => !a.unlocked).slice(0, 3);
  const questsToShow = activeQuests.length ? activeQuests : achievements.slice(0, 2);

  const currentLevel = userProfile.level;
  const currentXP = userProfile.xp;
  const xpIntoLevel = currentXP % XP_PER_LEVEL;
  const progressPercent = Math.min((xpIntoLevel / XP_PER_LEVEL) * 100, 100);

  const leaderboard = [
    { name: 'Alex M.', score: 12450, isMe: false },
    { name: 'Sarah K.', score: 11200, isMe: false },
    { name: userProfile.name || (isRu ? 'Вы' : 'You'), score: currentXP, isMe: true },
  ].sort((a, b) => b.score - a.score).map((p, i) => ({ ...p, rank: i + 1 }));

  const StatCard = ({ title, value, unit, icon: Icon, color, bg, subValue }: {
    title: string; value: string | number; unit: string;
    icon: React.ElementType; color: string; bg: string; subValue: string;
  }) => (
    <div className="card card-hover p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`p-2 rounded-xl ${bg}`}>
          <Icon size={16} className={color} />
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{title}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="stat text-2xl text-slate-900 dark:text-white">{value}</span>
        <span className="eyebrow text-[10px]">{unit}</span>
      </div>
      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{subValue}</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between gap-5">
        <div className="flex-1 min-w-0">
          <p className="eyebrow capitalize">{today}</p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold uppercase leading-[0.95]
                         text-slate-900 dark:text-white mt-2">
            {t.greeting}, {userProfile.name || (isRu ? 'Атлет' : 'Athlete')}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="chip bg-brand-300/15 border-brand-500/30 text-brand-800 dark:text-brand-300">
              <Flame size={13} fill="currentColor" />
              <span className="stat text-sm">{completedExercisesCount}</span>
              {isRu ? 'упражнений' : 'exercises done'}
            </span>
            {totalExercises > 0 && (
              <span className="chip surface-muted text-slate-600 dark:text-slate-300">
                <Trophy size={13} className="text-slate-400" />
                <span className="stat text-sm">{Math.round((completedExercisesCount / totalExercises) * 100)}%</span>
                {isRu ? 'плана' : 'of plan'}
              </span>
            )}
          </div>
        </div>

        {/* Level card */}
        <div className="lg:w-[360px] shrink-0 rounded-[var(--radius-panel)] p-6 text-white relative overflow-hidden
                        bg-slate-950 border border-slate-800">
          <div className="hatch absolute -top-6 -right-6 w-48 h-48 rotate-12 opacity-70" aria-hidden="true" />
          <Star size={110} className="absolute -bottom-6 -right-6 text-white/5 rotate-12" aria-hidden="true" />
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[var(--radius-control)] bg-brand-300 flex items-center justify-center">
                  <Trophy size={22} className="text-slate-950" />
                </div>
                <div>
                  <div className="eyebrow text-[10px] text-slate-400">{AT.level}</div>
                  <div className="stat text-3xl mt-1">{currentLevel}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="eyebrow text-[10px] text-slate-400">XP</div>
                <div className="stat text-3xl mt-1 text-brand-300">
                  <AnimatedNumber value={currentXP} locale={isRu ? 'ru-RU' : 'en-US'} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between eyebrow text-[10px] text-slate-400">
                <span>{AT.progressTo} {currentLevel + 1}</span>
                <span className="tabular-nums">{xpIntoLevel} / {XP_PER_LEVEL}</span>
              </div>
              <div className="meter h-2 bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="meter-fill"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left column ───────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Activity rings */}
            <div className="card p-6 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-display text-lg font-semibold uppercase text-slate-900 dark:text-white">{t.activity}</h2>
                <div className={`p-2 rounded-[var(--radius-control)] ${isWatchConnected
                  ? 'bg-brand-300 text-slate-950'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  <Watch size={16} />
                </div>
              </div>

              <div className="relative w-full max-w-[190px] aspect-square mx-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    {rings.map((ring, i) => (
                      <Pie
                        key={ring.key}
                        data={[
                          { value: Math.min(ring.current, ring.goal) },
                          { value: Math.max(0, ring.goal - ring.current) },
                        ]}
                        cx="50%" cy="50%"
                        innerRadius={80 - i * 20}
                        outerRadius={95 - i * 20}
                        startAngle={90} endAngle={-270}
                        dataKey="value" cornerRadius={6} stroke="none"
                        isAnimationActive={false}
                      >
                        <Cell fill={ring.color} />
                        {/* Track follows the theme — it used to be a fixed pastel
                            that disappeared on dark backgrounds. */}
                        <Cell className="fill-slate-100 dark:fill-slate-800" />
                      </Pie>
                    ))}
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <Flame size={18} className="text-flame-500 mb-1" fill="currentColor" />
                  <div className="stat text-3xl text-slate-900 dark:text-white">
                    {stats.caloriesBurned}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-6">
                {rings.map(ring => {
                  const pct = ring.goal > 0 ? Math.min(100, (ring.current / ring.goal) * 100) : 0;
                  return (
                    <div key={ring.key} className="text-center">
                      <p className="eyebrow mb-1.5">{ring.label}</p>
                      {/* Inline colours: the old `${color}/20` class name was built at
                          runtime, so Tailwind never generated it and the bars were blank. */}
                      <div className="meter h-1.5 w-full mb-1.5">
                        <motion.div
                          className="meter-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                          style={{ backgroundColor: ring.color }}
                        />
                      </div>
                      <p className="stat text-sm text-slate-700 dark:text-slate-300">
                        {ring.current}<span className="text-slate-500 dark:text-slate-400">/{ring.goal}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weight control */}
            <div className="card p-6 flex flex-col">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-[var(--radius-control)] bg-flame-500/15">
                    <Scale size={18} className="text-flame-600 dark:text-flame-400" />
                  </div>
                  <h2 className="font-display text-lg font-semibold uppercase text-slate-900 dark:text-white">{t.weightControl}</h2>
                </div>
                <span className={`chip border-transparent ${weightBadgeClass}`}>
                  <WeightIcon size={12} />
                  {Math.abs(weightChange)} kg
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="stat text-5xl text-slate-900 dark:text-white">
                  <AnimatedNumber value={userProfile.weight} decimals={userProfile.weight % 1 === 0 ? 0 : 1} />
                </span>
                <span className="eyebrow">KG</span>
              </div>

              <div className="relative">
                <label htmlFor="new-weight" className="sr-only">{t.enterWeight}</label>
                <input
                  id="new-weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateWeight(); }}
                  placeholder={t.enterWeight}
                  className="input pr-20 py-3"
                />
                <button
                  onClick={handleUpdateWeight}
                  disabled={!newWeight}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 btn-primary px-4 py-2 text-xs"
                >
                  {isRu ? 'ОК' : 'SET'}
                </button>
              </div>

              <div className="h-24 w-full mt-5">
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                      <defs>
                        <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid rgba(148,163,184,0.3)',
                          background: 'rgba(15,23,42,0.92)',
                          color: '#fff',
                          fontSize: 12,
                        }}
                        labelStyle={{ color: '#cbd5e1' }}
                        formatter={(value: any) => [`${value} kg`, '']}
                      />
                      <Area type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={2} fill="url(#weightGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-600 dark:text-slate-400 text-center px-4">
                    {isRu ? 'Добавьте вес, чтобы увидеть динамику' : 'Log your weight to see the trend'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hydration + quick stats */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 card p-6">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-[var(--radius-control)] bg-aqua-500/15">
                      <Droplet size={18} className="text-aqua-600 dark:text-aqua-400" />
                    </div>
                    <h2 className="font-display text-lg font-semibold uppercase text-slate-900 dark:text-white">
                      {isRu ? 'Гидратация' : 'Hydration'}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {isRu ? 'Цель на сегодня' : 'Goal for today'}:{' '}
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">{waterGoal} ml</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="stat text-3xl text-slate-900 dark:text-white">
                    <AnimatedNumber value={Math.round(waterPercentage)} suffix="%" />
                  </div>
                  <div className="stat text-sm text-aqua-700 dark:text-aqua-400 mt-1">
                    <AnimatedNumber value={waterConsumed} /> ml
                  </div>
                </div>
              </div>

              <div className="meter my-6 h-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${waterPercentage}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="meter-fill bg-aqua-500"
                />
              </div>

              <div className="flex gap-3">
                {[250, 500].map(ml => (
                  <button
                    key={ml}
                    onClick={() => handleAddWater(ml)}
                    className="flex-1 btn-secondary py-3"
                  >
                    <Zap size={14} className="text-aqua-500" fill="currentColor" />
                    +{ml} ml
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
              <StatCard title={t.heartRate} value={isWatchConnected ? '74' : '-'} unit="BPM" icon={Activity}
                color="text-pink-600 dark:text-pink-400" bg="bg-pink-100 dark:bg-pink-950/50"
                subValue={isWatchConnected ? 'Resting: 64' : (isRu ? 'Нет устройства' : 'No device')} />
              <StatCard title={t.steps} value={isWatchConnected ? '8,642' : '-'} unit={isRu ? 'шаг.' : 'steps'} icon={Footprints}
                color="text-orange-600 dark:text-orange-400" bg="bg-orange-100 dark:bg-orange-950/50"
                subValue={isWatchConnected ? 'Goal: 10,000' : (isRu ? 'Нет устройства' : 'No device')} />
              <StatCard title={t.activeBurn} value={stats.caloriesBurned} unit={isRu ? 'ккал' : 'kcal'} icon={Flame}
                color="text-red-600 dark:text-red-400" bg="bg-red-100 dark:bg-red-950/50"
                subValue={`${isRu ? 'Цель' : 'Goal'}: ${stats.caloriesGoal}`} />
              <StatCard title={t.sleep} value={isWatchConnected ? '7h 12m' : '-'} unit="" icon={Clock}
                color="text-slate-500 dark:text-slate-400" bg="bg-slate-100 dark:bg-slate-800"
                subValue={isWatchConnected ? 'Deep: 1h 45m' : (isRu ? 'Нет устройства' : 'No device')} />
            </div>
          </div>

          {/* Smartwatch */}
          <div className={`p-6 rounded-[var(--radius-card)] border transition-colors ${isWatchConnected
            ? 'bg-slate-950 border-brand-500/50 text-white'
            : 'card'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-[var(--radius-control)] flex items-center justify-center shrink-0 ${isWatchConnected
                  ? 'bg-brand-300'
                  : 'bg-slate-100 dark:bg-slate-800'}`}>
                  <Watch size={24} className={isWatchConnected ? 'text-slate-950' : 'text-slate-400'} />
                </div>
                <div>
                  <h3 className={`font-display text-lg font-semibold uppercase ${isWatchConnected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {isWatchConnected ? t.watchConnected : t.connectWatch}
                  </h3>
                  <p className={`text-xs mt-0.5 ${isWatchConnected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isWatchConnected ? `${t.lastSync}: ${lastSync}` : t.connectPrompt}
                  </p>
                </div>
              </div>
              <button
                onClick={isWatchConnected ? handleSync : handleConnectWatch}
                disabled={isSyncing}
                className="w-full sm:w-auto btn-primary px-6 py-3"
              >
                {isSyncing && <RefreshCw size={16} className="animate-spin" />}
                {isWatchConnected ? (isRu ? 'Синхронизировать' : 'Sync now') : t.connectDevice}
              </button>
            </div>

            {watchError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl p-3.5 text-sm
                              bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300
                              border border-red-200 dark:border-red-900/60">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span className="break-words">{watchError}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ──────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quests */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Target size={20} className="text-brand-700 dark:text-brand-400" />
              <h2 className="font-display text-lg font-semibold uppercase text-slate-900 dark:text-white">{AT.activeQuests}</h2>
            </div>
            <div className="space-y-3">
              {questsToShow.map((quest) => {
                const pct = quest.total > 0 ? Math.min(100, (quest.progress / quest.total) * 100) : 0;
                return (
                  <div key={quest.id} className="surface-muted rounded-2xl p-4">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{quest.title}</h3>
                      <span className="stat text-xs px-2 py-1 rounded-md shrink-0
                                       bg-brand-300/20 text-brand-900 dark:text-brand-300">
                        +{quest.xpReward} XP
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{quest.description}</p>
                    <div className="flex items-center gap-3">
                      <div className="meter flex-1 h-1.5">
                        <div className="meter-fill transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 tabular-nums shrink-0">
                        {quest.unlocked
                          ? <Check size={12} className="text-brand-700 dark:text-brand-400" />
                          : `${quest.progress}/${quest.total}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Users size={20} className="text-aqua-500" />
              <h2 className="font-display text-lg font-semibold uppercase text-slate-900 dark:text-white">{AT.leaderboard}</h2>
            </div>
            <div className="space-y-2">
              {leaderboard.map((player) => (
                <div
                  key={player.rank}
                  className={`flex items-center justify-between p-3 rounded-[var(--radius-control)] transition-colors ${player.isMe
                    ? 'bg-brand-300 text-slate-950'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`stat w-4 text-sm shrink-0 ${player.isMe
                      ? 'text-slate-950'
                      : player.rank === 1 ? 'text-brand-800 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {player.rank}
                    </span>
                    {/* Initials avatar — no third-party image requests. */}
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${player.isMe
                      ? 'bg-slate-950/15 text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                      {initials(player.name)}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${player.isMe ? 'text-slate-950' : 'text-slate-900 dark:text-white'}`}>
                        {player.name}
                      </p>
                      <p className={`text-[11px] tabular-nums ${player.isMe ? 'text-slate-950/70' : 'text-slate-600 dark:text-slate-400'}`}>
                        {player.score.toLocaleString()} XP
                      </p>
                    </div>
                  </div>
                  {player.rank === 1 && (
                    <Crown size={15} className={player.isMe ? 'text-slate-950' : 'text-brand-800 dark:text-brand-400'} fill="currentColor" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rarest achievement */}
          <div className="rounded-[var(--radius-card)] p-7 text-center relative overflow-hidden
                          bg-slate-950 border border-slate-800">
            <div className="hatch absolute -top-8 -right-8 w-40 h-40 rotate-12 opacity-70" aria-hidden="true" />
            <div className="relative z-10">
              <div className="eyebrow text-brand-300 mb-4">{AT.rarest}</div>
              <div className="inline-flex p-4 rounded-[var(--radius-control)] bg-brand-300/15 border border-brand-300/25 mb-4">
                <Medal size={34} className="text-brand-300" />
              </div>
              <h3 className="font-display text-xl font-semibold uppercase text-white mb-1">Titan Runner</h3>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{AT.rarestPercent}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
