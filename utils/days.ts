import { Language } from '../types';

/**
 * The plan is always exactly 7 entries, Monday first, so a day is identified by
 * its index. The model's own `day` string is NOT used for display: it comes back
 * in whatever language the model felt like, which produced headings such as
 * "Рацион на Thursday".
 */
export const DAY_NAMES: Record<Language, string[]> = {
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  ru: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
};

export const SHORT_DAY_NAMES: Record<Language, string[]> = {
  en: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  ru: ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'],
};

export const dayLabel = (index: number, language: Language): string =>
  (DAY_NAMES[language] ?? DAY_NAMES.en)[index] ?? '';

export const shortDayLabel = (index: number, language: Language): string =>
  (SHORT_DAY_NAMES[language] ?? SHORT_DAY_NAMES.en)[index] ?? String(index + 1);
