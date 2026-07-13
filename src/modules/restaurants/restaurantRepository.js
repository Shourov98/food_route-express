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

function parseEnum(value, allowedValues, fallback = null) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value).toLowerCase();
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function restaurantFromData(data = {}, fallbackId = 'unknown-restaurant') {
  const qrCode = data.qrCode ?? {};
  const location = qrCode.location ?? {};
  const createdAt = toDate(data.createdAt ?? data.updatedAt) ?? new Date();
  const updatedAt = toDate(data.updatedAt ?? data.createdAt) ?? createdAt;

  return {
    id: String(data.id ?? fallbackId),
    name: String(data.name ?? 'Unknown Restaurant'),
    address: String(data.address ?? 'Unknown address'),
    city: data.city ?? null,
    latitude: Number(data.latitude ?? 0),
    longitude: Number(data.longitude ?? 0),
    category: String(data.category ?? 'restaurant'),
    openingTime: data.openingTime ?? null,
    closingTime: data.closingTime ?? null,
    imageUrl: data.imageUrl ?? null,
    qrCode: {
      name: String(qrCode.name ?? data.name ?? 'Unknown Restaurant'),
      location: {
        latitude: Number(location.latitude ?? 0),
        longitude: Number(location.longitude ?? 0),
      },
      token: String(qrCode.token ?? data.id ?? 'unknown-token'),
    },
    pointsPerCheckIn: Number(data.pointsPerCheckIn ?? 0),
    checkinRadiusMeters: Number(data.checkinRadiusMeters ?? data.allowedRadiusMeters ?? 100),
    receiptUploadEnabled: Boolean(data.receiptUploadEnabled),
    pointsPerReceiptUpload: Number(data.pointsPerReceiptUpload ?? 0),
    enabledPackages: Array.isArray(data.enabledPackages)
      ? data.enabledPackages
          .map((item) =>
            parseEnum(item, ['start', 'active', 'pro', 'prime', 'dominio']),
          )
          .filter(Boolean)
      : [],
    status: parseEnum(data.status, ['active', 'inactive'], 'inactive'),
    createdBy: String(data.createdBy ?? 'system'),
    createdAt,
    updatedAt,
    currentPackage: parseEnum(data.currentPackage, ['start', 'active', 'pro', 'prime', 'dominio']),
    billingCycle: parseEnum(data.billingCycle, ['monthly', 'annual']),
    activatedAt: toDate(data.activatedAt),
    expiresAt: toDate(data.expiresAt),
  };
}

export class FirestoreRestaurantRepository {
  constructor(firestore) {
    this.collection = firestore.collection('restaurants');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async update(restaurantId, record) {
    const ref = this.collection.doc(restaurantId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(record);
    return record;
  }

  async getById(restaurantId) {
    const snapshot = await this.collection.doc(restaurantId).get();
    if (!snapshot.exists) {
      return null;
    }
    return restaurantFromData(snapshot.data(), snapshot.id);
  }

  async getByQrToken(qrToken) {
    const snapshot = await this.collection.where('qrCode.token', '==', qrToken).limit(1).get();
    if (snapshot.empty) {
      return null;
    }
    return restaurantFromData(snapshot.docs[0].data(), snapshot.docs[0].id);
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs
      .map((doc) => restaurantFromData(doc.data(), doc.id))
      .sort((left, right) => {
        const timeDiff = right.createdAt.getTime() - left.createdAt.getTime();
        return timeDiff !== 0 ? timeDiff : right.id.localeCompare(left.id);
      });
  }

  async delete(restaurantId) {
    const ref = this.collection.doc(restaurantId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }
}
