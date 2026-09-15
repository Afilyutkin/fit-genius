import React, { useState } from 'react';
import { Flame, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Language } from '../types';
import { explainIntensity } from '../utils/intensity';

/**
 * The effort chip on an exercise card, made pressable. "RPE 7" or "Zone 2"
 * means nothing to someone in their first month, so the chip opens a short
 * explainer with a scale that shows where this value sits.
 */
const IntensityHint: React.FC<{ intensity: string; language: Language }> = ({ intensity, language }) => {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const info = explainIntensity(intensity, language);
  const isRu = language === 'ru';

  if (!info) {
    return (
      <span className="chip bg-brand-300/15 border-brand-500/30 text-brand-800 dark:text-brand-300">
        <Flame size={12} />
        {intensity}
      </span>
    );
  }

  const showScale = info.kind === 'rpe' || info.kind === 'zone';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={isRu ? `Что такое ${intensity}` : `What ${intensity} means`}
        className="chip bg-brand-300/15 border-brand-500/30 text-brand-800 dark:text-brand-300
                   hover:bg-brand-300/25 transition-colors cursor-pointer"
      >
        <Flame size={12} />
        {intensity}
        <HelpCircle size={12} className="opacity-70" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="hint"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : {
              height: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.18 },
            }}
            className="basis-full overflow-hidden"
          >
            <div className="mt-2 surface-muted rounded-[var(--radius-control)] p-3.5 text-sm">
              <p className="font-display uppercase tracking-wide text-slate-900 dark:text-white font-semibold">
                {info.title}
              </p>
              <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{info.what}</p>

              {showScale && (
                <div className="mt-3" aria-hidden="true">
                  <div className="flex gap-1">
                    {Array.from({ length: info.scaleMax }, (_, i) => i + 1).map(step => {
                      const active = step >= info.from && step <= info.to;
                      return (
                        <span
                          key={step}
                          className={`flex-1 h-2 rounded-full ${active
                            ? 'bg-brand-400'
                            : step < info.from ? 'bg-brand-400/30' : 'bg-slate-200 dark:bg-slate-800'}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                    <span>1 · {info.legend[0]}</span>
                    <span>{info.scaleMax} · {info.legend[info.scaleMax - 1]}</span>
                  </div>
                </div>
              )}

              <p className="mt-3 text-slate-900 dark:text-white font-medium leading-relaxed">{info.feel}</p>
              <p className="mt-1.5 text-slate-600 dark:text-slate-400 leading-relaxed">
                <span className="eyebrow text-brand-700 dark:text-brand-400 mr-1.5">{isRu ? 'Как понять' : 'How to tell'}</span>
                {info.check}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default IntensityHint;
