import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreCheckInRepository } from '../checkins/checkinRepository.js';
import { FirestoreNotificationCampaignRepository } from '../notificationCampaigns/notificationCampaignRepository.js';
import { FirestoreSpinRepository } from '../spins/spinRepository.js';
import { FirestoreUserNotificationReadRepository } from './userNotificationReadRepository.js';
import {
  FirestoreChallengeParticipationRepository,
  FirestoreProximityAlertRepository,
  FirestoreRewardRedemptionRepository,
} from './userNotificationSources.js';
import { UserNotificationService } from './userNotificationService.js';

let cachedServicePromise;

export function getUserNotificationService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new UserNotificationService({
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
        checkinRepository: new FirestoreCheckInRepository(firestore),
        spinRepository: new FirestoreSpinRepository(firestore),
        rewardRedemptionRepository: new FirestoreRewardRedemptionRepository(firestore),
        challengeParticipationRepository: new FirestoreChallengeParticipationRepository(firestore),
        notificationCampaignRepository: new FirestoreNotificationCampaignRepository(firestore),
        readRepository: new FirestoreUserNotificationReadRepository(firestore),
        proximityAlertRepository: new FirestoreProximityAlertRepository(firestore),
      });
    });
  }
  return cachedServicePromise;
}
