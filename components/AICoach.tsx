import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
import { ChatMessage, UserProfile, Language } from '../types';
import { generateCoachResponse, refinePlanWithConsultation, describeGeminiError } from '../services/geminiService';
import MarkdownContent from './MarkdownContent';
import { totalWorkoutsPerWeek } from '../utils/profile';

interface AICoachProps {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  apiKey: string;
  language: Language;
}

const AICoach: React.FC<AICoachProps> = ({ userProfile, setUserProfile, apiKey, language }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRu = language === 'ru';
  const name = userProfile.name || (isRu ? 'атлет' : 'athlete');

  const greeting = isRu
    ? `Привет, ${name}! Я ваш тренер Fit Genius. Ваша цель: ${totalWorkoutsPerWeek(userProfile)} тренировок в неделю. Начнём?`
    : `Hi ${name}! I'm your Fit Genius Coach. Your goal: ${totalWorkoutsPerWeek(userProfile)} workouts a week. Ready to start?`;

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
      const updatedPlan = await refinePlanWithConsultation(messages, userProfile, apiKey, language);
      setUserProfile(prev => ({ ...prev, weeklyPlan: updatedPlan, planLanguage: language }));
      pushMessage({
        id: `sync-${Date.now()}`,
        role: 'model',
        text: isRu
          ? 'Готово. План обновлён по итогам нашей консультации.'
          : 'Done. Your plan is updated from our consultation.',
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
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label={isRu ? 'Открыть AI тренера' : 'Open AI coach'}
          className="fixed right-4 lg:bottom-6 lg:right-6 w-14 h-14 rounded-full z-40
                     bg-brand-300 text-slate-950
                     shadow-xl shadow-brand-500/40 flex items-center justify-center
                     hover:scale-105 active:scale-95 transition-transform"
          style={{ bottom: 'calc(4.5rem + max(0.375rem, env(safe-area-inset-bottom)))' }}
        >
          <Sparkles size={22} fill="currentColor" />
        </button>
      )}

      {/* Chat panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Fit Genius Coach"
        aria-hidden={!isOpen}
        className={`fixed z-[60] flex flex-col bg-white dark:bg-slate-900
          border border-slate-200/70 dark:border-slate-800 shadow-2xl
          transition-all duration-300 ease-out
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
              <h3 className="font-display text-base font-semibold uppercase text-white leading-tight">Fit Genius Coach</h3>
              <p className="eyebrow text-[10px] text-brand-300 leading-tight mt-0.5">
                {busy ? (isRu ? 'печатает' : 'typing') : (isRu ? 'AI тренер' : 'AI coach')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label={isRu ? 'Закрыть чат' : 'Close chat'}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
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
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950"
          aria-live="polite"
        >
          {messages.map((msg) => {
            if (msg.isError) {
              return (
                <div key={msg.id} className="flex justify-start">
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
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
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
                        {isRu ? 'Совет тренера' : 'Coach insight'}
                      </div>
                      <MarkdownContent content={msg.text.replace(/```json[\s\S]*?```/g, '').trim()} />
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex justify-start">
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
                          focus-within:ring-2 focus-within:ring-brand-500/30 transition-all">
            <label htmlFor="coach-input" className="sr-only">
              {isRu ? 'Сообщение тренеру' : 'Message to the coach'}
            </label>
            <input
              id="coach-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder={isRu ? 'Спросите о тренировке…' : 'Ask about your workout…'}
              className="flex-1 bg-transparent border-none outline-none text-sm h-9
                         text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || busy}
              aria-label={isRu ? 'Отправить' : 'Send'}
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${input.trim() && !busy
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
