// Enveloppe d'un secret chargé au démarrage : sa valeur ne sort que par `reveal()`. Toute
// sérialisation accidentelle (journal, JSON, gabarit de chaîne, util.inspect) affiche un masque.
import { inspect } from 'node:util';

export const SECRET_MASK = '[secret]';

export class SecretValue {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  /** Valeur en clair : à n'appeler qu'au point d'usage (connexion, HMAC…), jamais pour journaliser. */
  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return SECRET_MASK;
  }

  toJSON(): string {
    return SECRET_MASK;
  }

  [inspect.custom](): string {
    return SECRET_MASK;
  }
}
