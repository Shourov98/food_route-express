import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreDailyRewardRepository } from '../dailyRewards/dailyRewardRepository.js';
import { FirestoreSpinRepository, FirestoreSpinWheelSettingsRepository } from './spinRepository.js';
import { SpinService } from './spinService.js';
import { FirestorePointsLedgerRepository, FirestoreXpLedgerRepository } from '../xp/xpRepository.js';
import { XpService } from '../xp/xpService.js';

let cachedServicePromise;

export function getSpinService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new SpinService({
        dailyRewardRepository: new FirestoreDailyRewardRepository(firestore),
        spinRepository: new FirestoreSpinRepository(firestore),
        spinSettingsRepository: new FirestoreSpinWheelSettingsRepository(firestore),
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
