import { describe, expect, it } from 'vitest';
import { formatAmount, resolvePriceDisplay } from '@/lib/price';
import { projectPath, servicePath } from '@/lib/routes';
import { SITE_ROUTES } from '../site-routes';

const NBSP = '\u00A0';
const NNBSP = '\u202F';
const options = { showPrices: true, fromLabel: 'À partir de' };

describe('formatAmount', () => {
  it('formate un montant entier en euros, sans décimales, avec espace insécable', () => {
    expect(formatAmount(189, 'EUR')).toBe(`189${NBSP}€`);
  });

  it('sépare les milliers par une espace fine insécable', () => {
    expect(formatAmount(1200, 'EUR')).toBe(`1${NNBSP}200${NBSP}€`);
  });

  it('garde deux décimales pour un montant non entier', () => {
    expect(formatAmount(189.5, 'EUR')).toBe(`189,50${NBSP}€`);
  });
});

describe('resolvePriceDisplay', () => {
  const price = { amount: 339, currency: 'EUR' as const, from: false };

  it('affiche le prix quand les prix sont publics', () => {
    expect(resolvePriceDisplay({ price }, options)).toEqual({
      kind: 'price',
      label: `339${NBSP}€`,
      note: undefined,
    });
  });

  it('préfixe un prix « à partir de » et transmet la note', () => {
    expect(
      resolvePriceDisplay({ price: { ...price, from: true, note: 'par pièce' } }, options),
    ).toEqual({ kind: 'price', label: `À partir de${NBSP}339${NBSP}€`, note: 'par pièce' });
  });

  it('masque le prix quand showPrices vaut false', () => {
    expect(resolvePriceDisplay({ price }, { ...options, showPrices: false })).toBeUndefined();
  });

  it('affiche toujours un devis, qui n’est pas un prix', () => {
    const quote = { label: 'Devis professionnel', note: 'Tarif dégressif' };
    expect(resolvePriceDisplay({ quote }, { ...options, showPrices: false })).toEqual({
      kind: 'quote',
      label: 'Devis professionnel',
      note: 'Tarif dégressif',
    });
  });

  it('ne retourne rien sans prix ni devis', () => {
    expect(resolvePriceDisplay({}, options)).toBeUndefined();
  });
});

describe('routes', () => {
  it('construit les chemins de détail avec slash final', () => {
    expect(servicePath('confort')).toBe('/prestations/confort/');
    expect(projectPath('chalet-suisse')).toBe('/realisations/chalet-suisse/');
  });

  it('refuse un slug mal formé', () => {
    expect(() => servicePath('Confort')).toThrow(/Slug invalide/);
    expect(() => projectPath('chalet/suisse')).toThrow(/Slug invalide/);
    expect(() => projectPath('')).toThrow(/Slug invalide/);
  });

  it('produit des chemins déclarés dans SITE_ROUTES (redirections, sitemap)', () => {
    expect(SITE_ROUTES).toContain(servicePath('essentiel'));
    expect(SITE_ROUTES).toContain(projectPath('sous-sol-suite-parentale'));
  });
});
