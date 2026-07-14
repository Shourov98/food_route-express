import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { buildPushNotificationService } from '../../infra/pushNotificationServiceFactory.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreRewardRepository } from '../rewards/rewardRepository.js';
import { FirestorePointsLedgerRepository, FirestoreXpLedgerRepository } from '../xp/xpRepository.js';
import { XpService } from '../xp/xpService.js';
import { FirestoreRewardRedemptionRepository } from './rewardRedemptionRepository.js';
import { RewardRedemptionService } from './rewardRedemptionService.js';

let cachedServicePromise;

export function getRewardRedemptionService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(async ({ app, auth, firestore }) => {
      const pointsRepository = new FirestorePointsLedgerRepository(firestore);
      return new RewardRedemptionService({
        rewardRepository: new FirestoreRewardRepository(firestore),
        rewardRedemptionRepository: new FirestoreRewardRedemptionRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
        xpService: new XpService({
          xpRepository: new FirestoreXpLedgerRepository(firestore),
          pointsRepository,
        }),
        // BR-006 hardening: pass the points ledger repo so the redemption
        // transaction can write a `reward_redemption` row directly inside
        // the same txn as the stock decrement and redemption insert.
        pointsRepository,
        pushNotificationService: await buildPushNotificationService({ config, app }),
      });
    });
  }

  return cachedServicePromise;
}
