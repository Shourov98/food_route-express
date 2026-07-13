import assert from 'node:assert/strict';
import test from 'node:test';

import { FirestoreLoginEventRepository } from '../src/modules/auth/authRepository.js';

class FakeQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
  }
}

class FakeQuery {
  constructor(docs) {
    this._docs = docs;
  }

  where(field, op, value) {
    return new FakeQuery(this._docs.filter((doc) => doc.data()[field] === value));
  }

  async get() {
    return new FakeQuerySnapshot(this._docs);
  }
}

class FakeCollection {
  constructor(docs) {
    this._docs = docs;
  }

  where(field, op, value) {
    return new FakeQuery(this._docs.filter((doc) => doc.data()[field] === value));
  }
}

class FakeFirestore {
  constructor(docs) {
    this._collection = new FakeCollection(docs);
  }

  collection(name) {
    // Only one collection is used by the repository.
    if (name !== 'login_events') {
      throw new Error(`Unexpected collection in test: ${name}`);
    }
    return this._collection;
  }
}

class FakeDocument {
  constructor(payload) {
    this.id = payload.id;
    this._payload = payload;
  }

  data() {
    return this._payload;
  }
}

function loginEventDoc({ id, userId, createdAt }) {
  return new FakeDocument({ id, userId, createdAt });
}

function buildRepo(events) {
  return new FirestoreLoginEventRepository(new FakeFirestore(events));
}

const dayMs = 86_400_000;
const utcMidnightIso = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function daysAgoIso(days) {
  const d = new Date(Date.now() - days * dayMs);
  return new Date(`${utcMidnightIso(d)}T00:00:00.000Z`);
}

test('countCurrentStreak returns 0 when the user has no login events', async () => {
  const repo = buildRepo([]);
  assert.equal(await repo.countCurrentStreak('user-1'), 0);
});

test('countCurrentStreak returns 1 when only a single login today exists', async () => {
  const repo = buildRepo([loginEventDoc({ id: 'e1', userId: 'user-1', createdAt: daysAgoIso(0) })]);
  assert.equal(await repo.countCurrentStreak('user-1'), 1);
});

test('countCurrentStreak returns 2 for a today + yesterday chain', async () => {
  const repo = buildRepo([
    loginEventDoc({ id: 'today', userId: 'user-1', createdAt: daysAgoIso(0) }),
    loginEventDoc({ id: 'yest', userId: 'user-1', createdAt: daysAgoIso(1) }),
  ]);
  assert.equal(await repo.countCurrentStreak('user-1'), 2);
});

test('countCurrentStreak returns 0 when the most recent login was 3 days ago', async () => {
  // Regression: previously the function returned 1 for any non-empty history.
  const repo = buildRepo([
    loginEventDoc({ id: 'd-3', userId: 'user-1', createdAt: daysAgoIso(3) }),
    loginEventDoc({ id: 'd-4', userId: 'user-1', createdAt: daysAgoIso(4) }),
    loginEventDoc({ id: 'd-5', userId: 'user-1', createdAt: daysAgoIso(5) }),
  ]);
  assert.equal(await repo.countCurrentStreak('user-1'), 0);
});

test('countCurrentStreak returns 2 when last login was yesterday but the prior day also has a login', async () => {
  // Boundary case: yesterday counts as a "live" day. The user has logged in
  // on two consecutive days ending yesterday — that chain is still intact
  // for today's purposes; logging in today would extend it to 3.
  const repo = buildRepo([
    loginEventDoc({ id: 'y', userId: 'user-1', createdAt: daysAgoIso(1) }),
    loginEventDoc({ id: 'd-2', userId: 'user-1', createdAt: daysAgoIso(2) }),
  ]);
  assert.equal(await repo.countCurrentStreak('user-1'), 2);
});

test('countCurrentStreak returns 1 when the only login was yesterday (no prior day)', async () => {
  // A single login yesterday with nothing else: the chain is exactly 1.
  const repo = buildRepo([
    loginEventDoc({ id: 'y', userId: 'user-1', createdAt: daysAgoIso(1) }),
  ]);
  assert.equal(await repo.countCurrentStreak('user-1'), 1);
});

test('countCurrentStreak de-duplicates multiple logins on the same day', async () => {
  const repo = buildRepo([
    loginEventDoc({ id: 'e1', userId: 'user-1', createdAt: daysAgoIso(0) }),
    loginEventDoc({ id: 'e2', userId: 'user-1', createdAt: daysAgoIso(0) }),
    loginEventDoc({ id: 'e3', userId: 'user-1', createdAt: daysAgoIso(1) }),
  ]);
  assert.equal(await repo.countCurrentStreak('user-1'), 2);
});

test('countCurrentStreak stops at a gap in the chain', async () => {
  // Today, yesterday, GAP, day-before-yesterday, day-before-that.
  // Should return 2 (the unbroken prefix).
  const repo = buildRepo([
    loginEventDoc({ id: 'd0', userId: 'user-1', createdAt: daysAgoIso(0) }),
    loginEventDoc({ id: 'd1', userId: 'user-1', createdAt: daysAgoIso(1) }),
    loginEventDoc({ id: 'd3', userId: 'user-1', createdAt: daysAgoIso(3) }),
    loginEventDoc({ id: 'd4', userId: 'user-1', createdAt: daysAgoIso(4) }),
  ]);
  assert.equal(await repo.countCurrentStreak('user-1'), 2);
});

test('countCurrentStreak only counts events for the requested user', async () => {
  const repo = buildRepo([
    loginEventDoc({ id: 'other1', userId: 'other-user', createdAt: daysAgoIso(0) }),
    loginEventDoc({ id: 'other2', userId: 'other-user', createdAt: daysAgoIso(1) }),
  ]);
  assert.equal(await repo.countCurrentStreak('user-1'), 0);
});

test('countCurrentStreak returns 0 when the only event was exactly 2 days ago', async () => {
  // Two days ago is the threshold: > 1 day old, so the streak is broken.
  const repo = buildRepo([
    loginEventDoc({ id: 'd-2', userId: 'user-1', createdAt: daysAgoIso(2) }),
  ]);
  assert.equal(await repo.countCurrentStreak('user-1'), 0);
});
