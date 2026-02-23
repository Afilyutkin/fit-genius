import React from 'react';
import { LayoutDashboard, Dumbbell, Utensils, Trophy, User, LogOut, Globe, Lock, Moon, Sun } from 'lucide-react';
import { Tab, Language, Theme } from '../types';
import { getTranslation } from '../utils/translations';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isSetup: boolean;
  onSignOut: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, language, setLanguage, theme, setTheme, isSetup, onSignOut }) => {
  const t = getTranslation(language).sidebar;

  const menuItems = [
    { id: Tab.DASHBOARD, label: t.dashboard, icon: LayoutDashboard },
    { id: Tab.WORKOUTS, label: t.workouts, icon: Dumbbell },
    { id: Tab.NUTRITION, label: t.nutrition, icon: Utensils },
    { id: Tab.PROFILE, label: t.profile, icon: User },
  ];

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const toggleLanguage = () => setLanguage(language === 'en' ? 'ru' : 'en');

  return (
    <>
      {/* ============================================================
          DESKTOP SIDEBAR — visible only on lg+ screens
      ============================================================ */}
      <div className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-900 h-screen fixed left-0 top-0 border-r border-slate-100 dark:border-slate-800 z-50 transition-all duration-300">
        {/* Logo */}
        <div className="h-20 flex items-center justify-start px-8 border-b border-slate-50 dark:border-slate-800 shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mr-3 shadow-lg shadow-violet-200 dark:shadow-violet-900/20"
               style={{background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)'}}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 3.5C9.1 3.5 8.4 4 8.1 4.7C7.3 4.4 6.3 4.9 5.8 5.8C5 6.1 4.3 7 4.3 8C4.3 8.7 4.6 9.4 5.2 9.7C5 10.1 4.9 10.6 4.9 11.1C4.9 12.7 6 13.9 7.5 14.3C7.8 15.1 8.8 15.7 9.9 15.7H10.1C11.2 15.7 12.2 15.1 12.5 14.3C14 13.9 15.1 12.7 15.1 11.1C15.1 10.6 15 10.1 14.8 9.7C15.4 9.4 15.7 8.7 15.7 8C15.7 7 15 6.1 14.2 5.8C13.7 4.9 12.7 4.4 11.9 4.7C11.6 4 10.9 3.5 10 3.5Z" fill="white"/>
              <line x1="10" y1="4.5" x2="10" y2="15.5" stroke="#4F46E5" strokeWidth="0.8" strokeLinecap="round" opacity="0.35"/>
            </svg>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-black text-base tracking-tight text-slate-800 dark:text-white leading-none">Fit <span style={{background: 'linear-gradient(90deg, #7C3AED, #4F46E5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>Genius</span></span>
            <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-0.5">AI Health Coach</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="mt-8 px-4 space-y-2 flex-1">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            const isLocked = !isSetup && item.id !== Tab.PROFILE;

            return (
              <button
                key={item.id}
                onClick={() => !isLocked && setActiveTab(item.id)}
                disabled={isLocked}
                className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group relative
                  ${isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                    : isLocked
                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed bg-slate-50/50 dark:bg-slate-800/50'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
              >
                <div className="relative shrink-0">
                  <Icon size={22} className={`${isActive ? 'text-blue-600 dark:text-blue-400' : isLocked ? 'text-slate-300 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                  {isLocked && (
                    <div className="absolute -top-1 -right-1 bg-slate-100 dark:bg-slate-800 rounded-full p-0.5">
                      <Lock size={9} className="text-slate-400 dark:text-slate-600" />
                    </div>
                  )}
                </div>
                <span className={`ml-3 font-medium ${isActive ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="p-4 mb-4 space-y-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              {theme === 'light' ? <Moon size={20} className="text-slate-400 shrink-0" /> : <Sun size={20} className="text-yellow-400 shrink-0" />}
              <span className="text-slate-600 dark:text-slate-300 text-sm font-medium">
                {language === 'ru' ? 'Тема' : 'Theme'}
              </span>
            </div>
            {/* Shows current state */}
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
              {theme === 'light' ? (language === 'ru' ? 'Светлая' : 'Light') : (language === 'ru' ? 'Тёмная' : 'Dark')}
            </span>
          </button>

          <div className="w-full flex items-center justify-start px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <Globe size={20} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="ml-2 bg-transparent border-none outline-none text-slate-600 dark:text-slate-300 text-sm font-medium w-full cursor-pointer"
            >
              <option value="en" className="dark:bg-slate-900">English</option>
              <option value="ru" className="dark:bg-slate-900">Русский</option>
            </select>
          </div>

          <button
            onClick={onSignOut}
            className="w-full flex items-center justify-start px-3 py-3 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="ml-3 font-medium">{t.signOut}</span>
          </button>
        </div>
      </div>

      {/* ============================================================
          MOBILE TOP HEADER — visible only below lg
      ============================================================ */}
      <div className="flex lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 z-50 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-violet-200 dark:shadow-violet-900/20"
               style={{background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)'}}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 3.5C9.1 3.5 8.4 4 8.1 4.7C7.3 4.4 6.3 4.9 5.8 5.8C5 6.1 4.3 7 4.3 8C4.3 8.7 4.6 9.4 5.2 9.7C5 10.1 4.9 10.6 4.9 11.1C4.9 12.7 6 13.9 7.5 14.3C7.8 15.1 8.8 15.7 9.9 15.7H10.1C11.2 15.7 12.2 15.1 12.5 14.3C14 13.9 15.1 12.7 15.1 11.1C15.1 10.6 15 10.1 14.8 9.7C15.4 9.4 15.7 8.7 15.7 8C15.7 7 15 6.1 14.2 5.8C13.7 4.9 12.7 4.4 11.9 4.7C11.6 4 10.9 3.5 10 3.5Z" fill="white"/>
              <line x1="10" y1="4.5" x2="10" y2="15.5" stroke="#4F46E5" strokeWidth="0.8" strokeLinecap="round" opacity="0.35"/>
            </svg>
          </div>
          <span className="font-black text-lg tracking-tight text-slate-800 dark:text-white">Fit <span style={{background: 'linear-gradient(90deg, #7C3AED, #4F46E5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>Genius</span></span>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleLanguage}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            {language === 'en' ? 'RU' : 'EN'}
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            {theme === 'light'
              ? <Moon size={18} className="text-slate-500" />
              : <Sun size={18} className="text-yellow-400" />
            }
          </button>
        </div>
      </div>

      {/* ============================================================
          MOBILE BOTTOM NAV — visible only below lg
      ============================================================ */}
      <div className="flex lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 z-50 pb-safe"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          const isLocked = !isSetup && item.id !== Tab.PROFILE;

          return (
            <button
              key={item.id}
              onClick={() => !isLocked && setActiveTab(item.id)}
              disabled={isLocked}
              className={`flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors duration-200
                ${isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : isLocked
                    ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
            >
              {/* Active indicator bar at top */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-b-full" />
              )}
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {isLocked && (
                  <div className="absolute -top-1 -right-1 bg-slate-100 dark:bg-slate-800 rounded-full p-0.5">
                    <Lock size={8} className="text-slate-400 dark:text-slate-600" />
                  </div>
                )}
              </div>
              <span className={`text-[10px] font-semibold tracking-tight truncate ${isActive ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default Sidebar;
