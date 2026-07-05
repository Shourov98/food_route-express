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

function receiptUploadFromData(data) {
  return {
    id: data.id,
    checkinId: data.checkinId,
    userId: data.userId,
    restaurantId: data.restaurantId,
    restaurantName: data.restaurantName ?? '',
    receiptImageUrl: data.receiptImageUrl ?? null,
    receiptStoragePath: data.receiptStoragePath ?? null,
    awardedXp: Number(data.awardedXp ?? 0),
    awardedPoints: Number(data.awardedPoints ?? 0),
    createdAt: toDate(data.createdAt),
  };
}

export class FirestoreReceiptUploadRepository {
  constructor(firestore) {
    this.collection = firestore.collection('receipt_uploads');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async getByCheckinId(checkinId) {
    const snapshot = await this.collection.where('checkinId', '==', checkinId).limit(1).get();
    return snapshot.empty ? null : receiptUploadFromData(snapshot.docs[0].data());
  }
}

export function buildReceiptUploadRecordId() {
  return randomUUID();
}
