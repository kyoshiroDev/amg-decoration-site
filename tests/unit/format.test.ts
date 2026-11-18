import { describe, expect, it } from 'vitest';
import { formatClockTime, formatOpeningHours, formatPhoneHref } from '@/lib/format';

const NBSP = '\u00A0';

describe('formatClockTime', () => {
  it('formate une heure ronde et une heure avec minutes', () => {
    expect(formatClockTime('09:00')).toBe(`9${NBSP}h`);
    expect(formatClockTime('17:30')).toBe(`17${NBSP}h${NBSP}30`);
  });
});

describe('formatOpeningHours', () => {
  it('formate une plage de jours consécutifs', () => {
    expect(
      formatOpeningHours([
        {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:00',
          closes: '17:00',
        },
      ]),
    ).toEqual([`Du lundi au vendredi, 9${NBSP}h${NBSP}– 17${NBSP}h`]);
  });

  it('formate des jours isolés', () => {
    expect(formatOpeningHours([{ days: ['Saturday'], opens: '10:00', closes: '12:30' }])).toEqual([
      `Le samedi, 10${NBSP}h${NBSP}– 12${NBSP}h${NBSP}30`,
    ]);
  });

  it('formate plusieurs règles et plages disjointes', () => {
    const lines = formatOpeningHours([
      { days: ['Monday', 'Tuesday', 'Wednesday', 'Friday'], opens: '09:00', closes: '17:00' },
      { days: ['Saturday'], opens: '10:00', closes: '12:00' },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Du lundi au mercredi, le vendredi/);
  });
});

describe('formatPhoneHref', () => {
  it('produit un lien tel: sans espace', () => {
    expect(formatPhoneHref('+33 7 82 35 81 32')).toBe('tel:+33782358132');
  });
});
