import crypto from 'node:crypto';

function toDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  return new Date(value);
}

function levelFromData(data = {}, fallbackId = 'unknown-level') {
  const createdAt = toDate(data.createdAt ?? data.created_at ?? data.updatedAt) ?? new Date();
  const updatedAt = toDate(data.updatedAt ?? data.updated_at ?? data.createdAt) ?? createdAt;
  return {
    id: String(data.id ?? fallbackId),
    name: String(data.name ?? ''),
    minXp: Number(data.minXp ?? data.min_xp ?? 0),
    createdAt,
    updatedAt,
  };
}

export function buildLevelRecordId() {
  return crypto.randomUUID();
}

export class FirestoreLevelRepository {
  constructor(firestore) {
    this.collection = firestore.collection('levels');
  }

  async create(record) {
    await this.collection.doc(record.id).set({
      id: record.id,
      name: record.name,
      minXp: record.minXp,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
    return record;
  }

  async getById(levelId) {
    const snapshot = await this.collection.doc(levelId).get();
    if (!snapshot.exists) {
      return null;
    }
    return levelFromData(snapshot.data(), snapshot.id);
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs
      .map((doc) => levelFromData(doc.data(), doc.id))
      .sort((left, right) => left.minXp - right.minXp || left.createdAt.getTime() - right.createdAt.getTime());
  }

  async update(levelId, record) {
    const ref = this.collection.doc(levelId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set({
      id: record.id,
      name: record.name,
      minXp: record.minXp,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
    return record;
  }

  async delete(levelId) {
    const ref = this.collection.doc(levelId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }
}
