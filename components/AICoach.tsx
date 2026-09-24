import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
import { ChatMessage, UserProfile, Language } from '../types';
import { generateCoachResponse, refinePlanWithConsultation, extractProfileChanges, describeGeminiError, ProfilePatch } from '../services/geminiService';
import MarkdownContent from './MarkdownContent';
import { totalWorkoutsPerWeek } from '../utils/profile';
import { pluralRu } from '../utils/plural';

interface AICoachProps {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  apiKey: string;
  language: Language;
}

const INTRO_KEY = 'zenith_coach_intro_seen';

/** Human-readable lines for the fields a consultation rewrote. */
const describePatch = (patch: ProfilePatch, isRu: boolean): string[] => {
  const out: string[] = [];
  if (patch.weight !== undefined) out.push(isRu ? `вес: ${patch.weight} кг` : `weight: ${patch.weight} kg`);
  if (patch.contraindications !== undefined) out.push(isRu ? `ограничения: ${patch.contraindications}` : `limitations: ${patch.contraindications}`);
  if (patch.dietaryPreferences !== undefined) out.push(isRu ? `питание: ${patch.dietaryPreferences}` : `diet: ${patch.dietaryPreferences}`);
  if (patch.mealsPerDay !== undefined) out.push(isRu ? `приёмов пищи в день: ${patch.mealsPerDay}` : `meals per day: ${patch.mealsPerDay}`);
  if (patch.fitnessGoals) out.push(isRu ? `цели: ${patch.fitnessGoals.join(', ')}` : `goals: ${patch.fitnessGoals.join(', ')}`);
  if (patch.useSupplements !== undefined) {
    out.push(isRu
      ? (patch.useSupplements ? 'добавки: включены' : 'добавки: выключены')
      : (patch.useSupplements ? 'supplements: on' : 'supplements: off'));
  }
  if (patch.activityLevel) out.push(isRu ? `активность: ${patch.activityLevel}` : `activity: ${patch.activityLevel}`);
  if (patch.sports) {
    const list = patch.sports.map(sp => `${sp.name} ${sp.timesPerWeek}×${sp.durationMin} ${isRu ? 'мин' : 'min'}`).join(', ');
    out.push(isRu ? `виды спорта: ${list}` : `sports: ${list}`);
  }
  if (patch.competitions) {
    const active = patch.competitions.filter(c => c.enabled);
    out.push(active.length
      ? (isRu
          ? `старты: ${active.map(c => `${c.sport} ${c.date}`).join(', ')}`
          : `events: ${active.map(c => `${c.sport} ${c.date}`).join(', ')}`)
      : (isRu ? 'старты: сняты' : 'events: cleared'));
  }
  return out;
};

const AICoach: React.FC<AICoachProps> = ({ userProfile, setUserProfile, apiKey, language }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // The sparkles button carried no label, so first-time visitors had no idea
  // what it opened. A callout introduces it once; opening the chat or closing
  // the callout retires it for good.
  const [showIntro, setShowIntro] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch { /* storage blocked */ }
    if (seen) return;
    const id = window.setTimeout(() => setShowIntro(true), 1400);
    return () => window.clearTimeout(id);
  }, []);
  const dismissIntro = useCallback(() => {
    setShowIntro(false);
    try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* storage blocked */ }
  }, []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRu = language === 'ru';
  const name = userProfile.name || (isRu ? 'атлет' : 'athlete');

  const perWeek = totalWorkoutsPerWeek(userProfile);
  const greeting = isRu
    ? `Привет, ${name}! Я AI наставник Fit Genius по тренировкам и питанию: знаю ваш профиль и план на неделю (${perWeek} ${pluralRu(perWeek, 'тренировка', 'тренировки', 'тренировок')}).

Чем помогу:
- разобрать технику упражнения
- заменить упражнение или блюдо
- скорректировать нагрузку под самочувствие

После разговора нажмите «Обновить», и план перестроится с учётом сказанного.`
    : `Hi ${name}! I'm the Fit Genius AI mentor for training and nutrition: I know your profile and this week's plan (${perWeek} ${perWeek === 1 ? 'session' : 'sessions'}).

What I can do:
- walk through an exercise's technique
- swap an exercise or a meal
- adjust the load to how you feel

After we talk, press "Update" and the plan rebuilds around it.`;

  // Keep the greeting in the current language until the conversation actually starts.
  useEffect(() => {
    setMessages(prev => {
      const started = prev.some(m => m.role === 'user');
      if (started) return prev;
      return [{ id: 'greeting', role: 'model', text: greeting, timestamp: new Date() }];
    });
  }, [greeting]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Escape closes the panel; focus moves into the field when it opens.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 250);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  const pushMessage = useCallback((msg: Omit<ChatMessage, 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, timestamp: new Date() }]);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    if (!apiKey) {
      pushMessage({
        id: `err-${Date.now()}`,
        role: 'model',
        isError: true,
        text: isRu
          ? 'API ключ не настроен. Перейдите в Профиль и добавьте ключ Gemini.'
          : 'API key not configured. Go to Profile and add your Gemini API key.',
      });
      return;
    }

    const history = messages;
    pushMessage({ id: `u-${Date.now()}`, role: 'user', text });
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await generateCoachResponse(history, userProfile, text, apiKey, language);
      pushMessage({ id: `ai-${Date.now()}`, role: 'model', text: responseText });
    } catch (e: any) {
      pushMessage({
        id: `err-${Date.now()}`,
        role: 'model',
        isError: true,
        text: describeGeminiError(e, language),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canSync = !!apiKey && !!userProfile.weeklyPlan?.length && messages.some(m => m.role === 'user');

  const handleSyncPlan = async () => {
    if (!canSync || isSyncing || isLoading) return;
    setIsSyncing(true);
    try {
      // Two calls on purpose: the plan rewrite is a 7-day JSON and the model
      // kept dropping the small profile object appended to it. The dedicated
      // extraction is what actually lands in the profile; whatever the plan
      // call returned is only a fallback.
      const [{ plan, profile: inline }, extracted] = await Promise.all([
        refinePlanWithConsultation(messages, userProfile, apiKey, language),
        extractProfileChanges(messages, userProfile, apiKey, language),
      ]);
      const patch = { ...inline, ...extracted };
      setUserProfile(prev => ({ ...prev, ...patch, weeklyPlan: plan, planLanguage: language }));
      const changed = describePatch(patch, isRu);
      pushMessage({
        id: `sync-${Date.now()}`,
        role: 'model',
        text: changed.length
          ? (isRu
              ? `Готово. План обновлён, в профиль внесены изменения:\n${changed.map(c => `- ${c}`).join('\n')}`
              : `Done. Plan updated, and the profile now reflects:\n${changed.map(c => `- ${c}`).join('\n')}`)
          : (isRu
              ? 'Готово. План обновлён по итогам нашей консультации. Профиль менять не потребовалось.'
              : 'Done. Your plan is updated from our consultation. The profile needed no changes.'),
      });
    } catch (e: any) {
      pushMessage({
        id: `err-sync-${Date.now()}`,
        role: 'model',
        isError: true,
        text: (isRu ? 'Не удалось обновить план. ' : 'Failed to update the plan. ') + describeGeminiError(e, language),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const busy = isLoading || isSyncing;

  return (
    <>
      {/* Floating action button — sits above the mobile bottom nav */}
      {/* Kept mounted while open: it shrinks into the exact corner the panel
          scales out of, so the two read as one object rather than a swap. */}
      {/* Intro callout: grows out of the button's corner, the same origin the
          panel uses, so all three read as one object. */}
      <div
        role="status"
        aria-hidden={!showIntro}
        className={`fixed right-4 lg:right-6 z-40 max-w-[calc(100vw-2rem)] w-[300px]
                   origin-bottom-right transition-[transform,scale,opacity] duration-[240ms] ease-out
                   ${showIntro && !isOpen
                     ? 'scale-100 opacity-100'
                     : 'scale-95 opacity-0 pointer-events-none'}`}
        style={{ bottom: 'calc(4.5rem + 4.25rem + max(0.375rem, env(safe-area-inset-bottom)))' }}
      >
        <div className="relative rounded-[var(--radius-card)] p-4 pr-10
                        bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800
                        shadow-2xl shadow-black/20">
          <div className="flex items-center gap-2 eyebrow text-brand-700 dark:text-brand-400 mb-1.5">
            <Sparkles size={11} className="fill-current" />
            {isRu ? 'AI наставник' : 'AI mentor'}
          </div>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {isRu
              ? `Привет, ${name}! Я отвечаю и за тренировки, и за питание: спросите про технику, замените упражнение или блюдо, подстройте план под самочувствие.`
              : `Hi ${name}! I cover both training and nutrition: ask about technique, swap an exercise or a meal, adjust the plan to how you feel.`}
          </p>
          <button
            onClick={() => { dismissIntro(); setIsOpen(true); }}
            className="btn-primary mt-3 px-3.5 py-2 text-xs"
          >
            {isRu ? 'Открыть чат' : 'Open chat'}
          </button>
          <button
            onClick={dismissIntro}
            aria-label={isRu ? 'Скрыть подсказку' : 'Dismiss'}
            className="tap-target absolute top-1 right-1 w-8 h-8 flex items-center justify-center rounded-full
                       text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
          {/* Tail pointing at the button */}
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 right-6 w-3 h-3 rotate-45
                       bg-white dark:bg-slate-900 border-r border-b border-slate-200/70 dark:border-slate-800"
          />
        </div>
      </div>

      <button
        onClick={() => { dismissIntro(); setIsOpen(true); }}
        aria-label={isRu ? 'Открыть AI наставника' : 'Open AI mentor'}
        aria-hidden={isOpen}
        tabIndex={isOpen ? -1 : 0}
        className={`fixed right-4 lg:bottom-6 lg:right-6 w-14 h-14 rounded-full z-40
                   bg-brand-300 text-slate-950 origin-bottom-right
                   shadow-xl shadow-brand-500/40 flex items-center justify-center
                   transition-[transform,translate,scale,opacity] duration-200 ease-out
                   ${isOpen
                     ? 'scale-90 opacity-0 pointer-events-none'
                     : 'scale-100 opacity-100 hover:scale-105 active:scale-95'}`}
        style={{ bottom: 'calc(4.5rem + max(0.375rem, env(safe-area-inset-bottom)))' }}
      >
        <Sparkles size={22} fill="currentColor" />
      </button>

      {/* Chat panel */}
      <div
        role="dialog"
        aria-modal="true"
        style={{ overscrollBehavior: 'contain' }}
        aria-label="Fit Genius AI"
        aria-hidden={!isOpen}
        className={`fixed z-[60] flex flex-col bg-white dark:bg-slate-900
          border border-slate-200/70 dark:border-slate-800 shadow-2xl
          transition-[transform,translate,scale,opacity] duration-300 ease-out
          inset-0 rounded-none
          lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[400px] lg:h-[620px] lg:rounded-[var(--radius-panel)]
          ${isOpen
            ? 'translate-y-0 opacity-100 lg:scale-100'
            : 'translate-y-full lg:translate-y-0 lg:scale-95 opacity-0 pointer-events-none lg:origin-bottom-right'
          }`}
      >
        {/* Header */}
        <div className="h-16 bg-slate-950 border-b border-brand-500/30 lg:rounded-t-[var(--radius-panel)]
                        flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-300 rounded-full flex items-center justify-center">
              <Bot size={18} className="text-slate-950" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold uppercase text-white leading-tight">Fit Genius AI</h3>
              <p className="eyebrow text-[10px] text-brand-300 leading-tight mt-0.5">
                {busy ? (isRu ? 'печатает' : 'typing') : (isRu ? 'Тренер и диетолог' : 'Coach and dietitian')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label={isRu ? 'Закрыть чат' : 'Close chat'}
            className="tap-target w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sync plan bar */}
        {canSync && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5
                          bg-brand-300/15 border-b border-brand-500/25">
            <span className="text-xs font-semibold text-brand-800 dark:text-brand-300">
              {isRu ? 'Обновить план по итогам чата?' : 'Apply this chat to your plan?'}
            </span>
            <button
              onClick={handleSyncPlan}
              disabled={busy}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              {isSyncing && <RefreshCw size={12} className="animate-spin" />}
              {isSyncing ? (isRu ? 'Обновляем…' : 'Updating…') : (isRu ? 'Обновить' : 'Update')}
            </button>
          </div>
        )}

        {/* Messages */}
        <div
          style={{ overscrollBehavior: 'contain' }}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950"
          aria-live="polite"
        >
          {messages.map((msg) => {
            if (msg.isError) {
              return (
                <div key={msg.id} className="flex justify-start animate-message-in">
                  <div className="max-w-[88%] rounded-2xl rounded-bl-md px-4 py-3 text-sm
                                  bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300
                                  border border-red-200 dark:border-red-900/60 flex gap-2.5">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span className="leading-relaxed break-words">{msg.text}</span>
                  </div>
                </div>
              );
            }

            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex animate-message-in ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] px-4 py-3 text-sm shadow-sm ${isUser
                  ? 'bg-brand-300 text-slate-950 rounded-2xl rounded-br-md'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 rounded-2xl rounded-bl-md'
                  }`}>
                  {isUser ? (
                    <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 mb-1.5 eyebrow text-brand-700 dark:text-brand-400">
                        <Sparkles size={10} className="fill-current" />
                        {isRu ? 'Совет наставника' : 'Mentor insight'}
                      </div>
                      <MarkdownContent content={msg.text.replace(/```json[\s\S]*?```/g, '').trim()} />
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex justify-start animate-message-in">
              <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-md
                              border border-slate-200/70 dark:border-slate-700 shadow-sm flex items-center gap-1.5">
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-white dark:bg-slate-900 lg:rounded-b-[var(--radius-panel)]
                        border-t border-slate-200/70 dark:border-slate-800 shrink-0 pb-safe lg:pb-3">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full pl-4 pr-1.5 py-1.5
                          focus-within:ring-2 focus-within:ring-brand-500/30 transition-shadow">
            <label htmlFor="coach-input" className="sr-only">
              {isRu ? 'Сообщение тренеру' : 'Message to the coach'}
            </label>
            <input
              id="coach-input"
              ref={inputRef}
              name="coach-message"
              type="text"
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder={isRu ? 'Спросите о тренировке или питании…' : 'Ask about training or nutrition…'}
              className="flex-1 bg-transparent border-none outline-none text-sm h-9
                         text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || busy}
              aria-label={isRu ? 'Отправить' : 'Send'}
              className={`tap-target w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${input.trim() && !busy
                ? 'bg-brand-300 text-slate-950 hover:bg-brand-200'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                }`}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AICoach;
