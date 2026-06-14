import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { buildPushNotificationService } from '../../infra/pushNotificationServiceFactory.js';
import { FirebaseImageStorage } from '../../shared/services/imageStorage.js';
import { FirestoreLoginEventRepository, FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreCheckInRepository } from '../checkins/checkinRepository.js';
import { LeaderboardService } from '../leaderboard/leaderboardService.js';
import { FirestoreRewardRedemptionRepository } from '../rewardRedemptions/rewardRedemptionRepository.js';
import { FirestoreRestaurantRepository } from '../restaurants/restaurantRepository.js';
import {
  FirestoreProximityAlertLogRepository,
  FirestoreProximityAlertRepository,
} from '../proximityAlerts/proximityAlertRepository.js';
import { FirestoreLevelRepository } from '../levels/levelRepository.js';
import { FirestorePointsLedgerRepository, FirestoreXpLedgerRepository } from '../xp/xpRepository.js';
import { XpService } from '../xp/xpService.js';
import { UserService } from './userService.js';

let cachedServicePromise;

export function getUserService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(async ({ app, auth, firestore }) => {
      const { getStorage } = await import('firebase-admin/storage');
      const userRepository = new FirestoreUserRepository(firestore);
      const xpRepository = new FirestoreXpLedgerRepository(firestore);
      const pointsRepository = new FirestorePointsLedgerRepository(firestore);
      const identityProvider = new FirebaseIdentityProvider({ auth, config });
      const xpService = new XpService({
        xpRepository,
        pointsRepository,
        levelRepository: new FirestoreLevelRepository(firestore),
      });

      const pushNotificationService = await buildPushNotificationService({ config, app });

      return new UserService({
        userRepository,
        loginEventRepository: new FirestoreLoginEventRepository(firestore),
        identityProvider,
        xpService,
        checkinRepository: new FirestoreCheckInRepository(firestore),
        rewardRedemptionRepository: new FirestoreRewardRedemptionRepository(firestore),
        restaurantRepository: new FirestoreRestaurantRepository(firestore),
        proximityAlertRepository: new FirestoreProximityAlertRepository(firestore),
        proximityAlertLogRepository: new FirestoreProximityAlertLogRepository(firestore),
        pushNotificationService,
        proximityAlertCooldownMinutes: config.proximityAlertCooldownMinutes,
        imageStorage: new FirebaseImageStorage({
          storage: getStorage(app),
          config,
        }),
        leaderboardService: new LeaderboardService({
          userRepository,
          identityProvider,
          xpRepository,
          pointsRepository,
        }),
      });
    });
  }

  return cachedServicePromise;
}
