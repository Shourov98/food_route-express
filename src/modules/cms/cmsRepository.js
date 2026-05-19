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

function fromDoc(doc) {
  if (!doc.exists) {
    return null;
  }
  const data = doc.data();
  return {
    slug: String(data.slug ?? doc.id),
    title: String(data.title ?? ''),
    content: String(data.content ?? ''),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export class FirestoreCmsPageRepository {
  constructor(firestore) {
    this.collection = firestore.collection('cms_pages');
  }

  async upsert(record) {
    await this.collection.doc(record.slug).set({
      slug: record.slug,
      title: record.title,
      content: record.content,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
    return record;
  }

  async create(record) {
    const existing = await this.getBySlug(record.slug);
    if (existing) {
      throw new Error(`CMS page '${record.slug}' already exists.`);
    }
    return this.upsert(record);
  }

  async getBySlug(slug) {
    return fromDoc(await this.collection.doc(slug).get());
  }

  async listAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs
      .map(fromDoc)
      .filter(Boolean)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  async delete(slug) {
    const ref = this.collection.doc(slug);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }
}
