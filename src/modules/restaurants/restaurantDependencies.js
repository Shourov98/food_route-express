import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirebaseImageStorage } from '../../shared/services/imageStorage.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreMenuItemRepository, FirestoreMenuRepository } from '../menus/menuRepository.js';
import { MenuService } from '../menus/menuService.js';
import { FirestoreRestaurantRepository } from './restaurantRepository.js';
import { RestaurantService } from './restaurantService.js';

let cachedServicesPromise;

export function getRestaurantServices(config) {
  if (!cachedServicesPromise) {
    cachedServicesPromise = getFirebaseClients(config).then(async ({ app, auth, firestore }) => {
      const { getStorage } = await import('firebase-admin/storage');
      const userRepository = new FirestoreUserRepository(firestore);
      const identityProvider = new FirebaseIdentityProvider({ auth, config });
      const imageStorage = new FirebaseImageStorage({
        storage: getStorage(app),
        config,
      });
      const restaurantRepository = new FirestoreRestaurantRepository(firestore);
      const menuRepository = new FirestoreMenuRepository(firestore);
      const menuItemRepository = new FirestoreMenuItemRepository(firestore);
      const menuService = new MenuService({
        menuRepository,
        menuItemRepository,
        restaurantRepository,
        userRepository,
        identityProvider,
        imageStorage,
      });

      return {
        restaurantService: new RestaurantService({
          restaurantRepository,
          menuService,
          userRepository,
          identityProvider,
          imageStorage,
        }),
        menuService,
      };
    });
  }

  return cachedServicesPromise;
}
