import { createAdminRouter } from '../modules/admin/adminRouter.js';
import { createAuthRouter } from '../modules/auth/authRouter.js';
import { createChallengeParticipationRouter } from '../modules/challengeParticipations/challengeParticipationRouter.js';
import { createChallengeRouter } from '../modules/challenges/challengeRouter.js';
import { createAdminCheckInRouter, createCheckInRouter } from '../modules/checkins/checkinRouter.js';
import { createCmsRouter } from '../modules/cms/cmsRouter.js';
import { createDailyRewardRouter } from '../modules/dailyRewards/dailyRewardRouter.js';
import { createFavoriteRouter } from '../modules/favorites/favoriteRouter.js';
import { createNotificationCampaignRouter } from '../modules/notificationCampaigns/notificationCampaignRouter.js';
import { createPackageRouter } from '../modules/packages/packageRouter.js';
import { createPlacementRouter } from '../modules/placements/placementRouter.js';
import { createInternalProximityAlertRouter } from '../modules/proximityAlerts/proximityAlertRouter.js';
import { createQrCodeRouter } from '../modules/qrCodes/qrCodeRouter.js';
import { createReceiptUploadRouter } from '../modules/receiptUploads/receiptUploadRouter.js';
import { createRestaurantDiscoveryRouter } from '../modules/restaurantDiscovery/restaurantDiscoveryRouter.js';
import { createRestaurantRouter } from '../modules/restaurants/restaurantRouter.js';
import {
  createRestaurantDishRouter,
  createRestaurantItemRedemptionRouter,
} from '../modules/restaurantItemRedemptions/restaurantItemRedemptionRouter.js';
import {
  createAdminRewardRedemptionRouter,
  createRewardRedemptionRouter,
  createUserRewardRedemptionRouter,
} from '../modules/rewardRedemptions/rewardRedemptionRouter.js';
import { createRewardRouter, createUserRewardCatalogRouter } from '../modules/rewards/rewardRouter.js';
import { createReviewRouter } from '../modules/reviews/reviewRouter.js';
import { createAdminRouteRouter, createUserRouteRouter } from '../modules/routes/routeRouter.js';
import { createAdminSpinRouter, createUserSpinRouter } from '../modules/spins/spinRouter.js';
import {
  createAdminSupportRequestRouter,
  createSupportRequestRouter,
} from '../modules/supportRequests/supportRequestRouter.js';
import { createUserNotificationRouter } from '../modules/userNotifications/userNotificationRouter.js';
import { createUserRouter } from '../modules/users/userRouter.js';
import { createLevelRouter } from '../modules/levels/levelRouter.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export function registerRoutes(app, config) {
  app.use(`${config.apiV1Prefix}/admin`, createAdminRouter(config));
  app.use(`${config.apiV1Prefix}/admin/challenges`, createChallengeRouter(config));
  app.use(`${config.apiV1Prefix}/admin/check-ins`, createAdminCheckInRouter(config));
  app.use(`${config.apiV1Prefix}/admin/daily-rewards`, createDailyRewardRouter(config));
  app.use(`${config.apiV1Prefix}/admin/levels`, createLevelRouter(config));
  app.use(`${config.apiV1Prefix}/admin/notification-campaigns`, createNotificationCampaignRouter(config));
  app.use(`${config.apiV1Prefix}/admin/packages`, createPackageRouter(config));
  app.use(`${config.apiV1Prefix}/admin/placements`, createPlacementRouter(config));
  app.use(`${config.apiV1Prefix}/admin/qr-codes`, createQrCodeRouter(config));
  app.use(`${config.apiV1Prefix}/admin/restaurants`, createRestaurantRouter(config));
  app.use(`${config.apiV1Prefix}/admin/rewards`, createRewardRouter(config));
  app.use(`${config.apiV1Prefix}/admin/reward-redemptions`, createAdminRewardRedemptionRouter(config));
  app.use(`${config.apiV1Prefix}/admin/routes`, createAdminRouteRouter(config));
  app.use(`${config.apiV1Prefix}/admin/spin-wheel`, createAdminSpinRouter(config));
  app.use(`${config.apiV1Prefix}/admin/support-requests`, createAdminSupportRequestRouter(config));
  app.use(`${config.apiV1Prefix}/auth`, createAuthRouter(config));
  app.use(`${config.apiV1Prefix}/check-ins`, createCheckInRouter(config));
  app.use(`${config.apiV1Prefix}/cms`, createCmsRouter(config));
  app.use(`${config.apiV1Prefix}/internal/proximity-alerts`, createInternalProximityAlertRouter(config));
  app.use(`${config.apiV1Prefix}/restaurants/dishes`, createRestaurantDishRouter(config));
  app.use(`${config.apiV1Prefix}/restaurants`, createRestaurantDiscoveryRouter(config));
  app.use(`${config.apiV1Prefix}/restaurants`, createReceiptUploadRouter(config));
  app.use(`${config.apiV1Prefix}/restaurants`, createReviewRouter(config));
  app.use(`${config.apiV1Prefix}/rewards`, createUserRewardCatalogRouter(config));
  app.use(`${config.apiV1Prefix}/rewards`, createRewardRedemptionRouter(config));
  app.use(`${config.apiV1Prefix}/support-requests`, createSupportRequestRouter(config));
  app.use(`${config.apiV1Prefix}/users/me/challenges`, createChallengeParticipationRouter(config));
  app.use(`${config.apiV1Prefix}/users/me/notifications`, createUserNotificationRouter(config));
  app.use(`${config.apiV1Prefix}/users/me/reward-store`, createRestaurantItemRedemptionRouter(config));
  app.use(`${config.apiV1Prefix}/users/me/rewards`, createUserRewardRedemptionRouter(config));
  app.use(`${config.apiV1Prefix}/users/me/routes`, createUserRouteRouter(config));
  app.use(`${config.apiV1Prefix}/users/me/spins`, createUserSpinRouter(config));
  app.use(`${config.apiV1Prefix}/users/me/favorites`, createFavoriteRouter(config));
  app.use(`${config.apiV1Prefix}/users`, createUserRouter(config));
}
