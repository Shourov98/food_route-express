import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreCheckInRepository } from '../checkins/checkinRepository.js';
import { FirestoreRestaurantRepository } from '../restaurants/restaurantRepository.js';
import { FirestoreRouteProgressRepository, FirestoreRouteRepository } from './routeRepository.js';
import { RouteService } from './routeService.js';

let cachedServicePromise;

export function getRouteService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new RouteService({
        routeRepository: new FirestoreRouteRepository(firestore),
        routeProgressRepository: new FirestoreRouteProgressRepository(firestore),
        checkinRepository: new FirestoreCheckInRepository(firestore),
        restaurantRepository: new FirestoreRestaurantRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
      });
    });
  }
  return cachedServicePromise;
}
