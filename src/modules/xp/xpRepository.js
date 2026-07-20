import crypto from 'node:crypto';

function toDate(value) {
  if (!value) {
    return new Date();
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  return new Date(value);
}

// Build the deterministic dedupe key used by both the XP and points ledgers.
// The ledger collection indexes on (userId, sourceType, sourceId) so that
// getBySource can answer "has this event already been awarded?" cheaply.
//
// Returns null when the record is missing required fields — the caller is
// then responsible for skipping the award (rather than writing a row that
// can't be looked up later).
function buildDedupeKey(record) {
  if (!record || !record.userId || !record.sourceType || !record.sourceId) {
    return null;
  }
  return `${record.userId}::${record.sourceType}::${record.sourceId}`;
}

function xpFromDoc(doc) {
  const data = doc.data();
  return {
    id: data.id ?? doc.id,
    userId: data.userId,
    sourceType: data.sourceType,
    sourceId: data.sourceId,
    xpDelta: Number(data.xpDelta ?? 0),
    eventId: data.eventId ?? data.sourceId,
    balanceType: data.balanceType ?? 'ranking',
    balanceBefore: Number(data.balanceBefore ?? 0),
    balanceAfter: Number(data.balanceAfter ?? 0),
    status: data.status ?? 'committed',
    city: data.city ?? '',
    country: data.country ?? '',
    createdAt: toDate(data.createdAt ?? data.created_at),
  };
}

function pointsFromDoc(doc) {
  const data = doc.data();
  return {
    id: data.id ?? doc.id,
    userId: data.userId,
    sourceType: data.sourceType,
    sourceId: data.sourceId,
    pointsDelta: Number(data.pointsDelta ?? 0),
    eventId: data.eventId ?? data.sourceId,
    balanceType: data.balanceType ?? 'wallet',
    balanceBefore: Number(data.balanceBefore ?? 0),
    balanceAfter: Number(data.balanceAfter ?? 0),
    status: data.status ?? 'committed',
    city: data.city ?? '',
    country: data.country ?? '',
    createdAt: toDate(data.createdAt ?? data.created_at),
  };
}

export class FirestoreXpLedgerRepository {
  constructor(firestore) {
    this.collection = firestore.collection('xp_ledger');
  }

  async create(record) {
    const id = record.id ?? crypto.randomUUID();
    await this.collection.doc(id).set({
      id,
      userId: record.userId,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      xpDelta: record.xpDelta,
      eventId: record.eventId ?? record.sourceId,
      balanceType: record.balanceType ?? 'ranking',
      balanceBefore: record.balanceBefore ?? 0,
      balanceAfter: record.balanceAfter ?? record.xpDelta,
      status: record.status ?? 'committed',
      city: record.city,
      country: record.country,
      createdAt: record.createdAt,
    });
    return { ...record, id };
  }

  /**
   * Atomically create a ledger row only if no row exists for the same
   * (userId, sourceType, sourceId) triple. Returns the existing record if
   * one was already present, or the freshly created record on success.
   *
   * This closes the read-then-write race that allowed two concurrent scans
   * with the same `checkInId` to both pass `getBySource` and both write a
   * row, double-awarding points.
   *
   * The transaction runs at SERIALIZABLE isolation in Firestore, so the
   * existence check and the write either both happen or neither does.
   */
  async createIfAbsent(record) {
    const id = record.id ?? crypto.randomUUID();
    const payload = {
      id,
      userId: record.userId,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      xpDelta: record.xpDelta,
      eventId: record.eventId ?? record.sourceId,
      balanceType: record.balanceType ?? 'ranking',
      balanceBefore: record.balanceBefore ?? 0,
      balanceAfter: record.balanceAfter ?? record.xpDelta,
      status: record.status ?? 'committed',
      // BR-002 + Firestore safety: never persist `undefined`. Some callers
      // forget to pass city/country and Firestore rejects the entire doc.
      city: record.city ?? '',
      country: record.country ?? '',
      createdAt: record.createdAt ?? new Date(),
    };
    const firestore = this.collection.firestore ?? this.collection.db;
    if (!firestore || typeof firestore.runTransaction !== 'function') {
      // Fallback for in-memory test fakes that don't expose runTransaction.
      const existing = await this.getBySource({
        userId: record.userId,
        sourceType: record.sourceType,
        sourceId: record.sourceId,
      });
      if (existing) {
        return null;
      }
      await this.collection.doc(id).set(payload);
      return { ...record, id };
    }
    return firestore.runTransaction(async (txn) => {
      const query = this.collection
        .where('userId', '==', record.userId)
        .where('sourceType', '==', record.sourceType)
        .where('sourceId', '==', record.sourceId)
        .limit(1);
      const snapshot = await txn.get(query);
      if (!snapshot.empty) {
        // Already awarded — return null so callers can short-circuit
        // downstream writes without rolling anything back.
        return null;
      }
      const docRef = this.collection.doc(id);
      txn.set(docRef, payload);
      return { ...record, id };
    });
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map(xpFromDoc);
  }

  async delete(recordId) {
    const ref = this.collection.doc(recordId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs.map(xpFromDoc);
  }

  async getBySource({ sourceType, sourceId, userId }) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('sourceType', '==', sourceType)
      .where('sourceId', '==', sourceId)
      .limit(1)
      .get();
    return snapshot.empty ? null : xpFromDoc(snapshot.docs[0]);
  }
}

export class FirestorePointsLedgerRepository {
  constructor(firestore) {
    this.collection = firestore.collection('points_ledger');
  }

  async create(record) {
    const id = record.id ?? crypto.randomUUID();
    await this.collection.doc(id).set({
      id,
      userId: record.userId,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      pointsDelta: record.pointsDelta,
      eventId: record.eventId ?? record.sourceId,
      balanceType: record.balanceType ?? 'wallet',
      balanceBefore: record.balanceBefore ?? 0,
      balanceAfter: record.balanceAfter ?? record.pointsDelta,
      status: record.status ?? 'committed',
      city: record.city,
      country: record.country,
      createdAt: record.createdAt,
    });
    return { ...record, id };
  }

  /**
   * Atomically create a wallet-points row only if no row exists for the same
   * (userId, sourceType, sourceId) triple. See FirestoreXpLedgerRepository
   * for the rationale — same race-window fix for the wallet ledger.
   */
  async createIfAbsent(record) {
    const id = record.id ?? crypto.randomUUID();
    const payload = {
      id,
      userId: record.userId,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      pointsDelta: record.pointsDelta,
      eventId: record.eventId ?? record.sourceId,
      balanceType: record.balanceType ?? 'wallet',
      balanceBefore: record.balanceBefore ?? 0,
      balanceAfter: record.balanceAfter ?? record.pointsDelta,
      status: record.status ?? 'committed',
      // Firestore safety: never persist `undefined`. See xp_ledger comment.
      city: record.city ?? '',
      country: record.country ?? '',
      createdAt: record.createdAt ?? new Date(),
    };
    const firestore = this.collection.firestore ?? this.collection.db;
    if (!firestore || typeof firestore.runTransaction !== 'function') {
      const existing = await this.getBySource({
        userId: record.userId,
        sourceType: record.sourceType,
        sourceId: record.sourceId,
      });
      if (existing) {
        return null;
      }
      await this.collection.doc(id).set(payload);
      return { ...record, id };
    }
    return firestore.runTransaction(async (txn) => {
      const query = this.collection
        .where('userId', '==', record.userId)
        .where('sourceType', '==', record.sourceType)
        .where('sourceId', '==', record.sourceId)
        .limit(1);
      const snapshot = await txn.get(query);
      if (!snapshot.empty) {
        return null;
      }
      const docRef = this.collection.doc(id);
      txn.set(docRef, payload);
      return { ...record, id };
    });
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs.map(pointsFromDoc);
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map(pointsFromDoc);
  }

  async delete(recordId) {
    const ref = this.collection.doc(recordId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }

  async getBySource({ sourceType, sourceId, userId }) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('sourceType', '==', sourceType)
      .where('sourceId', '==', sourceId)
      .limit(1)
      .get();
    return snapshot.empty ? null : pointsFromDoc(snapshot.docs[0]);
  }
}
