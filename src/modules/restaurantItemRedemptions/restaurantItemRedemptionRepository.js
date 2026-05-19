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

function redemptionFromData(data = {}, fallbackId = 'unknown-item-redemption') {
  const redeemedAt = toDate(data.redeemedAt ?? data.updatedAt ?? data.createdAt) ?? new Date();
  const createdAt = toDate(data.createdAt ?? data.updatedAt ?? redeemedAt) ?? redeemedAt;
  const updatedAt = toDate(data.updatedAt ?? createdAt) ?? createdAt;
  return {
    id: String(data.id ?? fallbackId),
    userId: String(data.userId ?? ''),
    itemId: String(data.itemId ?? ''),
    restaurantId: String(data.restaurantId ?? ''),
    restaurantName: String(data.restaurantName ?? ''),
    restaurantAddress: String(data.restaurantAddress ?? ''),
    itemName: String(data.itemName ?? ''),
    itemDescription: String(data.itemDescription ?? ''),
    itemImageUrl: data.itemImageUrl ?? null,
    pointsSpent: Number(data.pointsSpent ?? 0),
    redeemedAt,
    createdAt,
    updatedAt,
  };
}

export class FirestoreRestaurantItemRedemptionRepository {
  constructor(firestore) {
    this.collection = firestore.collection('restaurant_item_redemptions');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs
      .map((doc) => redemptionFromData(doc.data(), doc.id))
      .sort((left, right) => right.redeemedAt.getTime() - left.redeemedAt.getTime());
  }

  async countByUser(userId) {
    return (await this.listByUser(userId)).length;
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

export function buildRestaurantItemRedemptionRecordId() {
  return crypto.randomUUID();
}
