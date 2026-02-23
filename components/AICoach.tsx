import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles } from 'lucide-react';
import { ChatMessage, UserProfile, Language } from '../types';
import { generateCoachResponse, refinePlanWithConsultation } from '../services/geminiService';
import MarkdownContent from './MarkdownContent';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize greeting only once on mount
  useEffect(() => {
    const greeting = language === 'ru'
      ? `Привет, ${userProfile.name}! Я ваш тренер Fit Genius. Я заметил, что у вас цель — ${userProfile.workoutsPerWeek} тренировок в неделю. Готовы начать?`
      : `Hi ${userProfile.name}! I'm your Fit Genius Coach. I noticed you have a goal of ${userProfile.workoutsPerWeek} workouts this week. Ready to crush it?`;

    setMessages([{
      id: '1',
      role: 'model',
      text: greeting,
      timestamp: new Date()
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!apiKey) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'model',
        text: language === 'ru'
          ? '⚠️ API ключ не настроен. Перейдите в Профиль и добавьте Gemini API ключ.'
          : '⚠️ API key not configured. Go to Profile and add your Gemini API key.',
        timestamp: new Date()
      }]);
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await generateCoachResponse(messages, userProfile, input, apiKey, language);
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'model',
        text: responseText,
        timestamp: new Date()
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'model',
        text: language === 'ru'
          ? `❌ Ошибка: ${e?.message || 'Неизвестная ошибка'}`
          : `❌ Error: ${e?.message || 'Unknown error'}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncPlan = async () => {
    if (messages.length < 2 || isLoading) return;
    setIsLoading(true);
    try {
      const updatedPlan = await refinePlanWithConsultation(messages, userProfile, apiKey, language);
      setUserProfile(prev => ({ ...prev, weeklyPlan: updatedPlan }));

      setMessages(prev => [...prev, {
        id: `sync-${Date.now()}`,
        role: 'model',
        text: language === 'ru'
          ? '✅ План успешно обновлен на основе нашей консультации!'
          : '✅ Plan successfully updated based on our consultation!',
        timestamp: new Date()
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `err-sync-${Date.now()}`,
        role: 'model',
        text: language === 'ru'
          ? `❌ Не удалось обновить план: ${e?.message}`
          : `❌ Failed to update plan: ${e?.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* ============================================================
          FAB — hidden when chat is open
          Mobile: positioned above bottom nav (bottom-20 right-4)
          Desktop: standard bottom-right (bottom-6 right-6)
      ============================================================ */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-4 lg:bottom-6 lg:right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform z-40"
          style={{ bottom: 'calc(4rem + max(0.5rem, env(safe-area-inset-bottom)))' }}
        >
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white" />
          <Sparkles size={24} fill="currentColor" className="text-white opacity-90" />
        </button>
      )}

      {/* ============================================================
          Chat window
          Mobile: full-screen, slides up from bottom (translate-y animation)
          Desktop: fixed panel at bottom-right (w-96, h-[600px])
      ============================================================ */}
      <div
        className={`fixed z-[60] flex flex-col
          bg-white dark:bg-slate-900 shadow-2xl
          border border-slate-100 dark:border-slate-800
          transition-all duration-300 ease-in-out
          inset-0 rounded-none
          lg:inset-auto lg:bottom-6 lg:right-6 lg:w-96 lg:h-[600px] lg:rounded-3xl
          ${isOpen
            ? 'translate-y-0 opacity-100 lg:scale-100'
            : 'translate-y-full lg:translate-y-0 lg:scale-0 opacity-0 pointer-events-none lg:origin-bottom-right'
          }`}
      >
        {/* Header */}
        <div className="h-16 bg-gradient-to-r from-blue-600 to-indigo-600 lg:rounded-t-3xl flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Fit Genius Coach</h3>
              <p className="text-blue-100 text-xs">AI Agent • Online</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sync Action - only show if there's enough history and no loading */}
        {messages.length >= 3 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 flex items-center justify-between border-b border-blue-100 dark:border-blue-800 animate-in slide-in-from-top duration-500">
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              {language === 'ru' ? 'Синхронизировать план?' : 'Sync plan with chat?'}
            </span>
            <button
              onClick={handleSyncPlan}
              disabled={isLoading}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition-all shadow-sm disabled:opacity-50"
            >
              {isLoading ? (language === 'ru' ? 'ОБНОВЛЕНИЕ...' : 'UPDATING...') : (language === 'ru' ? 'ОБНОВИТЬ' : 'UPDATE NOW')}
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-[1.5rem] px-5 py-4 text-sm leading-relaxed shadow-sm transition-all ${msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none shadow-blue-100 dark:shadow-none'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700/50 rounded-bl-none'
                }`}>
                {msg.role === 'model' && (
                  <div className="flex items-center gap-1.5 mb-2 text-[10px] font-black text-blue-500/70 dark:text-blue-400/70 uppercase tracking-widest">
                    <Sparkles size={10} className="fill-current text-blue-400" />
                    Coach Insight
                  </div>
                )}
                {msg.role === 'model' ? (
                  <MarkdownContent content={msg.text.replace(/```json[\s\S]*?```/g, '').trim()} />
                ) : (
                  <div className="font-medium whitespace-pre-wrap">{msg.text}</div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white dark:bg-slate-900 lg:rounded-b-3xl border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500/30 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={language === 'ru' ? 'Спросите о тренировке...' : 'Ask about workout...'}
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 h-8"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${input.trim() && !isLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                }`}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AICoach;
