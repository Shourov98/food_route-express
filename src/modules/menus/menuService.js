import { randomUUID } from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';

function menuResponse(record) {
  return {
    id: record.id,
    restaurantId: record.restaurantId,
    name: record.name,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function menuItemResponse(record) {
  return {
    id: record.id,
    menuId: record.menuId,
    restaurantId: record.restaurantId,
    name: record.name,
    description: record.description,
    price: roundPrice(record.priceInCents),
    pointsToBuy: record.pointsToBuy,
    imageUrl: record.imageUrl,
    isAvailable: record.isAvailable,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function roundPrice(priceInCents) {
  return Math.round((priceInCents / 100) * 100) / 100;
}

function toCents(price) {
  return Math.round(price * 100);
}

export class MenuService {
  constructor({
    menuRepository,
    menuItemRepository,
    restaurantRepository,
    userRepository,
    identityProvider,
    imageStorage,
  }) {
    this.menuRepository = menuRepository;
    this.menuItemRepository = menuItemRepository;
    this.restaurantRepository = restaurantRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.imageStorage = imageStorage;
  }

  async getMenu({ accessToken, restaurantId }) {
    const account = await this.getCurrentAccount(accessToken);
    const menu = await this.getOrCreateMenuForRestaurant({
      restaurantId,
      createdBy: account.uid,
    });
    return menuResponse(menu);
  }

  async createMenuItem({ accessToken, restaurantId, payload, image }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const menu = await this.getOrCreateMenuForRestaurant({
      restaurantId,
      createdBy: admin.uid,
    });
    const now = new Date();
    const itemId = randomUUID();
    const imageUrl = image
      ? (await this.imageStorage.uploadImage({ folder: `menu_items/${itemId}`, file: image })).publicUrl
      : null;

    return menuItemResponse(
      await this.menuItemRepository.create({
        id: itemId,
        menuId: menu.id,
        restaurantId,
        name: payload.name,
        description: payload.description,
        priceInCents: toCents(payload.price),
        pointsToBuy: payload.pointsToBuy,
        imageUrl,
        isAvailable: payload.isAvailable,
        createdBy: admin.uid,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  async updateMenuItem({ accessToken, restaurantId, itemId, payload, image }) {
    await this.getCurrentAdmin(accessToken);
    await this.ensureRestaurantExists(restaurantId);
    const existing = await this.getMenuItemRecord({ restaurantId, itemId });

    let imageUrl = existing.imageUrl;
    if (image) {
      imageUrl = (await this.imageStorage.uploadImage({ folder: `menu_items/${itemId}`, file: image })).publicUrl;
    } else if (payload.hasImageUrlField) {
      imageUrl = payload.imageUrl;
    }

    const updated = {
      ...existing,
      name: payload.name ?? existing.name,
      description: payload.description ?? existing.description,
      priceInCents: payload.price !== undefined ? toCents(payload.price) : existing.priceInCents,
      pointsToBuy: payload.pointsToBuy ?? existing.pointsToBuy,
      imageUrl,
      isAvailable: payload.isAvailable ?? existing.isAvailable,
      updatedAt: new Date(),
    };
    await this.menuItemRepository.update(itemId, updated);
    return menuItemResponse(updated);
  }

  async listMenuItems({ accessToken, restaurantId }) {
    const account = await this.getCurrentAccount(accessToken);
    const menu = await this.getOrCreateMenuForRestaurant({
      restaurantId,
      createdBy: account.uid,
    });
    return (await this.menuItemRepository.listByMenuId(menu.id)).map(menuItemResponse);
  }

  async getMenuItem({ accessToken, restaurantId, itemId }) {
    await this.getCurrentAccount(accessToken);
    await this.ensureRestaurantExists(restaurantId);
    return menuItemResponse(await this.getMenuItemRecord({ restaurantId, itemId }));
  }

  async deleteMenuItem({ accessToken, restaurantId, itemId }) {
    await this.getCurrentAdmin(accessToken);
    await this.ensureRestaurantExists(restaurantId);
    await this.getMenuItemRecord({ restaurantId, itemId });
    const deleted = await this.menuItemRepository.delete(itemId);
    if (!deleted) {
      throw new ApplicationError({
        code: 'menu_item_not_found',
        message: 'No menu item found for the provided identifier.',
        statusCode: 404,
      });
    }
  }

  async ensureDefaultMenu({ restaurantId, restaurantName, createdBy }) {
    const existing = await this.menuRepository.getByRestaurantId(restaurantId);
    if (existing) {
      return existing;
    }
    const now = new Date();
    return this.menuRepository.create({
      id: randomUUID(),
      restaurantId,
      name: `${restaurantName} Menu`,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
  }

  async getOrCreateMenuForRestaurant({ restaurantId, createdBy }) {
    const restaurant = await this.ensureRestaurantExists(restaurantId);
    return this.ensureDefaultMenu({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      createdBy,
    });
  }

  async ensureRestaurantExists(restaurantId) {
    const restaurant = await this.restaurantRepository.getById(restaurantId);
    if (!restaurant) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
    return restaurant;
  }

  async getMenuItemRecord({ restaurantId, itemId }) {
    const item = await this.menuItemRepository.getById(itemId);
    if (!item || item.restaurantId !== restaurantId) {
      throw new ApplicationError({
        code: 'menu_item_not_found',
        message: 'No menu item found for the provided identifier.',
        statusCode: 404,
      });
    }
    return item;
  }

  async getCurrentAdmin(accessToken) {
    const record = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'admin_not_found',
      notFoundMessage: 'No admin account found for the provided credentials.',
      notFoundStatusCode: 403,
    });

    return requireActiveRoles({
      record,
      allowedRoles: new Set(['admin', 'super_admin']),
      roleErrorCode: 'admin_not_found',
      roleErrorMessage: 'No admin account found for the provided credentials.',
      blockedErrorCode: 'admin_blocked',
      blockedErrorMessage: 'The admin account is blocked.',
    });
  }

  async getCurrentAccount(accessToken) {
    const record = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
    });

    return requireActiveRoles({
      record,
      allowedRoles: new Set(['user', 'admin', 'super_admin']),
      roleErrorCode: 'account_not_found',
      roleErrorMessage: 'No account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'account_blocked',
      blockedErrorMessage: 'The account is blocked.',
    });
  }
}
