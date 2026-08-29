import React from 'react';
import { LayoutDashboard, Dumbbell, Utensils, User, LogOut, Globe, Lock, Moon, Sun } from 'lucide-react';
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

const Logo: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10 3.5C9.1 3.5 8.4 4 8.1 4.7C7.3 4.4 6.3 4.9 5.8 5.8C5 6.1 4.3 7 4.3 8C4.3 8.7 4.6 9.4 5.2 9.7C5 10.1 4.9 10.6 4.9 11.1C4.9 12.7 6 13.9 7.5 14.3C7.8 15.1 8.8 15.7 9.9 15.7H10.1C11.2 15.7 12.2 15.1 12.5 14.3C14 13.9 15.1 12.7 15.1 11.1C15.1 10.6 15 10.1 14.8 9.7C15.4 9.4 15.7 8.7 15.7 8C15.7 7 15 6.1 14.2 5.8C13.7 4.9 12.7 4.4 11.9 4.7C11.6 4 10.9 3.5 10 3.5Z" fill="#ccfa4d" />
    <line x1="10" y1="4.5" x2="10" y2="15.5" stroke="#0a0c0f" strokeWidth="0.9" strokeLinecap="round" opacity="0.55" />
  </svg>
);

/** Volt glyph on a carbon tile: the accent reads as equipment, not gradient. */
const LogoTile: React.FC<{ size: number; glyph: number; className?: string }> = ({ size, glyph, className = '' }) => (
  <div
    className={`rounded-[var(--radius-control)] bg-slate-950 dark:bg-slate-900 border border-slate-800
                flex items-center justify-center shrink-0 ${className}`}
    style={{ width: size, height: size }}
  >
    <Logo size={glyph} />
  </div>
);

const Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`font-display font-semibold uppercase tracking-wide text-slate-900 dark:text-white ${className}`}>
    Fit <span className="text-brand-800 dark:text-brand-300">Genius</span>
  </span>
);

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, language, setLanguage, theme, setTheme, isSetup, onSignOut }) => {
  const t = getTranslation(language).sidebar;
  const isRu = language === 'ru';

  const menuItems = [
    { id: Tab.DASHBOARD, label: t.dashboard, icon: LayoutDashboard },
    { id: Tab.WORKOUTS, label: t.workouts, icon: Dumbbell },
    { id: Tab.NUTRITION, label: t.nutrition, icon: Utensils },
    { id: Tab.PROFILE, label: t.profile, icon: User },
  ];

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const toggleLanguage = () => setLanguage(language === 'en' ? 'ru' : 'en');

  const lockedHint = isRu ? 'Сначала создайте план в профиле' : 'Generate your plan in Profile first';

  return (
    <>
      {/* ============================================================
          DESKTOP SIDEBAR — lg and up
      ============================================================ */}
      <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 z-50
                        bg-white dark:bg-slate-900 border-r border-slate-200/70 dark:border-slate-800">
        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-slate-200/70 dark:border-slate-800 shrink-0">
          <LogoTile size={38} glyph={21} className="mr-3" />
          <div className="flex flex-col leading-tight">
            <Wordmark className="text-lg leading-none" />
            <span className="eyebrow text-[9px] mt-1.5 leading-none">AI Health Coach</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="mt-6 px-3 space-y-1 flex-1" aria-label={isRu ? 'Основная навигация' : 'Main navigation'}>
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            const isLocked = !isSetup && item.id !== Tab.PROFILE;

            return (
              <button
                key={item.id}
                onClick={() => !isLocked && setActiveTab(item.id)}
                disabled={isLocked}
                aria-current={isActive ? 'page' : undefined}
                title={isLocked ? lockedHint : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-control)]
                  font-display text-[15px] uppercase tracking-wide transition-colors duration-200 relative
                  ${isActive
                    ? 'bg-brand-300/15 text-brand-800 dark:text-brand-300 font-semibold'
                    : isLocked
                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                      : 'text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-brand-400 rounded-r-full" aria-hidden="true" />
                )}
                <span className="relative shrink-0">
                  <Icon size={20} className={isActive ? 'text-brand-800 dark:text-brand-300' : ''} />
                  {isLocked && (
                    <span className="absolute -top-1.5 -right-1.5 bg-slate-100 dark:bg-slate-800 rounded-full p-0.5">
                      <Lock size={9} className="text-slate-400 dark:text-slate-600" />
                    </span>
                  )}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="p-3 space-y-2 shrink-0 border-t border-slate-200/70 dark:border-slate-800">
          <button
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium
                       text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="flex items-center gap-3">
              {theme === 'light'
                ? <Moon size={20} className="text-slate-400 shrink-0" />
                : <Sun size={20} className="text-brand-500 dark:text-brand-300 shrink-0" />}
              {isRu ? 'Тема' : 'Theme'}
            </span>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              {theme === 'light' ? (isRu ? 'Светлая' : 'Light') : (isRu ? 'Тёмная' : 'Dark')}
            </span>
          </button>

          <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Globe size={20} className="text-slate-400 shrink-0" aria-hidden="true" />
            <label htmlFor="sidebar-language" className="sr-only">
              {isRu ? 'Язык интерфейса' : 'Interface language'}
            </label>
            <select
              id="sidebar-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="flex-1 bg-transparent border-none outline-none text-slate-600 dark:text-slate-300 text-sm font-medium cursor-pointer"
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </div>

          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                       text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400
                       hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <LogOut size={20} className="shrink-0" />
            {t.signOut}
          </button>
        </div>
      </aside>

      {/* ============================================================
          MOBILE TOP HEADER
      ============================================================ */}
      <header className="flex lg:hidden fixed top-0 inset-x-0 h-16 z-50 items-center justify-between px-4
                         bg-white/90 dark:bg-slate-900/90 backdrop-blur-md
                         border-b border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <LogoTile size={34} glyph={19} />
          <Wordmark className="text-lg" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            aria-label={isRu ? 'Переключить на английский' : 'Switch to Russian'}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold
                       text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {language === 'en' ? 'RU' : 'EN'}
          </button>
          <button
            onClick={toggleTheme}
            aria-label={isRu ? 'Переключить тему' : 'Toggle theme'}
            aria-pressed={theme === 'dark'}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === 'light'
              ? <Moon size={18} className="text-slate-500" />
              : <Sun size={18} className="text-brand-600 dark:text-brand-300" />}
          </button>
        </div>
      </header>

      {/* ============================================================
          MOBILE BOTTOM NAV
      ============================================================ */}
      <nav
        className="flex lg:hidden fixed bottom-0 inset-x-0 z-50
                   bg-white/95 dark:bg-slate-900/95 backdrop-blur-md
                   border-t border-slate-200/70 dark:border-slate-800"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
        aria-label={isRu ? 'Основная навигация' : 'Main navigation'}
      >
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          const isLocked = !isSetup && item.id !== Tab.PROFILE;

          return (
            <button
              key={item.id}
              onClick={() => !isLocked && setActiveTab(item.id)}
              disabled={isLocked}
              aria-current={isActive ? 'page' : undefined}
              title={isLocked ? lockedHint : undefined}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 pt-2.5 pb-1.5 relative transition-colors
                ${isActive
                  ? 'text-brand-800 dark:text-brand-300'
                  : isLocked
                    ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] bg-brand-400 rounded-b-full" aria-hidden="true" />
              )}
              <span className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                {isLocked && (
                  <span className="absolute -top-1.5 -right-1.5 bg-slate-100 dark:bg-slate-800 rounded-full p-0.5">
                    <Lock size={8} className="text-slate-400 dark:text-slate-600" />
                  </span>
                )}
              </span>
              <span className={`font-display text-[11px] uppercase tracking-wide truncate max-w-full px-1
                                ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default Sidebar;
