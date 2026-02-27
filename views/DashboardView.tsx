import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { DailyStats, UserProfile, Language, Achievement } from '../types';
import {
  Flame, Footprints, Clock, Activity, Watch, RefreshCw, Smartphone, Bluetooth, Zap, Star,
  Trophy, Target, Scale, Droplet, TrendingUp, ChevronRight, Check, Lock, Users, Crown, Medal, ArrowDown, ArrowUp
} from 'lucide-react';
import { getTranslation } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  stats: DailyStats;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  language: Language;
  weightHistory: { date: string; weight: number }[];
  waterConsumed: number;
  setWaterConsumed: React.Dispatch<React.SetStateAction<number>>;
}

const iconBgColor: Record<string, string> = {
  'text-pink-600': 'bg-pink-100 dark:bg-pink-900/20',
  'text-orange-600': 'bg-orange-100 dark:bg-orange-900/20',
  'text-red-600': 'bg-red-100 dark:bg-red-900/20',
  'text-indigo-600': 'bg-indigo-100 dark:bg-indigo-900/20',
};

const DashboardView: React.FC<DashboardProps> = ({
  stats, userProfile, setUserProfile, language, weightHistory, waterConsumed, setWaterConsumed
}) => {
  const t = getTranslation(language).dashboard;
  const AT = getTranslation(language).achievements;
  const [isWatchConnected, setIsWatchConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [newWeight, setNewWeight] = useState('');
  const [isWeightUpdating, setIsWeightUpdating] = useState(false);

  const today = new Date().toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  const handleConnectWatch = async () => {
    const nav = navigator as any;
    if (!nav.bluetooth) {
      alert(language === 'ru' ? 'Bluetooth не поддерживается вашим браузером' : 'Bluetooth is not supported by your browser');
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
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      device.addEventListener('gattserverdisconnected', () => setIsWatchConnected(false));
    } catch (error) {
      if ((error as Error).name !== 'NotFoundError') {
        setTimeout(() => {
          setIsWatchConnected(true);
          setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }, 1000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1500);
  };

  const handleUpdateWeight = () => {
    const w = parseFloat(newWeight);
    if (!isNaN(w) && w > 0) {
      setIsWeightUpdating(true);
      setTimeout(() => {
        setUserProfile(prev => ({ ...prev, weight: w }));
        setNewWeight('');
        setIsWeightUpdating(false);
      }, 800);
    }
  };

  const handleAddWater = (amount: number) => {
    setWaterConsumed(prev => prev + amount);
    // Award 5 XP for every 250ml
    const xpReward = Math.floor(amount / 50);
    setUserProfile(prev => {
      const newXp = prev.xp + xpReward;
      const nextLevelXp = prev.level * 500;
      const newLevel = newXp >= nextLevelXp ? prev.level + 1 : prev.level;
      return { ...prev, xp: newXp, level: newLevel };
    });
  };

  const waterGoal = userProfile.weight ? Math.round(userProfile.weight * 35) : 2500;
  const waterPercentage = Math.min((waterConsumed / waterGoal) * 100, 100);

  const moveData = [{ value: stats.caloriesBurned }, { value: Math.max(0, stats.caloriesGoal - stats.caloriesBurned) }];
  const exerciseData = [{ value: stats.moveMinutes }, { value: Math.max(0, stats.moveGoal - stats.moveMinutes) }];
  const standData = [{ value: stats.standHours }, { value: Math.max(0, stats.standGoal - stats.standHours) }];

  const weightStart = weightHistory.length > 0 ? weightHistory[0].weight : userProfile.weight;
  const weightChange = Math.round((userProfile.weight - weightStart) * 10) / 10;
  const weightDown = weightChange < 0;

  const chartData = weightHistory.map(entry => {
    const [y, m, d] = entry.date.split('-').map(Number);
    const date = new Date(y, m - 1, d).toLocaleDateString(
      language === 'ru' ? 'ru-RU' : 'en-US',
      { month: 'short', day: 'numeric' }
    );
    return { date, weight: entry.weight };
  });

  const completedExercisesCount = userProfile.completedExercises?.length || 0;
  const achievements: Achievement[] = [
    { id: '1', title: language === 'ru' ? 'Ранняя пташка' : 'Early Riser', description: language === 'ru' ? 'Выполните 5 тренировок до 8 утра' : 'Complete 5 workouts before 8 AM', icon: 'sun', unlocked: true, progress: 5, total: 5, xpReward: 500 },
    { id: '2', title: language === 'ru' ? 'Мастер упражнений' : 'Exercise Master', description: language === 'ru' ? 'Выполните 10 упражнений' : 'Complete 10 exercises', icon: 'run', unlocked: completedExercisesCount >= 10, progress: Math.min(completedExercisesCount, 10), total: 10, xpReward: 1000 },
    { id: '4', title: language === 'ru' ? 'Железный атлет' : 'Iron Lifter', description: language === 'ru' ? 'Поднимите 10,000кг суммарно' : 'Lift 10,000kg total volume', icon: 'weight', unlocked: true, progress: 10000, total: 10000, xpReward: 800 },
  ];

  const currentLevel = userProfile.level;
  const xpForNextLevel = currentLevel * 500;
  const currentXP = userProfile.xp;
  const progressPercent = Math.min((currentXP / xpForNextLevel) * 100, 100);

  const leaderboard = [
    { name: 'Alex M.', score: 12450, avatar: 'https://picsum.photos/seed/1/40/40' },
    { name: 'Sarah K.', score: 11200, avatar: 'https://picsum.photos/seed/2/40/40' },
    { name: userProfile.name || (language === 'ru' ? 'Вы' : 'You'), score: currentXP, avatar: 'https://picsum.photos/seed/me/40/40', isMe: true },
  ].sort((a, b) => b.score - a.score).map((p, i) => ({ ...p, rank: i + 1 }));

  const StatCard = ({ title, value, unit, icon: Icon, color, subValue }: {
    title: string; value: string | number; unit: string;
    icon: React.ElementType; color: string; subValue: string;
  }) => (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition-all duration-200 active:scale-[0.98]">
      <div className="absolute top-0 right-0 p-3 opacity-[0.07] group-hover:opacity-[0.14] transition-opacity pointer-events-none">
        <Icon size={72} className={color} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center space-x-2.5 mb-3">
          <div className={`p-2 rounded-xl ${iconBgColor[color] ?? 'bg-slate-100 dark:bg-slate-700'}`}>
            <Icon size={18} className={color} />
          </div>
          <span className="text-slate-500 dark:text-slate-400 font-medium text-xs text-nowrap">{title}</span>
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight tabular-nums">{value}</span>
          <span className="text-slate-400 dark:text-slate-500 font-medium text-xs">{unit}</span>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subValue}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ── Header: Greeting & XP ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch gap-6">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 capitalize">{today}</p>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            {t.greeting}, {userProfile.name || (language === 'ru' ? 'Атлет' : 'Athlete')}!
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm flex items-center space-x-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {language === 'ru' ? 'Онлайн' : 'Online'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-800/50 px-3 py-1.5 rounded-full shadow-sm">
              <Flame size={14} className="text-orange-500" fill="currentColor" />
              <span className="text-xs font-bold text-orange-700 dark:text-orange-300">12 {AT.streak}</span>
            </div>
          </div>
        </div>

        {/* Level & Progress */}
        <div className="lg:w-1/3 bg-gradient-to-br from-indigo-600 to-blue-700 dark:from-indigo-900 dark:to-slate-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 shadow-inner">
                  <Trophy size={24} className="text-yellow-400" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-100 opacity-80">{AT.level}</div>
                  <div className="text-2xl font-black tracking-tighter">{currentLevel}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-100 opacity-80">{AT.player} XP</div>
                <div className="text-2xl font-black tracking-tighter">{currentXP.toLocaleString()}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span>{AT.progressTo} {currentLevel + 1}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden p-0.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                />
              </div>
            </div>
          </div>
          <Star size={80} className="absolute -bottom-4 -right-4 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Main Activity Rings Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group">
              <div className="flex justify-between items-center w-full mb-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">{t.activity}</h2>
                <div className={`p-2 rounded-xl ${isWatchConnected ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                  <Watch size={18} />
                </div>
              </div>

              <div className="relative w-full max-w-[200px] aspect-square mx-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={moveData} cx="50%" cy="50%" innerRadius={80} outerRadius={95} startAngle={90} endAngle={-270} dataKey="value" cornerRadius={6} stroke="none">
                      <Cell fill="#ef4444" />
                      <Cell fill="#fee2e2" />
                    </Pie>
                    <Pie data={exerciseData} cx="50%" cy="50%" innerRadius={60} outerRadius={75} startAngle={90} endAngle={-270} dataKey="value" cornerRadius={6} stroke="none">
                      <Cell fill="#22c55e" />
                      <Cell fill="#dcfce7" />
                    </Pie>
                    <Pie data={standData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} startAngle={90} endAngle={-270} dataKey="value" cornerRadius={6} stroke="none">
                      <Cell fill="#3b82f6" />
                      <Cell fill="#dbeafe" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <Flame size={20} className="text-red-500 mx-auto mb-1" fill="currentColor" />
                  <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">{stats.caloriesBurned}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 w-full mt-6 gap-2">
                {[
                  { label: t.move, value: `${stats.caloriesBurned}/${stats.caloriesGoal}`, color: 'bg-red-500' },
                  { label: t.exercise, value: `${stats.moveMinutes}/${stats.moveGoal}`, color: 'bg-green-500' },
                  { label: t.stand, value: `${stats.standHours}/${stats.standGoal}`, color: 'bg-blue-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] text-slate-400 mb-1 font-bold uppercase">{label}</p>
                    <div className={`h-1.5 w-full ${color}/20 rounded-full overflow-hidden mb-1`}>
                      <div className={`h-full ${color}`} style={{ width: '70%' }} />
                    </div>
                    <p className="font-black text-[11px] text-slate-700 dark:text-slate-300 tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Weight Control Card */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                    <Scale size={20} className="text-orange-600 dark:text-orange-400" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-none uppercase tracking-tight">{t.weightControl || 'Weight Control'}</h2>
                </div>
                <div className={`flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-full ${weightDown ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {weightDown ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                  {Math.abs(weightChange)} kg
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">{userProfile.weight}</span>
                  <span className="text-slate-400 font-bold">KG</span>
                </div>

                <div className="relative group">
                  <input
                    type="number"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder={t.enterWeight || 'Enter Weight'}
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all dark:text-white"
                  />
                  <button
                    onClick={handleUpdateWeight}
                    disabled={!newWeight || isWeightUpdating}
                    className="absolute right-2 top-2 bottom-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                  >
                    {isWeightUpdating ? <RefreshCw size={14} className="animate-spin" /> : (language === 'ru' ? 'ВВОД' : 'SET')}
                  </button>
                </div>

                <div className="h-24 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={2} fill="url(#weightGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Hydration & Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Detailed Hydration Tracker */}
            <div className="md:col-span-12 lg:col-span-7 bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
              <div className="flex justify-between items-start relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                      <Droplet size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-tight">{language === 'ru' ? 'Гидратация' : 'Hydration'}</h2>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">{language === 'ru' ? 'Твоя цель на сегодня' : 'Goal for today'}: <span className="text-slate-900 dark:text-white font-black">{waterGoal} ml</span></p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{waterPercentage.toFixed(0)}%</div>
                  <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{AT.earned} XP!</div>
                </div>
              </div>

              <div className="my-8 relative">
                <div className="h-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-1.5 relative overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${waterPercentage}%` }}
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-xl shadow-lg relative"
                    transition={{ duration: 1, ease: 'easeOut' }}
                  >
                    <motion.div
                      animate={{ opacity: [0.4, 0.7, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-white/20"
                    />
                  </motion.div>
                </div>
                {/* Milestone Markers */}
                <div className="absolute top-1/2 -translate-y-1/2 left-1/4 w-px h-6 bg-slate-200 dark:bg-slate-700 z-10" />
                <div className="absolute top-1/2 -translate-y-1/2 left-2/4 w-px h-6 bg-slate-200 dark:bg-slate-700 z-10" />
                <div className="absolute top-1/2 -translate-y-1/2 left-3/4 w-px h-6 bg-slate-200 dark:bg-slate-700 z-10" />
              </div>

              <div className="flex gap-3 relative z-10">
                {[250, 500].map(ml => (
                  <button
                    key={ml}
                    onClick={() => handleAddWater(ml)}
                    className="flex-1 py-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-500 hover:text-white rounded-2xl font-black text-sm text-blue-600 dark:text-blue-400 transition-all active:scale-95 border border-blue-100/50 dark:border-blue-900/20 group/btn"
                  >
                    <span className="group-hover/btn:hidden">+{ml} ml</span>
                    <span className="hidden group-hover/btn:flex items-center justify-center gap-2"><Zap size={14} fill="currentColor" /> +{Math.floor(ml / 50)} XP</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="md:col-span-12 lg:col-span-5 grid grid-cols-2 gap-4">
              <StatCard title={t.heartRate} value={isWatchConnected ? '74' : '72'} unit="BPM" icon={Activity} color="text-pink-600" subValue="Resting: 64" />
              <StatCard title={t.steps} value={isWatchConnected ? '8,642' : '8,432'} unit={language === 'ru' ? 'шаг.' : 'steps'} icon={Footprints} color="text-orange-600" subValue="Goal: 10,000" />
              <StatCard title={t.activeBurn} value={stats.caloriesBurned} unit="kcal" icon={Flame} color="text-red-600" subValue="Total: 2,150" />
              <StatCard title={t.sleep} value="7h 12m" unit="" icon={Clock} color="text-indigo-600" subValue="Deep: 1h 45m" />
            </div>
          </div>

          {/* Smart Watch Connection CTA */}
          <div className={`p-6 rounded-[2.5rem] border transition-all duration-500 relative overflow-hidden ${isWatchConnected
            ? 'bg-blue-600 text-white border-blue-500 shadow-xl'
            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'}`}
          >
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 relative z-10">
              <div className="flex items-center space-x-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-500 ${isWatchConnected ? 'bg-white/20 backdrop-blur-md' : 'bg-slate-100 dark:bg-slate-700'}`}>
                  <Watch size={28} className={isWatchConnected ? 'text-white' : 'text-slate-400'} />
                </div>
                <div>
                  <h3 className={`font-black text-lg ${isWatchConnected ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
                    {isWatchConnected ? t.watchConnected : t.connectWatch}
                  </h3>
                  <p className={`text-xs ${isWatchConnected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isWatchConnected ? `${t.lastSync}: ${lastSync}` : t.connectPrompt}
                  </p>
                </div>
              </div>
              <button
                onClick={isWatchConnected ? handleSync : handleConnectWatch}
                className={`w-full sm:w-auto px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg ${isWatchConnected ? 'bg-white text-blue-600' : 'bg-blue-600 text-white shadow-blue-500/20'}`}
              >
                {isSyncing ? <RefreshCw className="animate-spin mx-auto" size={18} /> : (isWatchConnected ? 'SYNC NOW' : t.connectDevice)}
              </button>
            </div>
            {isWatchConnected && <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />}
          </div>
        </div>

        {/* Right Column (4 cols) - Gamification & Social */}
        <div className="lg:col-span-4 space-y-6">

          {/* Active Quests */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Target size={22} className="text-indigo-500" />
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">{AT.activeQuests}</h2>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </div>
            <div className="space-y-4">
              {achievements.filter(a => !a.unlocked || a.id === '2').slice(0, 2).map((quest) => (
                <div key={quest.id} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 group cursor-pointer hover:border-indigo-500/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-white truncate pr-2">{quest.title}</h3>
                    <span className="text-[10px] font-black p-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md shrink-0">+{quest.xpReward} XP</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(quest.progress / quest.total) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400">{quest.progress}/{quest.total}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mini Leaderboard */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users size={22} className="text-blue-500" />
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">{AT.leaderboard}</h2>
              </div>
            </div>
            <div className="space-y-3">
              {leaderboard.map((player) => (
                <div key={player.rank} className={`flex items-center justify-between p-3 rounded-2xl transition-all ${player.isMe ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-5 text-xs font-black ${player.isMe ? 'text-white' : player.rank === 1 ? 'text-yellow-500' : 'text-slate-400'}`}>{player.rank}</span>
                    <img src={player.avatar} alt="" className="w-8 h-8 rounded-lg border-2 border-white/20" />
                    <div>
                      <p className={`text-xs font-bold ${player.isMe ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{player.name}</p>
                      <p className={`text-[10px] ${player.isMe ? 'text-blue-100' : 'text-slate-400 font-medium'}`}>{player.score.toLocaleString()} XP</p>
                    </div>
                  </div>
                  {player.rank === 1 && <Crown size={14} className={player.isMe ? 'text-white' : 'text-yellow-500'} fill="currentColor" />}
                </div>
              ))}
            </div>
          </div>

          {/* Rarest Achievement Card - Compact */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="relative z-10 text-center">
              <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">{AT.rarest}</div>
              <div className="inline-block p-4 bg-indigo-500/20 border border-indigo-500/30 rounded-3xl mb-4 group-hover:scale-110 transition-transform duration-500">
                <Medal size={40} className="text-indigo-400" />
              </div>
              <h3 className="text-xl font-black text-white mb-1">Titan Runner</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-6">{AT.rarestPercent}</p>
              <button className="w-full py-3 bg-white text-indigo-950 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-95 shadow-xl">
                {AT.viewDetails}
              </button>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
