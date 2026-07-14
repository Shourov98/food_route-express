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

function parseCategory(value) {
  const normalized = String(value ?? 'general_rewards').trim().toLowerCase();
  return normalized || 'general_rewards';
}

function rewardFromData(data) {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    pointsRequired: Number(data.pointsRequired ?? 0),
    quantityAvailable: Number(data.quantityAvailable ?? 0),
    rewardCategory: parseCategory(data.rewardCategory),
    xpPoints: data.xpPoints ?? null,
    foodItemName: data.foodItemName ?? null,
    discountPercentage: data.discountPercentage ?? null,
    giftCardCode: data.giftCardCode ?? null,
    termsAndConditions: data.termsAndConditions ?? null,
    imageUrl: data.imageUrl ?? null,
    isActive: Boolean(data.isActive),
    hasExpiry: Boolean(data.hasExpiry),
    expiresAt: toDate(data.expiresAt),
    createdBy: data.createdBy,
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  };
}

// Re-export the parser so transactional callers (e.g. BR-006
// rewardRedemptionService.redeemReward) can normalize a freshly-read reward
// snapshot without having to duplicate the field-mapping logic.
export { rewardFromData };

export class FirestoreRewardRepository {
  constructor(firestore) {
    this.collection = firestore.collection('rewards');
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
    return rewardFromData(snapshot.data());
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map((doc) => rewardFromData(doc.data()));
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
