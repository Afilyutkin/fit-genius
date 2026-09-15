import { Language } from '../types';

/**
 * Turns a prescribed effort ("RPE 7", "Зона 2", "75% 1RM") into words a first-
 * week beginner can act on. The plan is only coachable if the number on the
 * chip means something to the person reading it.
 */

export type IntensityKind = 'rpe' | 'zone' | 'percent' | 'easy';

export interface IntensityExplanation {
  kind: IntensityKind;
  /** Parsed value(s); a range like "RPE 7-8" keeps both ends. */
  from: number;
  to: number;
  /** Full scale for the visual, e.g. 1..10 for RPE, 1..5 for zones. */
  scaleMax: number;
  title: string;
  /** What the scale is, one sentence. */
  what: string;
  /** What this exact value feels like. */
  feel: string;
  /** How to check you are at the right level without any gadget. */
  check: string;
  /** Per-step labels for the scale legend. */
  legend: string[];
}

const RPE_RU: Record<number, { feel: string; reserve: string }> = {
  1: { feel: 'Почти без усилия, как прогулка.', reserve: 'Это не рабочий подход, а движение для разогрева.' },
  2: { feel: 'Очень легко, дыхание ровное.', reserve: 'Разминка: техника, амплитуда, никакой нагрузки.' },
  3: { feel: 'Легко. Можно свободно разговаривать.', reserve: 'Разминочные подходы и заминка. Вес или темп такие, что скучно.' },
  4: { feel: 'Умеренно легко, усилие уже заметно.', reserve: 'В запасе ещё 6 и больше повторов до отказа.' },
  5: { feel: 'Умеренно. Работаешь, но с большим запасом.', reserve: 'В запасе около 5 повторов. Хороший темп для освоения техники.' },
  6: { feel: 'Заметное усилие, полностью под контролем.', reserve: 'В запасе 4 повтора. Форма чистая, скорость движения ещё высокая.' },
  7: { feel: 'Тяжеловато, но уверенно.', reserve: 'В запасе 3 повтора. Последние повторы замедляются, техника держится.' },
  8: { feel: 'Тяжело. Нужна концентрация.', reserve: 'В запасе 2 повтора. Обычный рабочий верх для опытных.' },
  9: { feel: 'Очень тяжело, на грани.', reserve: 'В запасе 1 повтор. Только на свежих силах и не каждую неделю.' },
  10: { feel: 'Предел. Следующий повтор не получится.', reserve: 'Отказ. В планах почти не встречается: слишком дорого восстанавливаться.' },
};

const RPE_EN: Record<number, { feel: string; reserve: string }> = {
  1: { feel: 'Almost no effort, like a stroll.', reserve: 'Not a working set: movement to warm up.' },
  2: { feel: 'Very easy, breathing steady.', reserve: 'Warm-up: technique and range, no real load.' },
  3: { feel: 'Easy. You can talk freely.', reserve: 'Warm-up sets and cool-down. Load or pace so light it is boring.' },
  4: { feel: 'Fairly easy, effort just noticeable.', reserve: '6 or more reps left before failure.' },
  5: { feel: 'Moderate. Working, with plenty in reserve.', reserve: 'About 5 reps left. Good pace for learning a movement.' },
  6: { feel: 'Noticeable effort, fully in control.', reserve: '4 reps in reserve. Clean form, bar speed still high.' },
  7: { feel: 'Hard-ish, but confident.', reserve: '3 reps in reserve. Last reps slow down, technique holds.' },
  8: { feel: 'Hard. Needs focus.', reserve: '2 reps in reserve. The usual working ceiling for experienced lifters.' },
  9: { feel: 'Very hard, on the edge.', reserve: '1 rep in reserve. Only when fresh, and not every week.' },
  10: { feel: 'Limit. The next rep will not happen.', reserve: 'Failure. Rare in plans: too expensive to recover from.' },
};

const ZONE_RU: Record<number, { feel: string; hr: string }> = {
  1: { feel: 'Восстановление. Ходьба, очень лёгкое вращение педалей.', hr: '50-60% от максимального пульса' },
  2: { feel: 'Лёгкий разговорный темп. Дышишь носом, можешь говорить целыми предложениями.', hr: '60-70% от максимального пульса' },
  3: { feel: 'Темповый бег. Говорить можно, но короткими фразами.', hr: '70-80% от максимального пульса' },
  4: { feel: 'Пороговая работа. Дыхание тяжёлое, слов хватает на два-три.', hr: '80-90% от максимального пульса' },
  5: { feel: 'Спринт, максимум. Держится секунды, не минуты.', hr: '90-100% от максимального пульса' },
};

const ZONE_EN: Record<number, { feel: string; hr: string }> = {
  1: { feel: 'Recovery. Walking, very light spinning.', hr: '50-60% of max heart rate' },
  2: { feel: 'Easy conversational pace. Nose breathing, full sentences.', hr: '60-70% of max heart rate' },
  3: { feel: 'Tempo. You can talk, but in short phrases.', hr: '70-80% of max heart rate' },
  4: { feel: 'Threshold. Breathing hard, two or three words at a time.', hr: '80-90% of max heart rate' },
  5: { feel: 'Sprint, all out. Seconds, not minutes.', hr: '90-100% of max heart rate' },
};

const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

/** "RPE 7-8", "RPE7", "rpe 6.5", "Zone 2", "Зона 2", "Z2", "75% 1RM", "easy". */
export const explainIntensity = (raw: string | undefined, language: Language): IntensityExplanation | null => {
  if (!raw) return null;
  const text = raw.trim();
  const ru = language === 'ru';

  const rpe = /rpe\s*(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?/i.exec(text);
  if (rpe) {
    const from = clampInt(parseFloat(rpe[1].replace(',', '.')), 1, 10);
    const to = rpe[2] ? clampInt(parseFloat(rpe[2].replace(',', '.')), from, 10) : from;
    const table = ru ? RPE_RU : RPE_EN;
    const feel = from === to ? table[from].feel : `${table[from].feel} ${ru ? 'До' : 'Up to'}: ${table[to].feel.toLowerCase()}`;
    return {
      kind: 'rpe', from, to, scaleMax: 10,
      title: `RPE ${from === to ? from : `${from}-${to}`}`,
      what: ru
        ? 'RPE, шкала воспринимаемого усилия от 1 до 10: насколько тяжёлым должен ощущаться подход. 10 это отказ, дальше ни одного повтора.'
        : 'RPE, rate of perceived exertion from 1 to 10: how hard the set should feel. 10 is failure, not one more rep.',
      feel,
      check: table[to].reserve,
      legend: ru
        ? ['разминка', 'разминка', 'легко', 'легко', 'умеренно', 'рабочий', 'рабочий', 'тяжело', 'на грани', 'отказ']
        : ['warm-up', 'warm-up', 'easy', 'easy', 'moderate', 'working', 'working', 'hard', 'edge', 'failure'],
    };
  }

  const zone = /(?:zone|зона|z|hr\s*zone|пульсов\w*\s*зона)\s*(\d)(?:\s*-\s*(\d))?/i.exec(text);
  if (zone) {
    const from = clampInt(parseInt(zone[1], 10), 1, 5);
    const to = zone[2] ? clampInt(parseInt(zone[2], 10), from, 5) : from;
    const table = ru ? ZONE_RU : ZONE_EN;
    return {
      kind: 'zone', from, to, scaleMax: 5,
      title: ru ? `Зона ${from === to ? from : `${from}-${to}`}` : `Zone ${from === to ? from : `${from}-${to}`}`,
      what: ru
        ? 'Пульсовая зона, от 1 до 5: процент от максимального пульса. Максимум примерно 220 минус возраст.'
        : 'Heart-rate zone, 1 to 5: a share of your maximum heart rate. Max is roughly 220 minus your age.',
      feel: `${table[from].feel} ${table[from].hr}.`,
      check: ru
        ? 'Проверка без пульсометра: можешь спокойно разговаривать, это зона 2; только короткими фразами, зона 3; два-три слова, зона 4.'
        : 'No monitor needed: full sentences means zone 2; short phrases, zone 3; two or three words, zone 4.',
      legend: ru
        ? ['восстановление', 'разговорный', 'темп', 'порог', 'спринт']
        : ['recovery', 'conversational', 'tempo', 'threshold', 'sprint'],
    };
  }

  const pct = /(\d{2,3})\s*%/.exec(text);
  if (pct) {
    const from = clampInt(parseInt(pct[1], 10), 30, 100);
    return {
      kind: 'percent', from, to: from, scaleMax: 100,
      title: `${from}% 1RM`,
      what: ru
        ? 'Процент от одноповторного максимума: от веса, который вы можете поднять ровно один раз с чистой техникой.'
        : 'Percent of your one-rep max: the heaviest weight you can lift once with clean technique.',
      feel: ru
        ? (from >= 85 ? 'Тяжёлые подходы на 1-5 повторов, длинный отдых.'
          : from >= 70 ? 'Рабочая зона на 6-10 повторов: сила и мышечная масса.'
          : 'Лёгкий вес на много повторов: техника, выносливость, разминка.')
        : (from >= 85 ? 'Heavy sets of 1-5 reps, long rest.'
          : from >= 70 ? 'The working range for 6-10 reps: strength and muscle.'
          : 'Light load for many reps: technique, endurance, warm-up.'),
      check: ru
        ? 'Если максимум неизвестен, не угадывайте: возьмите вес, с которым нужное число повторов даётся с запасом в 2-3, и запишите его.'
        : 'If you do not know your max, do not guess: pick a load that leaves 2-3 reps in reserve at the target reps and write it down.',
      legend: [],
    };
  }

  if (/easy|легк|light|recovery|восстан/i.test(text)) {
    return {
      kind: 'easy', from: 2, to: 3, scaleMax: 10,
      title: ru ? 'Легко' : 'Easy',
      what: ru ? 'Разминка или заминка: движение, а не нагрузка.' : 'Warm-up or cool-down: movement, not load.',
      feel: ru ? 'Дыхание ровное, разговор свободный, ничего не жжёт.' : 'Breathing steady, easy to talk, nothing burns.',
      check: ru ? 'Если хочется ускориться, это нормально. Не надо.' : 'If you feel like speeding up, that is normal. Do not.',
      legend: [],
    };
  }

  return null;
};
