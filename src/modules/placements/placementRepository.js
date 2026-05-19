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

function placementFromData(data) {
  return {
    id: data.id,
    feature: data.feature,
    restaurantId: data.restaurantId,
    active: Boolean(data.active ?? true),
    sortOrder: Number(data.sortOrder ?? 0),
    createdBy: data.createdBy,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export class FirestorePlacementRepository {
  constructor(firestore) {
    this.collection = firestore.collection('placements');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async update(placementId, record) {
    const ref = this.collection.doc(placementId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(record);
    return record;
  }

  async delete(placementId) {
    const ref = this.collection.doc(placementId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }

  async getById(placementId) {
    const snapshot = await this.collection.doc(placementId).get();
    if (!snapshot.exists) {
      return null;
    }
    return placementFromData(snapshot.data());
  }

  async listByFeature(feature) {
    const snapshot = await this.collection.where('feature', '==', feature).get();
    return snapshot.docs
      .map((doc) => placementFromData(doc.data()))
      .sort(
        (left, right) =>
          Number(right.active) - Number(left.active) ||
          left.sortOrder - right.sortOrder ||
          left.createdAt.getTime() - right.createdAt.getTime(),
      );
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map((doc) => placementFromData(doc.data()));
  }

  async getByFeatureAndRestaurant({ feature, restaurantId }) {
    const list = await this.listByFeature(feature);
    return list.find((item) => item.restaurantId === restaurantId) ?? null;
  }
}
