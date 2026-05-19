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

function supportRequestFromData(data = {}, fallbackId = 'unknown-support-request') {
  const createdAt = toDate(data.createdAt ?? data.created_at ?? data.updatedAt ?? data.updated_at) ?? new Date();
  const updatedAt =
    toDate(data.updatedAt ?? data.updated_at ?? data.createdAt ?? data.created_at) ?? createdAt;

  return {
    id: String(data.id ?? fallbackId),
    title: String(data.title ?? ''),
    message: String(data.message ?? ''),
    status: String(data.status ?? 'open').toLowerCase(),
    createdByUid: String(data.createdByUid ?? data.created_by_uid ?? ''),
    createdByEmail: String(data.createdByEmail ?? data.created_by_email ?? ''),
    createdByName: String(data.createdByName ?? data.created_by_name ?? ''),
    createdAt,
    updatedAt,
  };
}

export function buildSupportRequestRecordId() {
  return randomUUID();
}

export class FirestoreSupportRequestRepository {
  constructor(firestore) {
    this.collection = firestore.collection('support_requests');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async getById(requestId) {
    const snapshot = await this.collection.doc(requestId).get();
    if (!snapshot.exists) {
      return null;
    }
    return supportRequestFromData(snapshot.data(), snapshot.id);
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map((doc) => supportRequestFromData(doc.data(), doc.id));
  }
}
