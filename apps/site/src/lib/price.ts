/**
 * Affichage des tarifs des prestations (ADR-0007) : formatage français et règle d'affichage
 * pilotée par `site.pricing.showPrices`. Jamais utilisé pour du JSON-LD (`Offer` interdit).
 */

export interface PriceInput {
  readonly amount: number;
  readonly currency: 'EUR';
  readonly from: boolean;
  readonly note?: string | undefined;
}

export interface QuoteInput {
  readonly label: string;
  readonly note?: string | undefined;
}

export interface PriceDisplay {
  /** Texte principal : « 189 € », « À partir de 189 € » ou « Devis professionnel ». */
  readonly label: string;
  readonly note: string | undefined;
  readonly kind: 'price' | 'quote';
}

export interface PriceDisplayOptions {
  readonly showPrices: boolean;
  /** Préfixe des prix « à partir de » (microcopie). */
  readonly fromLabel: string;
}

const formatters = new Map<string, Intl.NumberFormat>();

/** « 189 € », « 1 000 € » (espaces insécables de la locale fr-FR). */
export function formatAmount(amount: number, currency: PriceInput['currency']): string {
  const key = `${currency}:${Number.isInteger(amount)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    });
    formatters.set(key, formatter);
  }
  return formatter.format(amount);
}

/**
 * Ce qu'il faut afficher pour une prestation : le prix (si les prix sont publics), le libellé
 * de devis, ou rien. Un devis n'est pas un prix : il reste affiché même si `showPrices` est faux.
 */
export function resolvePriceDisplay(
  offer: { readonly price?: PriceInput | undefined; readonly quote?: QuoteInput | undefined },
  options: PriceDisplayOptions,
): PriceDisplay | undefined {
  const { price, quote } = offer;
  if (price && options.showPrices) {
    const amount = formatAmount(price.amount, price.currency);
    return {
      kind: 'price',
      label: price.from ? `${options.fromLabel}\u00A0${amount}` : amount,
      note: price.note,
    };
  }
  if (quote) {
    return { kind: 'quote', label: quote.label, note: quote.note };
  }
  return undefined;
}
