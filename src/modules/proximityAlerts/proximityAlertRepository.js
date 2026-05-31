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

function alertFromData(data = {}, fallbackId = 'unknown-alert') {
  const createdAt = toDate(data.createdAt ?? data.created_at ?? data.updatedAt) ?? new Date();
  const updatedAt = toDate(data.updatedAt ?? data.updated_at ?? data.createdAt) ?? createdAt;
  return {
    id: String(data.id ?? fallbackId),
    userId: String(data.userId ?? ''),
    restaurantId: String(data.restaurantId ?? ''),
    restaurantName: String(data.restaurantName ?? 'Restaurant'),
    restaurantAddress: String(data.restaurantAddress ?? ''),
    city: data.city ?? null,
    restaurantLatitude: Number(data.restaurantLatitude ?? 0),
    restaurantLongitude: Number(data.restaurantLongitude ?? 0),
    userLatitude: Number(data.userLatitude ?? 0),
    userLongitude: Number(data.userLongitude ?? 0),
    thresholdKm: Number(data.thresholdKm ?? 0),
    distanceKm: Number(data.distanceKm ?? 0),
    mapsUrl: String(data.mapsUrl ?? ''),
    createdAt,
    updatedAt,
  };
}

export function buildProximityAlertRecordId({ userId, restaurantId }) {
  return `${userId}:${restaurantId}`;
}

export class FirestoreProximityAlertRepository {
  constructor(firestore) {
    this.collection = firestore.collection('user_proximity_alerts');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs
      .map((doc) => alertFromData(doc.data(), doc.id))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async getByUserAndRestaurant({ userId, restaurantId }) {
    const snapshot = await this.collection.doc(buildProximityAlertRecordId({ userId, restaurantId })).get();
    if (!snapshot.exists) {
      return null;
    }
    return alertFromData(snapshot.data(), snapshot.id);
  }
}

export class FirestoreProximityAlertLogRepository {
  constructor(firestore) {
    this.collection = firestore.collection('proximity_alert_logs');
  }

  async create(record) {
    await this.collection.add(record);
    return record;
  }

  async getLatestByUserAndRestaurant({ userId, restaurantId }) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('restaurantId', '==', restaurantId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (snapshot.empty) {
      return null;
    }
    return alertFromData(snapshot.docs[0].data(), snapshot.docs[0].id);
  }
}
