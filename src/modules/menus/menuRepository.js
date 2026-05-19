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

function menuFromData(data) {
  const createdAt = toDate(data.createdAt ?? data.updatedAt) ?? new Date();
  const updatedAt = toDate(data.updatedAt ?? data.createdAt) ?? createdAt;
  return {
    id: data.id,
    restaurantId: data.restaurantId,
    name: data.name,
    createdBy: data.createdBy,
    createdAt,
    updatedAt,
  };
}

function menuItemFromData(data) {
  const createdAt = toDate(data.createdAt ?? data.updatedAt) ?? new Date();
  const updatedAt = toDate(data.updatedAt ?? data.createdAt) ?? createdAt;
  return {
    id: data.id,
    menuId: data.menuId,
    restaurantId: data.restaurantId,
    name: data.name,
    description: data.description,
    priceInCents: Number(data.priceInCents ?? 0),
    pointsToBuy: Number(data.pointsToBuy ?? data.priceInCents ?? 0),
    imageUrl: data.imageUrl ?? null,
    isAvailable: Boolean(data.isAvailable),
    createdBy: data.createdBy,
    createdAt,
    updatedAt,
  };
}

export class FirestoreMenuRepository {
  constructor(firestore) {
    this.collection = firestore.collection('menus');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async getByRestaurantId(restaurantId) {
    const snapshot = await this.collection.where('restaurantId', '==', restaurantId).limit(1).get();
    if (snapshot.empty) {
      return null;
    }
    return menuFromData(snapshot.docs[0].data());
  }
}

export class FirestoreMenuItemRepository {
  constructor(firestore) {
    this.collection = firestore.collection('menu_items');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async update(itemId, record) {
    const ref = this.collection.doc(itemId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(record);
    return record;
  }

  async getById(itemId) {
    const snapshot = await this.collection.doc(itemId).get();
    if (!snapshot.exists) {
      return null;
    }
    return menuItemFromData(snapshot.data());
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs
      .map((doc) => menuItemFromData(doc.data()))
      .sort((left, right) => {
        const timeDiff = left.createdAt.getTime() - right.createdAt.getTime();
        return timeDiff !== 0 ? timeDiff : left.id.localeCompare(right.id);
      });
  }

  async listByMenuId(menuId) {
    const snapshot = await this.collection.where('menuId', '==', menuId).get();
    return snapshot.docs
      .map((doc) => menuItemFromData(doc.data()))
      .sort((left, right) => {
        const timeDiff = left.createdAt.getTime() - right.createdAt.getTime();
        return timeDiff !== 0 ? timeDiff : left.id.localeCompare(right.id);
      });
  }

  async delete(itemId) {
    const ref = this.collection.doc(itemId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }
}
