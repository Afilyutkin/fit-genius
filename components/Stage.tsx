import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Each tab gets its own light, tempo and clip, so the app reads as rooms. */
export type StageVariant = 'dashboard' | 'workouts' | 'nutrition' | 'profile';

interface VariantLook {
  /** Clip looked for in `public/video/`; falls back to the painted backdrop. */
  video: string;
  /** Painted fallback layers: position, size, colour, motion class. */
  layers: { className: string; color: string }[];
  /** Extra diagonal streaks, used to make training feel fast. */
  streaks?: boolean;
  /** Veil strength over the backdrop, so text always wins. */
  veil: string;
}

const VARIANTS: Record<StageVariant, VariantLook> = {
  // Command centre: three slow lights, the widest palette of the four.
  dashboard: {
    video: '/video/dashboard.mp4',
    veil: 'from-slate-950/70 via-slate-950/45 to-slate-950/90',
    layers: [
      { className: '-top-1/3 -left-1/4 w-[80%] h-[120%] animate-stage-drift', color: 'rgba(183,236,30,0.20)' },
      { className: 'top-1/4 right-[-15%] w-[70%] h-[110%] animate-stage-drift-slow', color: 'rgba(18,194,224,0.16)' },
      { className: 'bottom-[-30%] left-1/3 w-[60%] h-[90%] animate-stage-drift', color: 'rgba(255,77,46,0.12)' },
    ],
  },
  // Training: hot, fast, with light streaks reading as speed.
  workouts: {
    video: '/video/workouts.mp4',
    veil: 'from-slate-950/75 via-slate-950/50 to-slate-950/90',
    layers: [
      { className: '-top-1/4 left-[-10%] w-[75%] h-[130%] animate-stage-drift-fast', color: 'rgba(183,236,30,0.24)' },
      { className: 'bottom-[-25%] right-[-10%] w-[65%] h-[110%] animate-stage-drift-fast', color: 'rgba(255,77,46,0.18)' },
    ],
    streaks: true,
  },
  // Nutrition: cool and calm, a slow rise like steam off a plate.
  nutrition: {
    video: '/video/nutrition.mp4',
    veil: 'from-slate-950/70 via-slate-950/45 to-slate-950/90',
    layers: [
      { className: 'bottom-[-20%] left-[-5%] w-[70%] h-[120%] animate-stage-rise', color: 'rgba(18,194,224,0.20)' },
      { className: 'top-[-20%] right-[-5%] w-[60%] h-[110%] animate-stage-drift-slow', color: 'rgba(183,236,30,0.14)' },
    ],
  },
  // Profile: the quietest screen, one barely-moving light behind a form.
  profile: {
    video: '/video/profile.mp4',
    veil: 'from-slate-950/75 via-slate-950/55 to-slate-950/90',
    layers: [
      { className: 'top-[-30%] left-1/4 w-[70%] h-[130%] animate-stage-drift-slow', color: 'rgba(183,236,30,0.14)' },
    ],
  },
};

/**
 * The lit slab every screen opens with.
 *
 * It stays dark in both themes on purpose: it reads as a screen embedded in the
 * page, not as a theme flip, and it is the one element that makes the four tabs
 * look like the same product.
 *
 * Background media is optional. Drop `public/video/<tab>.mp4` and it plays;
 * with no file (or a decode failure, or reduced-motion) the painted backdrop
 * below carries the same mood at zero download cost.
 */
export const Stage: React.FC<{
  children: React.ReactNode;
  variant?: StageVariant;
  /** Overrides the variant's default clip path. */
  videoSrc?: string;
  className?: string;
}> = ({ children, variant = 'dashboard', videoSrc, className = '' }) => {
  const look = VARIANTS[variant];
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const reduce = useReducedMotion();

  const src = videoSrc ?? look.video;
  // A still page has no business downloading a looping clip.
  const useVideo = !!src && !videoFailed && !reduce;

  return (
    <section className={`relative overflow-hidden rounded-[24px] sm:rounded-[32px] lg:rounded-[40px]
                         bg-slate-950 border border-slate-800 text-white ${className}`}>
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {/* Painted backdrop: always mounted, so a missing clip is invisible */}
        <div className="absolute inset-0">
          {look.layers.map((layer, i) => (
            <div
              key={i}
              className={`absolute rounded-full blur-3xl ${layer.className}`}
              style={{ background: `radial-gradient(circle, ${layer.color}, transparent 65%)` }}
            />
          ))}
          {look.streaks && !reduce && [0, 2.3, 4.6].map(delay => (
            <div
              key={delay}
              className="absolute top-0 left-0 h-[140%] w-[6%] blur-2xl animate-stage-sweep
                         bg-gradient-to-b from-transparent via-brand-300/25 to-transparent"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </div>

        {useVideo && (
          <video
            src={src}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onCanPlay={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms]"
            style={{ opacity: videoReady ? 1 : 0 }}
          />
        )}

        {/* Extra scrim once a clip is on screen: the painted backdrop is soft,
            real footage is not, and the headline has to stay readable. */}
        {videoReady && <div className="absolute inset-0 bg-slate-950/60" />}
        <div className={`absolute inset-0 bg-gradient-to-b ${look.veil}`} />
      </div>

      <div className="relative z-10 px-5 sm:px-8 lg:px-10 pt-6 sm:pt-8 pb-6 sm:pb-8 lg:pb-10">
        {children}
      </div>
    </section>
  );
};

/** Reveal on entry, shared easing and timing across every stage. */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  from?: 'up' | 'down' | 'left' | 'right' | 'scale';
  className?: string;
}> = ({ children, delay = 0, from = 'up', className = '' }) => {
  const reduce = useReducedMotion();

  const offset = {
    up: { y: 40 }, down: { y: -40 }, left: { x: 40 }, right: { x: -40 }, scale: { scale: 0.9 },
  }[from];

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.8, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '?';

/** Volt disc with the user's initials: no third-party avatar requests. */
export const Avatar: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => (
  <span className={`rounded-full shrink-0 bg-brand-300 text-slate-950 flex items-center justify-center
                    font-display font-semibold ${className}`}>
    {initials(name)}
  </span>
);

/** Readout tile used for the numbers that sit beside a stage action. */
export const StageStat: React.FC<{
  icon: React.ElementType;
  value: React.ReactNode;
  label: string;
}> = ({ icon: Icon, value, label }) => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-full bg-brand-300 flex items-center justify-center shrink-0">
      <Icon size={18} className="text-slate-950" />
    </div>
    <div>
      <div className="stat text-2xl">{value}</div>
      <div className="eyebrow text-[10px] mt-1 text-slate-400">{label}</div>
    </div>
  </div>
);
