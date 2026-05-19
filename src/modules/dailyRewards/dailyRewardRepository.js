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

function dailyRewardFromData(data) {
  return {
    id: data.id,
    title: data.title ?? 'Points Reward',
    description: data.description ?? 'Claim a fixed points reward.',
    rewardCategory: 'points',
    pointsReward: Number(data.pointsReward ?? data.discountPercentage ?? 0),
    pointsRequired: Number(data.pointsRequired ?? 0),
    quantityAvailable: Number(data.quantityAvailable ?? 0),
    probability: Number(data.probability ?? 0),
    initialQuantityAvailable: Number(
      data.initialQuantityAvailable ?? data.quantityAvailable ?? 0,
    ),
    imageUrl: data.imageUrl ?? null,
    isActive: Boolean(data.isActive),
    hasExpiry: Boolean(data.hasExpiry),
    expiresAt: toDate(data.expiresAt),
    lastResetAt: toDate(data.lastResetAt),
    createdBy: data.createdBy,
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  };
}

export class FirestoreDailyRewardRepository {
  constructor(firestore) {
    this.collection = firestore.collection('daily_rewards');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async update(rewardId, record) {
    const ref = this.collection.doc(rewardId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(record);
    return record;
  }

  async getById(rewardId) {
    const snapshot = await this.collection.doc(rewardId).get();
    if (!snapshot.exists) {
      return null;
    }
    return dailyRewardFromData(snapshot.data());
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map((doc) => dailyRewardFromData(doc.data()));
  }

  async delete(rewardId) {
    const ref = this.collection.doc(rewardId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }
}
