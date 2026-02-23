import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Language } from '../types';
import { getTranslation } from '../utils/translations';

const data = [
  { name: 'Mon', weight: 73.5, recovery: 82 },
  { name: 'Tue', weight: 73.2, recovery: 85 },
  { name: 'Wed', weight: 73.0, recovery: 78 },
  { name: 'Thu', weight: 72.8, recovery: 88 },
  { name: 'Fri', weight: 72.5, recovery: 92 },
  { name: 'Sat', weight: 72.4, recovery: 90 },
  { name: 'Sun', weight: 72.4, recovery: 94 },
];

const TrendsView: React.FC<{ language: Language }> = ({ language }) => {
  const t = getTranslation(language).trends;
  
  return (
    <div className="space-y-8 animate-fade-in">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t.title}</h1>
            <p className="text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t.weightHistory}</h2>
                        <div className="flex items-baseline space-x-2 mt-1">
                             <span className="text-3xl font-bold text-slate-900 dark:text-white">72.4</span>
                             <span className="text-slate-500 dark:text-slate-400 font-medium">kg</span>
                             <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold px-2 py-0.5 rounded-full ml-2">-1.1kg</span>
                        </div>
                    </div>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                            <YAxis domain={['dataMin - 1', 'dataMax + 1']} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                            />
                            <Area type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-8">
                     <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t.recoveryScore}</h2>
                        <div className="flex items-baseline space-x-2 mt-1">
                             <span className="text-3xl font-bold text-slate-900 dark:text-white">92</span>
                             <span className="text-slate-500 dark:text-slate-400 font-medium">/ 100</span>
                        </div>
                    </div>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorRecovery" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                            />
                            <Area type="monotone" dataKey="recovery" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRecovery)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    </div>
  );
};

export default TrendsView;