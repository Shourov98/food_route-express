export class FirestoreUserNotificationReadRepository {
  constructor(firestore) {
    this.collection = firestore.collection('user_notification_reads');
  }

  async listReadNotificationIds(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    const notificationIds = new Set();
    for (const doc of snapshot.docs) {
      const notificationId = doc.data().notificationId;
      if (notificationId) {
        notificationIds.add(notificationId);
      }
    }
    return notificationIds;
  }

  async markRead(record) {
    await this.collection.doc(record.id).set({
      id: record.id,
      userId: record.userId,
      notificationId: record.notificationId,
      readAt: record.readAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
    return record;
  }

  async markAllRead(userId, notificationIds) {
    const now = new Date();
    const records = notificationIds.map((notificationId) => ({
      id: `${userId}:${notificationId}`,
      userId,
      notificationId,
      readAt: now,
      createdAt: now,
      updatedAt: now,
    }));
    await Promise.all(records.map((record) => this.markRead(record)));
    return records;
  }
}
