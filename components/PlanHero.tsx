import React from 'react';
import { RefreshCw, Wand2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

interface PlanHeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Scoreboard readouts on the right, e.g. XP or target calories. */
  stats: { icon: React.ElementType; value: React.ReactNode; label: string }[];
  actionLabel: string;
  loadingLabel: string;
  loading: boolean;
  disabled?: boolean;
  onAction: () => void;
  children?: React.ReactNode;
}

/**
 * Shared header for the Workouts and Nutrition plans, built as a scoreboard:
 * carbon slab, volt rule, condensed display type, oversized numerals.
 *
 * Headline sizes step down on small screens — the previous `text-5xl`
 * overflowed narrow phones.
 */
const PlanHero: React.FC<PlanHeroProps> = ({
  eyebrow, title, subtitle, stats, actionLabel, loadingLabel, loading, disabled, onAction, children,
}) => {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-slate-950 text-white
                        border border-slate-800 p-6 sm:p-9">
      {/* Speed hatching: one surface accent, decorative only */}
      <div className="hatch absolute -top-10 -right-10 w-72 h-72 rotate-12 opacity-60" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brand-400 via-brand-400/30 to-transparent" aria-hidden="true" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="max-w-xl">
          <p className="eyebrow text-brand-300">{eyebrow}</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl lg:text-[3.25rem] font-semibold uppercase
                         leading-[0.95] tracking-tight">
            {title}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed max-w-[52ch]">{subtitle}</p>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-4 lg:items-end shrink-0">
          <div className="flex items-stretch gap-5 rounded-[var(--radius-card)] border border-white/10 bg-white/5 px-5 py-4">
            {stats.map(({ icon: Icon, value, label }, i) => (
              <React.Fragment key={label}>
                {i > 0 && <div className="w-px bg-white/10" aria-hidden="true" />}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-300 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-slate-950" />
                  </div>
                  <div>
                    <div className="stat text-2xl">{value}</div>
                    <div className="eyebrow text-[10px] mt-1 text-slate-400">{label}</div>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>

          <motion.button
            onClick={onAction}
            disabled={loading || disabled}
            whileHover={reduce || loading || disabled ? undefined : { scale: 1.02 }}
            whileTap={reduce || loading || disabled ? undefined : { scale: 0.98 }}
            className="btn-primary px-6 py-3 justify-center"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {loading ? loadingLabel : actionLabel}
          </motion.button>
        </div>
      </div>

      {children && <div className="relative z-10 mt-8">{children}</div>}
    </section>
  );
};

export default PlanHero;
