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

function historyFromData(data) {
  return {
    id: data.id,
    userId: data.userId,
    rewardId: data.rewardId,
    rewardTitle: data.rewardTitle,
    rewardDescription: data.rewardDescription,
    rewardCategory: data.rewardCategory ?? 'points',
    pointsReward: Number(data.pointsReward ?? data.discountPercentage ?? 0),
    pointsRequired: Number(data.pointsRequired ?? 0),
    rewardImageUrl: data.rewardImageUrl ?? null,
    isSynthetic: Boolean(data.isSynthetic ?? false),
    spunAt: toDate(data.spunAt ?? data.updatedAt ?? data.createdAt) ?? new Date(),
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  };
}

export class FirestoreSpinRepository {
  constructor(firestore) {
    this.collection = firestore.collection('spin_history');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs
      .map((doc) => historyFromData(doc.data()))
      .sort((left, right) => right.spunAt.getTime() - left.spunAt.getTime());
  }

  async getLatestByUser(userId) {
    const list = await this.listByUser(userId);
    return list[0] ?? null;
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs
      .map((doc) => historyFromData(doc.data()))
      .sort((left, right) => right.spunAt.getTime() - left.spunAt.getTime());
  }
}

export class FirestoreSpinWheelSettingsRepository {
  constructor(firestore) {
    this.document = firestore.collection('spin_wheel_settings').doc('current');
  }

  async getCurrent() {
    const snapshot = await this.document.get();
    if (!snapshot.exists) {
      const now = new Date();
      return {
        id: 'current',
        resetLogic: 'daily',
        resetTimeUtc: '00:00',
        noRewardProbability: 0,
        createdAt: now,
        updatedAt: now,
      };
    }
    const data = snapshot.data();
    return {
      id: data.id ?? 'current',
      resetLogic: String(data.resetLogic ?? 'daily'),
      resetTimeUtc: String(data.resetTimeUtc ?? '00:00'),
      noRewardProbability: Number(data.noRewardProbability ?? 0),
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  }

  async update(record) {
    const now = new Date();
    const updated = {
      id: record.id ?? 'current',
      resetLogic: record.resetLogic,
      resetTimeUtc: record.resetTimeUtc,
      noRewardProbability: record.noRewardProbability,
      createdAt: record.createdAt ?? now,
      updatedAt: now,
    };
    await this.document.set(updated);
    return updated;
  }
}
