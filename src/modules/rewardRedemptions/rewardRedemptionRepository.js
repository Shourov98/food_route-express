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

function redemptionFromData(data = {}, fallbackId = 'unknown-redemption') {
  const redeemedAt = toDate(data.redeemedAt ?? data.updatedAt ?? data.createdAt) ?? new Date();
  const createdAt = toDate(data.createdAt ?? data.updatedAt ?? redeemedAt) ?? redeemedAt;
  const updatedAt = toDate(data.updatedAt ?? createdAt) ?? createdAt;
  return {
    id: String(data.id ?? fallbackId),
    rewardId: String(data.rewardId ?? ''),
    userId: String(data.userId ?? ''),
    sourceType: data.sourceType ?? null,
    sourceId: data.sourceId ?? null,
    rewardTitle: String(data.rewardTitle ?? ''),
    rewardDescription: String(data.rewardDescription ?? ''),
    rewardImageUrl: data.rewardImageUrl ?? null,
    rewardCategory: String(data.rewardCategory ?? 'general_rewards').toLowerCase(),
    pointsRequired: Number(data.pointsRequired ?? 0),
    xpPoints: data.xpPoints ?? null,
    foodItemName: data.foodItemName ?? null,
    discountPercentage: data.discountPercentage ?? null,
    giftCardCode: data.giftCardCode ?? null,
    termsAndConditions: data.termsAndConditions ?? null,
    status: String(data.status ?? 'claimed').toLowerCase(),
    redeemedAt,
    usedAt: toDate(data.usedAt),
    createdAt,
    updatedAt,
  };
}

export class FirestoreRewardRedemptionRepository {
  constructor(firestore) {
    this.collection = firestore.collection('reward_redemptions');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async getByUserAndSource({ userId, sourceType, sourceId }) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('sourceType', '==', sourceType)
      .where('sourceId', '==', sourceId)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return null;
    }
    return redemptionFromData(snapshot.docs[0].data(), snapshot.docs[0].id);
  }

  async getById(redemptionId) {
    const snapshot = await this.collection.doc(redemptionId).get();
    if (!snapshot.exists) {
      return null;
    }
    return redemptionFromData(snapshot.data(), snapshot.id);
  }

  async update(redemptionId, record) {
    const ref = this.collection.doc(redemptionId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(record);
    return record;
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs
      .map((doc) => redemptionFromData(doc.data(), doc.id))
      .sort((left, right) => right.redeemedAt.getTime() - left.redeemedAt.getTime());
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map((doc) => redemptionFromData(doc.data(), doc.id));
  }

  async countByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.size;
  }

  async delete(redemptionId) {
    const ref = this.collection.doc(redemptionId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }
}
