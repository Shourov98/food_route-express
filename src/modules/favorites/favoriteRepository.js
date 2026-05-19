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

function favoriteFromData(data = {}, fallbackId = 'unknown-favorite') {
  const createdAt = toDate(data.createdAt ?? data.created_at ?? data.updatedAt) ?? new Date();
  const updatedAt =
    toDate(data.updatedAt ?? data.updated_at ?? data.createdAt ?? data.created_at) ?? createdAt;

  return {
    id: String(data.id ?? fallbackId),
    userId: String(data.userId ?? data.user_id ?? ''),
    restaurantId: String(data.restaurantId ?? data.restaurant_id ?? ''),
    createdAt,
    updatedAt,
  };
}

export function buildUserFavoriteRestaurantRecordId(userId, restaurantId) {
  return `${userId}:${restaurantId}`;
}

export class FirestoreFavoriteRepository {
  constructor(firestore) {
    this.collection = firestore.collection('user_favorite_restaurants');
  }

  async create(record) {
    await this.collection.doc(record.id).set({
      id: record.id,
      userId: record.userId,
      restaurantId: record.restaurantId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
    return record;
  }

  async delete(userId, restaurantId) {
    const documentId = buildUserFavoriteRestaurantRecordId(userId, restaurantId);
    const ref = this.collection.doc(documentId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }

  async getByUserAndRestaurant(userId, restaurantId) {
    const snapshot = await this.collection
      .doc(buildUserFavoriteRestaurantRecordId(userId, restaurantId))
      .get();
    if (!snapshot.exists) {
      return null;
    }
    return favoriteFromData(snapshot.data(), snapshot.id);
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs
      .map((doc) => favoriteFromData(doc.data(), doc.id))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
}
