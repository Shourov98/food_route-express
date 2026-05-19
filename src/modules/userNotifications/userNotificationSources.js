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

export class FirestoreRewardRedemptionRepository {
  constructor(firestore) {
    this.collection = firestore.collection('reward_redemptions');
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id ?? doc.id,
        rewardId: data.rewardId,
        userId: data.userId,
        rewardTitle: data.rewardTitle,
        rewardDescription: data.rewardDescription,
        pointsRequired: Number(data.pointsRequired ?? 0),
        redeemedAt: toDate(data.redeemedAt ?? data.updatedAt ?? data.createdAt) ?? new Date(),
      };
    });
  }
}

export class FirestoreChallengeParticipationRepository {
  constructor(firestore) {
    this.collection = firestore.collection('challenge_participations');
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: data.id ?? doc.id,
          challengeId: data.challengeId,
          challengeTitle: data.challengeTitle ?? '',
          rewardPoints: Number(data.rewardPoints ?? 0),
          status: String(data.status ?? 'in_progress').toLowerCase(),
          startedAt: toDate(data.startedAt ?? data.updatedAt) ?? new Date(),
          completedAt: toDate(data.completedAt),
        };
      })
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
  }
}

export class FirestoreProximityAlertRepository {
  constructor(firestore) {
    this.collection = firestore.collection('user_proximity_alerts');
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: data.id ?? doc.id,
          userId: data.userId,
          restaurantId: data.restaurantId,
          restaurantName: data.restaurantName ?? 'Restaurant',
          distanceKm: Number(data.distanceKm ?? 0),
          mapsUrl: String(data.mapsUrl ?? ''),
          createdAt: toDate(data.createdAt ?? data.updatedAt) ?? new Date(),
        };
      })
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
}
