import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { JS_CLASS_SCRIPT } from '@/lib/inline-scripts';

// Empreinte CSP du script inline de <head> (ADR-0010). Si ce test échoue après une modification
// volontaire du script : reporter la nouvelle empreinte dans l'ADR et dans la CSP (Phase 7).
const EXPECTED_SHA256 = 'sha256-oO9dQz2/+Q17QWsmmtXJ9ZNoha86yQvUljQCBOLLu2E=';

describe('JS_CLASS_SCRIPT', () => {
  it('tient en moins de 200 octets', () => {
    expect(new TextEncoder().encode(JS_CLASS_SCRIPT).length).toBeLessThan(200);
  });

  it('a l’empreinte SHA-256 documentée pour la CSP', () => {
    const hash = createHash('sha256').update(JS_CLASS_SCRIPT).digest('base64');
    expect(`sha256-${hash}`).toBe(EXPECTED_SHA256);
  });
});
