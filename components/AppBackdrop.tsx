import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Tab } from '../types';

/** Which clip belongs to which tab. */
const CLIP_FOR_TAB: Record<Tab, string> = {
  [Tab.DASHBOARD]: '/video/dashboard.mp4',
  [Tab.WORKOUTS]: '/video/workouts.mp4',
  [Tab.NUTRITION]: '/video/nutrition.mp4',
  [Tab.PROFILE]: '/video/profile.mp4',
};

/**
 * Full-viewport background for the whole app.
 *
 * It is `fixed`, so the animation runs behind the page and simply continues as
 * the user scrolls instead of ending at the bottom of a card. Two stacked video
 * elements let one tab's clip cross-fade into the next without a black frame.
 *
 * Readability is the constraint: everything above sits on a heavy scrim, and
 * in light mode the scrim turns near-white so dark body text still passes.
 */
const AppBackdrop: React.FC<{ tab: Tab }> = ({ tab }) => {
  const reduce = useReducedMotion();
  const src = CLIP_FOR_TAB[tab];

  // Two layers: `front` shows the current clip, `back` holds the outgoing one.
  const [layers, setLayers] = useState<{ front: string; back: string | null }>({ front: src, back: null });
  const [frontReady, setFrontReady] = useState(false);
  const frontRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (src === layers.front) return;
    setLayers(prev => ({ front: src, back: prev.front }));
    setFrontReady(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Drop the outgoing layer once the new one has faded in.
  useEffect(() => {
    if (!frontReady || !layers.back) return;
    const id = window.setTimeout(() => setLayers(prev => ({ ...prev, back: null })), 900);
    return () => window.clearTimeout(id);
  }, [frontReady, layers.back]);

  if (reduce || failed) {
    // No clip: a static wash keeps the palette without any motion at all.
    return (
      <div className="fixed inset-0 -z-10 bg-slate-50 dark:bg-slate-950" aria-hidden="true">
        <div className="absolute inset-0 opacity-60 dark:opacity-100
                        bg-[radial-gradient(circle_at_20%_10%,rgba(183,236,30,0.10),transparent_55%),radial-gradient(circle_at_85%_70%,rgba(18,194,224,0.10),transparent_55%)]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-50 dark:bg-slate-950" aria-hidden="true">
      {layers.back && (
        <video
          key={layers.back}
          src={layers.back}
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      <video
        key={layers.front}
        ref={frontRef}
        src={layers.front}
        autoPlay loop muted playsInline
        preload="auto"
        onCanPlay={() => setFrontReady(true)}
        onError={() => setFailed(true)}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[900ms]"
        style={{ opacity: layers.back && !frontReady ? 0 : 1 }}
      />

      {/* Scrim: dark mode dims the footage, light mode washes it out to a tint
          so the light theme's dark text keeps its contrast. */}
      <div className="absolute inset-0 bg-slate-50/78 dark:bg-slate-950/62" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50/45 via-transparent to-slate-50/65
                      dark:from-slate-950/45 dark:via-transparent dark:to-slate-950/70" />
    </div>
  );
};

export default AppBackdrop;
