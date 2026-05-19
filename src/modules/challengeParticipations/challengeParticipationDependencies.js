import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreCheckInRepository } from '../checkins/checkinRepository.js';
import { FirestoreChallengeRepository } from '../challenges/challengeRepository.js';
import { FirestoreRewardRepository } from '../rewards/rewardRepository.js';
import { FirestorePointsLedgerRepository, FirestoreXpLedgerRepository } from '../xp/xpRepository.js';
import { XpService } from '../xp/xpService.js';
import { FirestoreChallengeParticipationRepository } from './challengeParticipationRepository.js';

class FirestoreChallengeRewardRedemptionRepository {
  constructor(firestore) {
    this.collection = firestore.collection('reward_redemptions');
  }

  async create(record) {
    await this.collection.doc(record.id).set(record);
    return record;
  }

  async getByUserAndSource({ userId, sourceType, sourceId }) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('sourceType', '==', sourceType)
      .where('sourceId', '==', sourceId)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return null;
    }
    return snapshot.docs[0].data();
  }

  async delete(redemptionId) {
    const ref = this.collection.doc(redemptionId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return false;
    }
    await ref.delete();
    return true;
  }
}

import { ChallengeParticipationService } from './challengeParticipationService.js';

let cachedServicePromise;

export function getChallengeParticipationService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new ChallengeParticipationService({
        challengeRepository: new FirestoreChallengeRepository(firestore),
        participationRepository: new FirestoreChallengeParticipationRepository(firestore),
        checkinRepository: new FirestoreCheckInRepository(firestore),
        rewardRepository: new FirestoreRewardRepository(firestore),
        rewardRedemptionRepository: new FirestoreChallengeRewardRedemptionRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
        xpService: new XpService({
          xpRepository: new FirestoreXpLedgerRepository(firestore),
          pointsRepository: new FirestorePointsLedgerRepository(firestore),
        }),
      });
    });
  }
  return cachedServicePromise;
}
