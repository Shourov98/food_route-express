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

function participationFromData(data = {}, fallbackId = 'unknown-participation') {
  return {
    id: String(data.id ?? fallbackId),
    challengeId: String(data.challengeId ?? ''),
    challengeTitle: String(data.challengeTitle ?? ''),
    challengeDescription: String(data.challengeDescription ?? ''),
    rewardPoints: Number(data.rewardPoints ?? 0),
    userId: String(data.userId ?? ''),
    userFullname: String(data.userFullname ?? ''),
    userEmail: String(data.userEmail ?? ''),
    status: String(data.status ?? 'in_progress').toLowerCase(),
    criteria: Array.isArray(data.criteria)
      ? data.criteria.map((item) => ({
          id: String(item.id ?? randomUUID()),
          type: String(item.type ?? 'check_in_count').toLowerCase(),
          requiredCount: Number(item.requiredCount ?? 0),
          currentCount: Number(item.currentCount ?? 0),
          completed: Boolean(item.completed ?? false),
        }))
      : [],
    totalCheckIns: Number(data.totalCheckIns ?? 0),
    progressPercent: Number(data.progressPercent ?? 0),
    startedAt: toDate(data.startedAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
    completedAt: toDate(data.completedAt),
  };
}

export function buildChallengeParticipationRecordId() {
  return randomUUID();
}

export class FirestoreChallengeParticipationRepository {
  constructor(firestore) {
    this.collection = firestore.collection('challenge_participations');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async update(participationId, record) {
    const ref = this.collection.doc(participationId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(record);
    return record;
  }

  async getById(participationId) {
    const snapshot = await this.collection.doc(participationId).get();
    if (!snapshot.exists) {
      return null;
    }
    return participationFromData(snapshot.data(), snapshot.id);
  }

  async getByUserAndChallenge({ userId, challengeId }) {
    const records = await this.listByUser(userId);
    return records.find((record) => record.challengeId === challengeId) ?? null;
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs
      .map((doc) => participationFromData(doc.data(), doc.id))
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
  }

  async listByChallenge(challengeId) {
    const snapshot = await this.collection.where('challengeId', '==', challengeId).get();
    return snapshot.docs
      .map((doc) => participationFromData(doc.data(), doc.id))
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs
      .map((doc) => participationFromData(doc.data(), doc.id))
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
  }
}
