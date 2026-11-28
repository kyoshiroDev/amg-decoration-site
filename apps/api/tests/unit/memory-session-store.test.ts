// Le magasin en mémoire des tests HTTP respecte le même contrat que le magasin Redis (éprouvé contre
// un vrai Redis par tests/integration/session-store.test.ts) : les tests HTTP en dépendent.
import { MemorySessionStore, TestClock } from '../support/memory-infrastructure.js';
import { describeSessionStoreContract } from '../support/session-store-contract.js';

describeSessionStoreContract('mémoire (tests HTTP)', () => {
  const clock = new TestClock();
  return Promise.resolve({
    store: new MemorySessionStore(clock),
    clock,
    cleanup: () => Promise.resolve(),
  });
});
