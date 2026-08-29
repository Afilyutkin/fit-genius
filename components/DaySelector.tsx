import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface DaySelectorProps {
  /** Short labels, one per day actually present in the plan. */
  days: string[];
  selected: number;
  onSelect: (index: number) => void;
  label: string;
}

/**
 * Seven fixed-width pills used to overflow the viewport on phones; this version
 * scrolls horizontally and only renders days the plan really contains.
 *
 * Motion: the active pill slides between days via a shared `layoutId` — a state
 * transition, so the eye tracks which day it moved to instead of re-finding it.
 */
const DaySelector: React.FC<DaySelectorProps> = ({ days, selected, onSelect, label }) => {
  const reduce = useReducedMotion();

  return (
    <div className="flex justify-center">
      <div
        role="tablist"
        aria-label={label}
        className="inline-flex gap-1 p-1 max-w-full overflow-x-auto no-scrollbar
                   bg-slate-100 dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800"
      >
        {days.map((day, idx) => {
          const isActive = selected === idx;
          return (
            <button
              key={`${day}-${idx}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(idx)}
              className={`relative shrink-0 px-4 sm:px-5 py-2 rounded-full font-display text-sm font-semibold
                          uppercase tracking-wider transition-colors duration-200
                ${isActive
                  ? 'text-slate-950'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
            >
              {isActive && (
                <motion.span
                  layoutId="day-pill"
                  className="absolute inset-0 rounded-full bg-brand-300"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative z-10">{day}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DaySelector;
