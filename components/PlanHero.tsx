import React from 'react';
import { RefreshCw, Wand2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Stage, Reveal, StageStat, StageVariant } from './Stage';

interface PlanHeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Scoreboard readouts, e.g. XP or target calories. */
  stats: { icon: React.ElementType; value: React.ReactNode; label: string }[];
  actionLabel: string;
  loadingLabel: string;
  loading: boolean;
  disabled?: boolean;
  onAction: () => void;
  /** Picks the backdrop: training runs hot and fast, nutrition cool and slow. */
  variant?: StageVariant;
  children?: React.ReactNode;
}

/**
 * Header for the Workouts and Nutrition plans, built on the same lit Stage as
 * the dashboard so every tab opens with one visual language: drifting light,
 * condensed display type, oversized numerals and a volt action.
 */
const PlanHero: React.FC<PlanHeroProps> = ({
  eyebrow, title, subtitle, stats, actionLabel, loadingLabel, loading, disabled, onAction, variant = 'dashboard', children,
}) => {
  const reduce = useReducedMotion();

  return (
    <Stage variant={variant}>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <Reveal delay={100} className="max-w-xl">
          <p className="eyebrow text-brand-300">{eyebrow}</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl lg:text-[3.25rem] font-semibold uppercase
                         leading-[0.95] tracking-tight">
            {title}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed max-w-[52ch]">{subtitle}</p>
        </Reveal>

        <Reveal delay={300} from="left" className="shrink-0">
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-4 lg:items-end">
            <div className="flex items-stretch gap-5 rounded-[var(--radius-card)] border border-white/10
                            bg-white/[0.07] backdrop-blur-xl px-5 py-4">
              {stats.map(({ icon, value, label }, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <div className="w-px bg-white/10" aria-hidden="true" />}
                  <StageStat icon={icon} value={value} label={label} />
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
        </Reveal>
      </div>

      {children && <Reveal delay={500} className="mt-8">{children}</Reveal>}
    </Stage>
  );
};

export default PlanHero;
