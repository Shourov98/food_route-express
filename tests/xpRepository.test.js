// Regression tests for xpRepository — Firestore rejects `undefined` as a
// document field value. The repository must default city/country to '' so
// callers that omit them don't crash production.
//
// We exercise the FALLBACK non-transactional path (no runTransaction on the
// fake). Production uses runTransaction — both paths share the same payload
// builder, so the same null-safety guarantee applies.

import assert from 'node:assert/strict';
import test from 'node:test';

import { FirestoreXpLedgerRepository, FirestorePointsLedgerRepository } from '../src/modules/xp/xpRepository.js';

class StrictInMemoryFirestore {
  constructor() {
    this.docs = new Map();
  }

  collection(name) {
    if (name !== 'xp_ledger' && name !== 'points_ledger') {
      throw new Error(`Unexpected collection: ${name}`);
    }
    const store = this.docs;
    return {
      where() {
        // No-op stub for the fallback getBySource existence check.
        return {
          where() { return this; },
          limit() {
            return {
              async get() {
                return { empty: true, docs: [], size: 0 };
              },
            };
          },
        };
      },
      doc(id) {
        const docRef = {
          id,
          async set(payload) {
            // Walk all values; reject undefined at any depth.
            const seen = new WeakSet();
            const walk = (value, path) => {
              if (value && typeof value === 'object') {
                if (seen.has(value)) return;
                seen.add(value);
                for (const [k, v] of Object.entries(value)) {
                  if (v === undefined) {
                    throw new Error(
                      `Cannot use "undefined" as a Firestore value (found in field "${path}.${k}")`,
                    );
                  }
                  walk(v, `${path}.${k}`);
                }
              }
            };
            walk(payload, name);
            store.set(id, payload);
            return Promise.resolve();
          },
        };
        return docRef;
      },
    };
  }
}

test('createIfAbsent defaults city and country when omitted', async () => {
  const firestore = new StrictInMemoryFirestore();
  const repo = new FirestoreXpLedgerRepository(firestore);

  // Note: no runTransaction on this fake, so the repo falls through to the
  // non-transactional branch (lines 125-137 of xpRepository.js).
  // Both branches build the same payload, so the null-safety applies.
  await assert.doesNotReject(
    repo.createIfAbsent({
      userId: 'u-1',
      sourceType: 'check_in',
      sourceId: 'src-1',
      xpDelta: 20,
    }),
  );
  const written = [...firestore.docs.values()][0];
  assert.equal(written.city, '');
  assert.equal(written.country, '');
});

test('createIfAbsent coerces explicit undefined to empty string', async () => {
  const firestore = new StrictInMemoryFirestore();
  const repo = new FirestoreXpLedgerRepository(firestore);

  await assert.doesNotReject(
    repo.createIfAbsent({
      userId: 'u-2',
      sourceType: 'check_in',
      sourceId: 'src-2',
      xpDelta: 30,
      city: undefined,
      country: undefined,
    }),
  );
  const written = [...firestore.docs.values()][0];
  assert.equal(written.city, '');
  assert.equal(written.country, '');
});

test('createIfAbsent preserves legitimate city/country values', async () => {
  const firestore = new StrictInMemoryFirestore();
  const repo = new FirestoreXpLedgerRepository(firestore);

  await repo.createIfAbsent({
    userId: 'u-3',
    sourceType: 'check_in',
    sourceId: 'src-3',
    xpDelta: 40,
    city: 'Mexico City',
    country: 'MX',
  });
  const written = [...firestore.docs.values()][0];
  assert.equal(written.city, 'Mexico City');
  assert.equal(written.country, 'MX');
});

test('points ledger createIfAbsent defaults city and country when omitted', async () => {
  const firestore = new StrictInMemoryFirestore();
  const repo = new FirestorePointsLedgerRepository(firestore);

  await assert.doesNotReject(
    repo.createIfAbsent({
      userId: 'u-4',
      sourceType: 'reward_redemption',
      sourceId: 'src-4',
      pointsDelta: -50,
    }),
  );
  const written = [...firestore.docs.values()][0];
  assert.equal(written.city, '');
  assert.equal(written.country, '');
});
