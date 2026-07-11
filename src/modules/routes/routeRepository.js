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

function routeFromData(data) {
  return {
    id: data.id,
    routeName: data.routeName,
    description: data.description,
    city: data.city,
    zone: data.zone ?? null,
    neighborhood: data.neighborhood ?? null,
    restaurantIds: Array.isArray(data.restaurantIds) ? [...data.restaurantIds] : [],
    status: data.status ?? 'draft',
    startDate: toDate(data.startDate) ?? null,
    endDate: toDate(data.endDate) ?? null,
    requiredVisits: Number(data.requiredVisits ?? 0),
    mandatoryOrder: Boolean(data.mandatoryOrder),
    pointsPerReceiptUpload: Number(data.pointsPerReceiptUpload ?? 0),
    completionBonus: Number(data.completionBonus ?? 0),
    limitPerUser: Number(data.limitPerUser ?? 1),
    repeatable: Boolean(data.repeatable),
    cooldownMinutes: Number(data.cooldownMinutes ?? 60),
    createdBy: data.createdBy,
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? toDate(data.createdAt) ?? new Date(),
  };
}

export class FirestoreRouteRepository {
  constructor(firestore) {
    this.collection = firestore.collection('routes');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async update(routeId, record) {
    const ref = this.collection.doc(routeId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(record);
    return record;
  }

  async getById(routeId) {
    const snapshot = await this.collection.doc(routeId).get();
    if (!snapshot.exists) {
      return null;
    }
    return routeFromData(snapshot.data());
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map((doc) => routeFromData(doc.data()));
  }

  async delete(routeId) {
    const ref = this.collection.doc(routeId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }
}
