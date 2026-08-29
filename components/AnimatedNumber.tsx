import React, { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  /** Digits after the decimal point. */
  decimals?: number;
  suffix?: string;
  className?: string;
  locale?: string;
}

/**
 * Counts up to `value` when it changes: the scoreboard read is the feedback
 * for earning XP, logging water, finishing a set.
 *
 * The tween writes straight to `textContent` through a ref, so a 600ms count
 * costs zero React renders (Section 3.B: never drive continuous values with
 * useState). Collapses to the final value under reduced motion.
 */
const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value, decimals = 0, suffix = '', className = '', locale,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const reduce = useReducedMotion();

  const format = (n: number) =>
    n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduce || previous.current === value) {
      node.textContent = format(value);
      previous.current = value;
      return;
    }

    const controls = animate(previous.current, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => { node.textContent = format(latest); },
    });

    previous.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce, decimals, suffix, locale]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
};

export default AnimatedNumber;
