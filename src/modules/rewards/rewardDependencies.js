import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirebaseImageStorage } from '../../shared/services/imageStorage.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestorePointsLedgerRepository, FirestoreXpLedgerRepository } from '../xp/xpRepository.js';
import { XpService } from '../xp/xpService.js';
import { FirestoreRewardRepository } from './rewardRepository.js';
import { RewardService } from './rewardService.js';

let cachedServicePromise;

export function getRewardService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(async ({ app, auth, firestore }) => {
      const { getStorage } = await import('firebase-admin/storage');
      const xpRepository = new FirestoreXpLedgerRepository(firestore);
      const pointsRepository = new FirestorePointsLedgerRepository(firestore);
      return new RewardService({
        rewardRepository: new FirestoreRewardRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
        xpService: new XpService({ xpRepository, pointsRepository }),
        imageStorage: new FirebaseImageStorage({
          storage: getStorage(app),
          config,
        }),
      });
    });
  }
  return cachedServicePromise;
}
