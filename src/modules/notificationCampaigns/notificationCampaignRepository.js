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

function campaignFromData(data = {}, fallbackId = 'unknown-campaign') {
  return {
    id: String(data.id ?? fallbackId),
    campaignTitle: String(data.campaignTitle ?? data.campaignName ?? ''),
    campaignBody: String(data.campaignBody ?? data.messagePreview ?? ''),
    campaignCategory: String(data.campaignCategory ?? data.category ?? 'promotional').toLowerCase(),
    targetAudience: String(data.targetAudience ?? data.audience ?? 'all_users').toLowerCase(),
    cityName: data.cityName ?? data.city ?? null,
    ageGroup: data.ageGroup ?? data.age ?? null,
    deliveryType: String(data.deliveryType ?? 'send_now').toLowerCase(),
    scheduledAt: toDate(data.scheduledAt),
    sentAt: toDate(data.sentAt),
    status: String(data.status ?? 'active').toLowerCase(),
    deliveryRate: Number(data.deliveryRate ?? 0),
    createdBy: String(data.createdBy ?? ''),
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  };
}

export function buildNotificationCampaignRecordId() {
  return randomUUID();
}

export class FirestoreNotificationCampaignRepository {
  constructor(firestore) {
    this.collection = firestore.collection('notification_campaigns');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async update(campaignId, record) {
    const ref = this.collection.doc(campaignId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(record);
    return record;
  }

  async getById(campaignId) {
    const snapshot = await this.collection.doc(campaignId).get();
    if (!snapshot.exists) {
      return null;
    }
    return campaignFromData(snapshot.data(), snapshot.id);
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map((doc) => campaignFromData(doc.data(), doc.id));
  }

  async delete(campaignId) {
    const ref = this.collection.doc(campaignId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }
}
