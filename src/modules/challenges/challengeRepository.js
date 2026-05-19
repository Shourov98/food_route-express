import { randomUUID } from 'node:crypto';

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

function challengeFromData(data = {}, fallbackId = 'unknown-challenge') {
  return {
    id: String(data.id ?? fallbackId),
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    rewardPoints: Number(data.rewardPoints ?? 0),
    rewardId: data.rewardId ?? null,
    startAt: toDate(data.startAt) ?? new Date(),
    endAt: toDate(data.endAt) ?? new Date(),
    status: String(data.status ?? 'pending').toLowerCase(),
    criteria: Array.isArray(data.criteria)
      ? data.criteria.map((item) => ({
          id: String(item.id ?? randomUUID()),
          type: String(item.type ?? 'check_in_count').toLowerCase(),
          requiredCount: Number(item.requiredCount ?? 0),
        }))
      : [],
    createdBy: String(data.createdBy ?? ''),
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  };
}

export function buildChallengeRecordId() {
  return randomUUID();
}

export function buildChallengeCriterionRecordId() {
  return randomUUID();
}

export class FirestoreChallengeRepository {
  constructor(firestore) {
    this.collection = firestore.collection('challenges');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async update(challengeId, record) {
    const ref = this.collection.doc(challengeId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(record);
    return record;
  }

  async getById(challengeId) {
    const snapshot = await this.collection.doc(challengeId).get();
    if (!snapshot.exists) {
      return null;
    }
    return challengeFromData(snapshot.data(), snapshot.id);
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs
      .map((doc) => challengeFromData(doc.data(), doc.id))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async delete(challengeId) {
    const ref = this.collection.doc(challengeId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }
}
