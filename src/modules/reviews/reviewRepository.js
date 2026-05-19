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

function reviewFromData(data = {}, fallbackId = 'unknown-review') {
  const createdAt = toDate(data.createdAt ?? data.updatedAt) ?? new Date();
  const updatedAt = toDate(data.updatedAt ?? data.createdAt) ?? createdAt;

  return {
    id: String(data.id ?? fallbackId),
    restaurantId: String(data.restaurantId ?? 'unknown-restaurant'),
    userId: String(data.userId ?? 'unknown-user'),
    userFullname: String(data.userFullname ?? ''),
    userEmail: String(data.userEmail ?? ''),
    rating: Number(data.rating ?? 0),
    comment: data.comment ?? null,
    createdAt,
    updatedAt,
  };
}

export function buildRestaurantReviewRecordId() {
  return randomUUID();
}

export class FirestoreReviewRepository {
  constructor(firestore) {
    this.collection = firestore.collection('restaurant_reviews');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async update(reviewId, record) {
    const ref = this.collection.doc(reviewId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(record);
    return record;
  }

  async getById(reviewId) {
    const snapshot = await this.collection.doc(reviewId).get();
    if (!snapshot.exists) {
      return null;
    }
    return reviewFromData(snapshot.data(), snapshot.id);
  }

  async getByUserAndRestaurant({ userId, restaurantId }) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('restaurantId', '==', restaurantId)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return null;
    }
    return reviewFromData(snapshot.docs[0].data(), snapshot.docs[0].id);
  }

  async listByRestaurant(restaurantId) {
    const snapshot = await this.collection.where('restaurantId', '==', restaurantId).get();
    return snapshot.docs
      .map((doc) => reviewFromData(doc.data(), doc.id))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async delete(reviewId) {
    const ref = this.collection.doc(reviewId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }
}
