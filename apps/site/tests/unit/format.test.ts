import { describe, expect, it } from 'vitest';
import { formatClockTime, formatOpeningHours, formatPhoneHref, splitEmphasis } from '@/lib/format';

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

describe('splitEmphasis', () => {
  it('découpe le titre autour du fragment', () => {
    expect(splitEmphasis('Atelier lumineux du jour', 'lumineux')).toEqual({
      before: 'Atelier ',
      emphasis: 'lumineux',
      after: ' du jour',
    });
  });

  it('ne retient que la première occurrence', () => {
    expect(splitEmphasis('en 3D, toujours en 3D', 'en 3D')).toEqual({
      before: '',
      emphasis: 'en 3D',
      after: ', toujours en 3D',
    });
  });

  it('rend le titre entier sans fragment ou si le fragment est introuvable', () => {
    const whole = { before: 'Contact', emphasis: undefined, after: '' };
    expect(splitEmphasis('Contact', undefined)).toEqual(whole);
    expect(splitEmphasis('Contact', '3D')).toEqual(whole);
  });
});
