import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { buildRestaurantItemRedemptionRecordId } from './restaurantItemRedemptionRepository.js';

function catalogItem(record, restaurant) {
  return {
    type: 'restaurant_item',
    itemId: record.id,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address,
    name: record.name,
    description: record.description,
    price: Math.round((record.priceInCents / 100) * 100) / 100,
    pointsToBuy: record.pointsToBuy,
    imageUrl: record.imageUrl,
    isAvailable: record.isAvailable,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function rewardStatus(record, now) {
  if (record.hasExpiry && record.expiresAt && record.expiresAt <= now) {
    return 'expired';
  }
  if (record.isActive) {
    return 'active';
  }
  return 'inactive';
}

function rewardCatalogItem(record, now, currentPoints) {
  return {
    type: 'reward',
    id: record.id,
    title: record.title,
    name: record.title,
    description: record.description,
    pointsRequired: record.pointsRequired,
    quantityAvailable: record.quantityAvailable,
    rewardCategory: record.rewardCategory,
    xpPoints: record.xpPoints,
    foodItemName: record.foodItemName,
    discountPercentage: record.discountPercentage,
    giftCardCode: record.giftCardCode,
    termsAndConditions: record.termsAndConditions,
    imageUrl: record.imageUrl,
    isActive: record.isActive,
    hasExpiry: record.hasExpiry,
    expiresAt: record.expiresAt,
    status: rewardStatus(record, now),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    canRedeem: currentPoints >= record.pointsRequired,
  };
}

function redemptionData(record) {
  return {
    id: record.id,
    userId: record.userId,
    itemId: record.itemId,
    restaurantId: record.restaurantId,
    restaurantName: record.restaurantName,
    restaurantAddress: record.restaurantAddress,
    itemName: record.itemName,
    itemDescription: record.itemDescription,
    itemImageUrl: record.itemImageUrl,
    pointsSpent: record.pointsSpent,
    redeemedAt: record.redeemedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class RestaurantItemRedemptionService {
  constructor({
    restaurantRepository,
    rewardRepository,
    menuItemRepository,
    redemptionRepository,
    userRepository,
    identityProvider,
    xpService,
    pushNotificationService = null,
  }) {
    this.restaurantRepository = restaurantRepository;
    this.rewardRepository = rewardRepository;
    this.menuItemRepository = menuItemRepository;
    this.redemptionRepository = redemptionRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.xpService = xpService;
    this.pushNotificationService = pushNotificationService;
  }

  async listRewardStore({ accessToken, page, pageSize, search }) {
    const user = await this.getCurrentUser(accessToken);
    const now = new Date();
    const currentPoints = await this.xpService.getTotalPoints(user.uid);
    const { restaurants, records: dishRecords } = await this.getRedeemableRecords({ search });
    let rewardRecords = await this.rewardRepository.listAll();

    rewardRecords = rewardRecords.filter(
      (record) =>
        record.isActive &&
        (!record.hasExpiry || !record.expiresAt || record.expiresAt > now) &&
        record.quantityAvailable > 0,
    );

    if (search) {
      const needle = search.trim().toLowerCase();
      rewardRecords = rewardRecords.filter(
        (record) =>
          record.title.toLowerCase().includes(needle) ||
          record.description.toLowerCase().includes(needle),
      );
    }

    const combined = [
      ...rewardRecords.map((record) => rewardCatalogItem(record, now, currentPoints)),
      ...dishRecords.map((record) => catalogItem(record, restaurants.get(record.restaurantId))),
    ].sort((left, right) => {
      const leftName = String(left.name ?? left.title ?? '').toLowerCase();
      const rightName = String(right.name ?? right.title ?? '').toLowerCase();
      if (leftName !== rightName) {
        return leftName.localeCompare(rightName);
      }
      const leftRestaurant = String(left.restaurantName ?? '').toLowerCase();
      const rightRestaurant = String(right.restaurantName ?? '').toLowerCase();
      return leftRestaurant.localeCompare(rightRestaurant);
    });

    const totalItems = combined.length;
    const start = (page - 1) * pageSize;

    return {
      items: combined.slice(start, start + pageSize),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async listRedeemableItems({ accessToken, page, pageSize, search }) {
    await this.getCurrentUser(accessToken);
    const { restaurants, records } = await this.getRedeemableRecords({ search });
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map((record) => catalogItem(record, restaurants.get(record.restaurantId))),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async listAllRedeemableItems({ accessToken, search }) {
    await this.getCurrentUser(accessToken);
    const { restaurants, records } = await this.getRedeemableRecords({ search });
    return records.map((record) => catalogItem(record, restaurants.get(record.restaurantId)));
  }

  async redeemItem({ accessToken, itemId }) {
    const user = await this.getCurrentUser(accessToken);
    const item = await this.menuItemRepository.getById(itemId);
    if (!item) {
      throw new ApplicationError({
        code: 'menu_item_not_found',
        message: 'No menu item found for the provided identifier.',
        statusCode: 404,
      });
    }
    const restaurant = await this.restaurantRepository.getById(item.restaurantId);
    if (!restaurant || restaurant.status !== 'active') {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
    if (!item.isAvailable) {
      throw new ApplicationError({
        code: 'menu_item_unavailable',
        message: 'This restaurant item is currently unavailable.',
        statusCode: 400,
      });
    }
    const currentPoints = await this.xpService.getTotalPoints(user.uid);
    if (currentPoints < item.pointsToBuy) {
      throw new ApplicationError({
        code: 'insufficient_item_points',
        message: 'You do not have enough points to redeem this restaurant item.',
        statusCode: 400,
      });
    }

    const now = new Date();
    const redemption = await this.redemptionRepository.create({
      id: buildRestaurantItemRedemptionRecordId(),
      userId: user.uid,
      itemId: item.id,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantAddress: restaurant.address,
      itemName: item.name,
      itemDescription: item.description,
      itemImageUrl: item.imageUrl,
      pointsSpent: item.pointsToBuy,
      redeemedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const ledger = await this.xpService.adjustPoints({
      userId: user.uid,
      delta: -item.pointsToBuy,
      sourceId: redemption.id,
      city: user.city ?? '',
      country: user.country ?? '',
    });
    if (!ledger && item.pointsToBuy > 0) {
      await this.redemptionRepository.delete(redemption.id);
      throw new ApplicationError({
        code: 'item_redemption_failed',
        message: 'The restaurant item could not be redeemed right now.',
        statusCode: 500,
      });
    }

    await this.sendItemRedemptionPush({ user, item, restaurant, redemption });

    return {
      redemption: redemptionData(redemption),
      userXpAfter: await this.xpService.getTotalXp(user.uid),
      userPointsAfter: await this.xpService.getTotalPoints(user.uid),
    };
  }

  async listMyRedemptions({ accessToken, page, pageSize }) {
    const user = await this.getCurrentUser(accessToken);
    const records = await this.redemptionRepository.listByUser(user.uid);
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(redemptionData),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getCurrentUser(accessToken) {
    const user = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'user_not_found',
      notFoundMessage: 'No end-user account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    return requireActiveRoles({
      record: user,
      allowedRoles: new Set(['user']),
      roleErrorCode: 'user_not_found',
      roleErrorMessage: 'No end-user account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'user_blocked',
      blockedErrorMessage: 'The user account is blocked.',
    });
  }

  async getRedeemableRecords({ search }) {
    const restaurants = new Map(
      (await this.restaurantRepository.listAll())
        .filter((record) => record.status === 'active')
        .map((record) => [record.id, record]),
    );

    let records = (await this.menuItemRepository.listAll()).filter(
      (record) => record.isAvailable && restaurants.has(record.restaurantId),
    );
    if (search) {
      const needle = search.trim().toLowerCase();
      records = records.filter((record) => {
        const restaurant = restaurants.get(record.restaurantId);
        return record.name.toLowerCase().includes(needle) ||
          record.description.toLowerCase().includes(needle) ||
          restaurant.name.toLowerCase().includes(needle) ||
          restaurant.address.toLowerCase().includes(needle);
      });
    }
    return { restaurants, records };
  }

  async sendItemRedemptionPush({ user, item, restaurant, redemption }) {
    if (!this.pushNotificationService) {
      return;
    }
    if (
      this.pushNotificationService.targetingMode !== 'external_id' &&
      !user.pushNotificationToken
    ) {
      return;
    }

    try {
      await this.pushNotificationService.send({
        recipientId: user.uid,
        token: user.pushNotificationToken,
        title: 'Reward redeemed',
        body: `You redeemed ${item.name} from ${restaurant.name} with points.`,
        data: {
          type: 'restaurant_item_redeemed',
          itemId: item.id,
          restaurantId: restaurant.id,
          redemptionId: redemption.id,
        },
      });
    } catch {
      // Item redemption should succeed even if push delivery fails.
    }
  }
}
