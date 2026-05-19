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

function xpFromDoc(doc) {
  const data = doc.data();
  return {
    id: data.id ?? doc.id,
    userId: data.userId,
    sourceType: data.sourceType,
    sourceId: data.sourceId,
    xpDelta: Number(data.xpDelta ?? 0),
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
      city: record.city,
      country: record.country,
      createdAt: record.createdAt,
    });
    return { ...record, id };
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
      city: record.city,
      country: record.country,
      createdAt: record.createdAt,
    });
    return { ...record, id };
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
