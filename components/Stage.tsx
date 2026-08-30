import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * The lit slab every screen opens with.
 *
 * It stays dark in both themes on purpose: it reads as a screen embedded in the
 * page, not as a theme flip, and it is the one element that makes the four tabs
 * look like the same product.
 */
export const Stage: React.FC<{
  children: React.ReactNode;
  /** Optional looping backdrop, e.g. "/hero.mp4" from `public/`. */
  videoSrc?: string;
  className?: string;
}> = ({ children, videoSrc, className = '' }) => {
  const [videoReady, setVideoReady] = useState(false);

  return (
    <section className={`relative overflow-hidden rounded-[24px] sm:rounded-[32px] lg:rounded-[40px]
                         bg-slate-950 border border-slate-800 text-white ${className}`}>
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {videoSrc ? (
          <video
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            onCanPlay={() => setVideoReady(true)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms]"
            style={{ opacity: videoReady ? 1 : 0 }}
          />
        ) : (
          // No external media: three drifting lights carry the same mood.
          <div className="absolute inset-0 animate-stage-drift">
            <div className="absolute -top-1/3 -left-1/4 w-[80%] h-[120%] rounded-full blur-3xl
                            bg-[radial-gradient(circle,rgba(183,236,30,0.20),transparent_65%)]" />
            <div className="absolute top-1/4 right-[-15%] w-[70%] h-[110%] rounded-full blur-3xl
                            bg-[radial-gradient(circle,rgba(18,194,224,0.16),transparent_65%)]" />
            <div className="absolute bottom-[-30%] left-1/3 w-[60%] h-[90%] rounded-full blur-3xl
                            bg-[radial-gradient(circle,rgba(255,77,46,0.12),transparent_65%)]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/45 to-slate-950/90" />
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
