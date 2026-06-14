import { randomUUID } from 'node:crypto';

function toDate(value) {
  if (!value) {
    return new Date();
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  return new Date(value);
}

function checkinFromData(data) {
  return {
    id: data.id,
    userId: data.userId,
    userFullname: data.userFullname ?? '',
    userEmail: data.userEmail ?? '',
    restaurantId: data.restaurantId,
    restaurantName: data.restaurantName ?? '',
    restaurantAddress: data.restaurantAddress ?? '',
    qrToken: data.qrToken,
    awardedXp: Number(data.awardedXp ?? 0),
    awardedPoints: Number(data.awardedPoints ?? data.awardedXp ?? 0),
    createdAt: toDate(data.createdAt ?? data.updatedAt),
  };
}

export class FirestoreCheckInRepository {
  constructor(firestore) {
    this.collection = firestore.collection('checkins');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async getById(checkinId) {
    const snapshot = await this.collection.doc(checkinId).get();
    if (!snapshot.exists) {
      return null;
    }
    return checkinFromData(snapshot.data());
  }

  async getRecentByUser(userId) {
    const records = await this.listByUser(userId);
    return records[0] ?? null;
  }

  async getRecentByUserAndRestaurant({ userId, restaurantId }) {
    const records = (await this.listByUser(userId)).filter((record) => record.restaurantId === restaurantId);
    return records[0] ?? null;
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs
      .map((doc) => checkinFromData(doc.data()))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs
      .map((doc) => checkinFromData(doc.data()))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async countAll() {
    return (await this.listAll()).length;
  }

  async countByUser(userId) {
    return (await this.listByUser(userId)).length;
  }
}

export function buildCheckInRecordId() {
  return randomUUID();
}
