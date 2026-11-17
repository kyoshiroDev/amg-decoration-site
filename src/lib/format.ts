/**
 * Formatage d'affichage en français (typographie : espaces insécables U+00A0 / U+202F).
 */
import type { DayOfWeek, OpeningHoursRule } from '@/config/site';

const NBSP = ' ';

const DAY_ORDER: readonly DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_LABELS: Readonly<Record<DayOfWeek, string>> = {
  Monday: 'lundi',
  Tuesday: 'mardi',
  Wednesday: 'mercredi',
  Thursday: 'jeudi',
  Friday: 'vendredi',
  Saturday: 'samedi',
  Sunday: 'dimanche',
};

/** « 09:00 » → « 9 h », « 17:30 » → « 17 h 30 ». */
export function formatClockTime(time: string): string {
  const [hours = '0', minutes = '00'] = time.split(':');
  const h = String(Number(hours));
  return minutes === '00' ? `${h}${NBSP}h` : `${h}${NBSP}h${NBSP}${minutes}`;
}

/** Regroupe des jours en plages consécutives (dans l'ordre de la semaine). */
function toRanges(days: readonly DayOfWeek[]): DayOfWeek[][] {
  const sorted = [...new Set(days)].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  const ranges: DayOfWeek[][] = [];
  for (const day of sorted) {
    const current = ranges.at(-1);
    const previous = current?.at(-1);
    if (current && previous && DAY_ORDER.indexOf(day) === DAY_ORDER.indexOf(previous) + 1) {
      current.push(day);
    } else {
      ranges.push([day]);
    }
  }
  return ranges;
}

function formatDays(days: readonly DayOfWeek[]): string {
  const parts = toRanges(days).map((range) => {
    const first = range[0];
    const last = range.at(-1);
    if (!first || !last) return '';
    if (range.length >= 3) return `du ${DAY_LABELS[first]} au ${DAY_LABELS[last]}`;
    return range.map((d) => `le ${DAY_LABELS[d]}`).join(' et ');
  });
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** [« Du lundi au vendredi, 9 h – 17 h »]. */
export function formatOpeningHours(rules: readonly OpeningHoursRule[]): string[] {
  return rules.map(
    (rule) =>
      `${formatDays(rule.days)}, ${formatClockTime(rule.opens)}${NBSP}– ${formatClockTime(rule.closes)}`,
  );
}

/** Lien téléphonique à partir d'un numéro E.164. */
export function formatPhoneHref(e164: string): `tel:${string}` {
  return `tel:${e164.replace(/[^\d+]/g, '')}`;
}
