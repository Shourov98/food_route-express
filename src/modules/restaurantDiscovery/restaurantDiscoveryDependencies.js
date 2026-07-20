import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreCheckInRepository } from '../checkins/checkinRepository.js';
import { FirestoreFavoriteRepository } from '../favorites/favoriteRepository.js';
import { FirestoreMenuItemRepository, FirestoreMenuRepository } from '../menus/menuRepository.js';
import { FirestorePlacementRepository } from '../placements/placementRepository.js';
import { FirestoreRestaurantRepository } from '../restaurants/restaurantRepository.js';
import { FirestoreReviewRepository } from '../reviews/reviewRepository.js';
import { loadGeographyConfig } from '../geography/geographyPolicy.js';
import { RestaurantDiscoveryService } from './restaurantDiscoveryService.js';

let cachedServicePromise;

export function getRestaurantDiscoveryService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new RestaurantDiscoveryService({
        restaurantRepository: new FirestoreRestaurantRepository(firestore),
        menuRepository: new FirestoreMenuRepository(firestore),
        menuItemRepository: new FirestoreMenuItemRepository(firestore),
        reviewRepository: new FirestoreReviewRepository(firestore),
        favoriteRepository: new FirestoreFavoriteRepository(firestore),
        // Injected so listItems can carry per-user check-in state
        // (isCheckedIn, cooldownEndsAt, etc.) without an N+1 round-trip.
        checkinRepository: new FirestoreCheckInRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
        geographyConfig: config.geographyConfig ?? loadGeographyConfig({
          ACTIVE_CITIES: process.env.ACTIVE_CITIES,
          DEFAULT_PROXIMITY_RADIUS_KM: process.env.DEFAULT_PROXIMITY_RADIUS_KM,
          SECONDARY_PROXIMITY_RADIUS_KM: process.env.SECONDARY_PROXIMITY_RADIUS_KM,
        }),
        placementRepository: new FirestorePlacementRepository(firestore),
      });
    });
  }

  return cachedServicePromise;
}