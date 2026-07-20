// Reusable OpenAPI component schemas for the Food Route API.
//
// Every object that flows through a controller should have a schema entry
// here. `endpointCatalog.js` references these via `$ref` strings, then
// `openapi.js` injects them into `components.schemas`.

const id = { type: 'string', description: 'Unique document identifier (Firestore UID).' };
const dateTime = { type: 'string', format: 'date-time', description: 'ISO-8601 timestamp.' };

const errorResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { description: 'Optional structured details (string, object, or array).' },
        field: { type: 'string' },
        requestId: { type: 'string' },
      },
    },
  },
};

const successEnvelope = (dataSchema, description) => ({
  type: 'object',
  description,
  additionalProperties: false,
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: dataSchema,
    message: { type: 'string' },
  },
});

const messageResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'message'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    message: { type: 'string' },
  },
};

const pagination = {
  type: 'object',
  additionalProperties: false,
  required: ['page', 'pageSize', 'totalItems', 'totalPages'],
  properties: {
    page: { type: 'integer' },
    pageSize: { type: 'integer' },
    totalItems: { type: 'integer' },
    totalPages: { type: 'integer' },
  },
};

const paginatedEnvelope = (itemSchema, description) => ({
  type: 'object',
  description,
  additionalProperties: false,
  required: ['items', 'pagination'],
  properties: {
    items: { type: 'array', items: itemSchema },
    pagination,
  },
});

const restaurant = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    name: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    country: { type: 'string' },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    category: { type: 'string' },
    imageUrl: { type: 'string', format: 'uri', nullable: true },
    openingTime: { type: 'string', nullable: true },
    closingTime: { type: 'string', nullable: true },
    pointsPerCheckIn: { type: 'integer' },
    pointsPerReceiptUpload: { type: 'integer' },
    receiptUploadEnabled: { type: 'boolean' },
    pointsPerSocialShare: { type: 'integer' },
    checkinRadiusMeters: { type: 'integer' },
    qrRequired: { type: 'boolean' },
    status: { type: 'string', enum: ['active', 'inactive', 'pending_review'] },
    qrCode: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        token: { type: 'string' },
        location: {
          type: 'object',
          properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
        },
      },
    },
    enabledPackages: { type: 'array', items: { type: 'string' } },
    enabledFeatures: {
      type: 'array',
      items: {
        type: 'object',
        properties: { key: { type: 'string' }, name: { type: 'string' }, enabled: { type: 'boolean' } },
      },
    },
    packageState: {
      nullable: true,
      type: 'object',
      properties: {
        currentPackage: { type: 'string' },
        billingCycle: { type: 'string', enum: ['monthly', 'annual'] },
        activatedAt: dateTime,
        expiresAt: dateTime,
      },
    },
    createdBy: { type: 'string' },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const restaurantListItem = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    name: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    category: { type: 'string' },
    imageUrl: { type: 'string', format: 'uri', nullable: true },
    pointsPerCheckIn: { type: 'integer' },
    distanceKm: { type: 'number', nullable: true },
    ratingSummary: {
      type: 'object',
      properties: { averageRating: { type: 'number' }, totalReviews: { type: 'integer' } },
    },
    isFavorite: { type: 'boolean' },
    isCheckedIn: { type: 'boolean', description: 'True when the requesting user has checked in here within the last 24 hours.' },
    lastCheckedInAt: { ...dateTime, nullable: true },
    cooldownEndsAt: { ...dateTime, nullable: true },
    userCheckinCount: { type: 'integer', description: 'Total lifetime check-ins the user has at this restaurant.' },
    todayCheckinCount: { type: 'integer' },
  },
};

const menuItem = {
  type: 'object',
  additionalProperties: false,
  properties: {
    itemId: id,
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    price: { type: 'number', description: 'Price in major currency units (e.g. MXN).' },
    pointsToBuy: { type: 'integer', description: 'Wallet points required to redeem this item.' },
    imageUrl: { type: 'string', format: 'uri', nullable: true },
    isAvailable: { type: 'boolean' },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const review = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    restaurantId: id,
    userId: id,
    userFullname: { type: 'string' },
    userEmail: { type: 'string', format: 'email' },
    rating: { type: 'integer', minimum: 1, maximum: 5 },
    comment: { type: 'string' },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const directions = {
  type: 'object',
  additionalProperties: false,
  properties: {
    restaurantId: id,
    restaurantName: { type: 'string' },
    address: { type: 'string' },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    userLatitude: { type: 'number', nullable: true },
    userLongitude: { type: 'number', nullable: true },
    distanceKm: { type: 'number', nullable: true },
    platform: { type: 'string', enum: ['ios', 'android', 'web'] },
    mapsUrl: { type: 'string', format: 'uri', description: 'Web fallback for the requested platform.' },
    providers: {
      type: 'object',
      description: 'Platform-specific deep-link URLs and fallback metadata. BR-012.',
      additionalProperties: false,
      properties: {
        ios: {
          type: 'object',
          properties: {
            appleMaps: { type: 'string' },
            googleMaps: { type: 'string' },
            waze: { type: 'string' },
          },
        },
        android: {
          type: 'object',
          properties: {
            googleMaps: { type: 'string' },
            waze: { type: 'string' },
          },
        },
      },
    },
  },
};

const serviceArea = {
  type: 'object',
  additionalProperties: false,
  properties: {
    activeCities: { type: 'array', items: { type: 'string' } },
    radiusKm: { type: 'number', nullable: true },
    outOfServiceArea: { type: 'boolean' },
    message: { type: 'string' },
  },
};

const restaurantListEnvelope = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'pagination', 'serviceArea'],
  properties: {
    items: { type: 'array', items: restaurantListItem },
    pagination,
    serviceArea,
  },
};

const restaurantDetail = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ...restaurant.properties,
    distanceKm: { type: 'number', nullable: true },
    ratingSummary: {
      type: 'object',
      properties: { averageRating: { type: 'number' }, totalReviews: { type: 'integer' } },
    },
    menuItems: { type: 'array', items: menuItem },
    reviews: { type: 'array', items: review },
    isFavorite: { type: 'boolean' },
    isCheckedIn: { type: 'boolean' },
    lastCheckedInAt: { ...dateTime, nullable: true },
    cooldownEndsAt: { ...dateTime, nullable: true },
    userCheckinCount: { type: 'integer' },
    todayCheckinCount: { type: 'integer' },
  },
};

const restaurantMenu = {
  type: 'object',
  additionalProperties: false,
  properties: {
    restaurantId: id,
    restaurantName: { type: 'string' },
    restaurantAddress: { type: 'string' },
    city: { type: 'string' },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    category: { type: 'string' },
    imageUrl: { type: 'string', format: 'uri', nullable: true },
    pointsPerCheckIn: { type: 'integer' },
    distanceKm: { type: 'number', nullable: true },
    ratingSummary: {
      type: 'object',
      properties: { averageRating: { type: 'number' }, totalReviews: { type: 'integer' } },
    },
    menuId: id,
    menuName: { type: 'string' },
    menuItems: { type: 'array', items: menuItem },
    isFavorite: { type: 'boolean' },
  },
};

const user = {
  type: 'object',
  additionalProperties: false,
  properties: {
    uid: id,
    fullname: { type: 'string' },
    email: { type: 'string', format: 'email' },
    gender: { type: 'string', nullable: true },
    age: { type: 'integer', nullable: true },
    dateOfBirth: { type: 'string', nullable: true, description: 'YYYY-MM-DD.' },
    city: { type: 'string' },
    country: { type: 'string' },
    profileImageUrl: { type: 'string', format: 'uri', nullable: true },
    referralCode: { type: 'string' },
    referredByUid: { type: 'string', nullable: true },
    role: { type: 'string', enum: ['user', 'admin', 'super_admin'] },
    isVerified: { type: 'boolean' },
    isBlocked: { type: 'boolean' },
    createdAt: dateTime,
  },
};

const authSession = {
  type: 'object',
  additionalProperties: false,
  required: ['uid', 'email', 'role', 'is_verified', 'access_token', 'refresh_token', 'expires_in'],
  properties: {
    uid: id,
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['user', 'admin', 'super_admin'] },
    is_verified: { type: 'boolean' },
    access_token: { type: 'string', description: 'Firebase Auth ID token.' },
    refresh_token: { type: 'string' },
    expires_in: { type: 'integer', description: 'Access token lifetime in seconds.' },
  },
};

const xpSummary = {
  type: 'object',
  additionalProperties: false,
  properties: {
    currentXp: { type: 'integer', description: 'Capped at MAX_XP (30,000 in MVP).' },
    maxXp: { type: 'integer' },
    currentLevel: { type: 'integer' },
    currentLevelName: { type: 'string' },
    nextLevelXp: { type: 'integer', nullable: true },
    progressPercent: { type: 'number' },
  },
};

const pointsSummary = {
  type: 'object',
  additionalProperties: false,
  properties: {
    currentPoints: { type: 'integer', description: 'Lifetime wallet points balance.' },
  },
};

const rankingPointsSummary = {
  type: 'object',
  description: 'BR-007: period-scoped ranking XP. Each value is the sum of earned XP from xp_ledger filtered by the period cutoff.',
  additionalProperties: false,
  properties: {
    weeklyPoints: { type: 'integer' },
    monthlyPoints: { type: 'integer' },
    allTimePoints: { type: 'integer' },
    currentPoints: { type: 'integer' },
  },
};

const streak = {
  type: 'object',
  additionalProperties: false,
  properties: {
    currentStreak: { type: 'integer' },
    lastLoginAt: { ...dateTime, nullable: true },
    hasLoggedInToday: { type: 'boolean' },
  },
};

const ranks = {
  type: 'object',
  additionalProperties: false,
  properties: {
    city: { type: 'string', nullable: true },
    country: { type: 'string', nullable: true },
    scope: { type: 'string', enum: ['local', 'national', 'worldwide', 'all'] },
    currentXp: { type: 'integer' },
    currentPoints: { type: 'integer' },
    cityRank: { type: 'integer', nullable: true },
    nationalRank: { type: 'integer', nullable: true },
    worldwideRank: { type: 'integer', nullable: true },
  },
};

const userSummary = {
  type: 'object',
  additionalProperties: false,
  properties: {
    xpSummary,
    pointsSummary,
    rankingPointsSummary,
    rank: ranks,
    streak,
    totalCheckInCount: { type: 'integer' },
  },
};

const checkIn = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    userId: id,
    userFullname: { type: 'string' },
    userEmail: { type: 'string', format: 'email' },
    restaurantId: id,
    restaurantName: { type: 'string' },
    restaurantAddress: { type: 'string' },
    qrToken: { type: 'string' },
    awardedXp: { type: 'integer' },
    awardedPoints: { type: 'integer' },
    createdAt: dateTime,
    restaurant: {
      type: 'object',
      description: 'Full restaurant payload — BR-016: lets the confirmation screen render without a second round-trip.',
      additionalProperties: false,
      properties: {
        id,
        name: { type: 'string' },
        address: { type: 'string' },
        city: { type: 'string' },
        country: { type: 'string' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        imageUrl: { type: 'string', format: 'uri', nullable: true },
        category: { type: 'string', nullable: true },
        cuisine: { type: 'string', nullable: true },
        hours: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        website: { type: 'string', format: 'uri', nullable: true },
        rating: { type: 'number', nullable: true },
        pointsPerCheckIn: { type: 'integer' },
        pointsPerReceiptUpload: { type: 'integer' },
        checkinRadiusMeters: { type: 'integer', nullable: true },
        qrRequired: { type: 'boolean' },
      },
    },
    userPointsAfter: { type: 'integer', description: 'BR-001: updated wallet points balance.' },
    userRankingPointsAfter: { type: 'integer', description: 'BR-001: updated earned-points balance.' },
  },
};

const checkInEnvelope = {
  type: 'object',
  additionalProperties: false,
  properties: {
    checkIn,
    restaurant: { type: 'object' },
    userPointsAfter: { type: 'integer' },
    userRankingPointsAfter: { type: 'integer' },
  },
};

const reward = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    pointsRequired: { type: 'integer' },
    quantityAvailable: { type: 'integer' },
    rewardCategory: { type: 'string' },
    xpPoints: { type: 'integer', nullable: true },
    foodItemName: { type: 'string', nullable: true },
    discountPercentage: { type: 'number', nullable: true },
    giftCardCode: { type: 'string', nullable: true },
    termsAndConditions: { type: 'string', nullable: true },
    imageUrl: { type: 'string', format: 'uri', nullable: true },
    isActive: { type: 'boolean' },
    hasExpiry: { type: 'boolean' },
    expiresAt: { ...dateTime, nullable: true },
    status: { type: 'string', enum: ['active', 'inactive', 'expired', 'low_stock'] },
    createdBy: { type: 'string', nullable: true },
    createdAt: dateTime,
    updatedAt: dateTime,
    canRedeem: { type: 'boolean', description: 'Catalog-only flag: user has enough points.' },
    userPoints: { type: 'integer', description: 'Catalog-only: requesting user wallet balance.' },
  },
};

const rewardRedemption = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    rewardId: id,
    userId: id,
    sourceType: { type: 'string' },
    sourceId: id,
    rewardTitle: { type: 'string' },
    rewardDescription: { type: 'string', nullable: true },
    rewardImageUrl: { type: 'string', format: 'uri', nullable: true },
    rewardCategory: { type: 'string' },
    pointsRequired: { type: 'integer' },
    xpPoints: { type: 'integer', nullable: true },
    foodItemName: { type: 'string', nullable: true },
    discountPercentage: { type: 'number', nullable: true },
    giftCardCode: { type: 'string', nullable: true },
    redemptionCode: { type: 'string', description: 'Unique non-transferable UUIDv4 code (BR-006).' },
    termsAndConditions: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['pending', 'used', 'expired', 'cancelled', 'rejected'] },
    redeemedAt: dateTime,
    usedAt: { ...dateTime, nullable: true },
    expiresAt: { ...dateTime, nullable: true, description: 'BR-006: 7 days after redemption.' },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const redemptionResponse = {
  type: 'object',
  additionalProperties: false,
  properties: {
    redemption: rewardRedemption,
    userXpAfter: { type: 'integer' },
    userPointsAfter: { type: 'integer', description: 'BR-001: wallet only.' },
    remainingQuantityAvailable: { type: 'integer' },
  },
};

const spinReward = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    rewardCategory: { type: 'string' },
    pointsReward: { type: 'integer' },
    discountPercentage: { type: 'number', nullable: true },
    pointsRequired: { type: 'integer' },
    quantityAvailable: { type: 'integer' },
    probability: { type: 'number', description: 'Probability weight (0..1).' },
    imageUrl: { type: 'string', format: 'uri', nullable: true },
    isActive: { type: 'boolean' },
    hasExpiry: { type: 'boolean' },
    expiresAt: { ...dateTime, nullable: true },
    isSynthetic: { type: 'boolean' },
    isInfiniteStock: { type: 'boolean' },
  },
};

const spinHistoryItem = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    userId: id,
    rewardId: id,
    rewardTitle: { type: 'string' },
    rewardDescription: { type: 'string', nullable: true },
    rewardCategory: { type: 'string' },
    pointsReward: { type: 'integer' },
    discountPercentage: { type: 'number', nullable: true },
    pointsRequired: { type: 'integer' },
    imageUrl: { type: 'string', format: 'uri', nullable: true },
    spunAt: dateTime,
    createdAt: dateTime,
    updatedAt: dateTime,
    isSynthetic: { type: 'boolean' },
  },
};

const spinResponse = {
  type: 'object',
  additionalProperties: false,
  properties: {
    spin: spinHistoryItem,
    remainingQuantityAvailable: { type: 'integer' },
    nextSpinAt: dateTime,
    isInfiniteStock: { type: 'boolean' },
  },
};

const leaderboardRow = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rank: { type: 'integer' },
    userId: id,
    fullname: { type: 'string' },
    city: { type: 'string' },
    country: { type: 'string' },
    profileImageUrl: { type: 'string', format: 'uri', nullable: true },
    currentXp: { type: 'integer', description: 'Period-scoped earned XP (BR-007).' },
    currentPoints: { type: 'integer' },
  },
};

const leaderboardEnvelope = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scope: { type: 'string', enum: ['local', 'national', 'worldwide'] },
    period: { type: 'string', enum: ['weekly', 'monthly', 'all_time'] },
    items: { type: 'array', items: leaderboardRow },
    pagination,
    serviceArea,
  },
};

const receiptUpload = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    checkinId: id,
    restaurantId: id,
    restaurantName: { type: 'string' },
    receiptImageUrl: { type: 'string', format: 'uri' },
    imageUrl: { type: 'string', format: 'uri', description: 'Alias for receiptImageUrl.' },
    note: { type: 'string', nullable: true },
    status: { type: 'string' },
    awardedXp: { type: 'integer' },
    awardedPoints: { type: 'integer' },
    createdAt: dateTime,
    routeProgress: {
      type: 'array',
      description: 'BR-017: per-route progress updated by this receipt upload.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          routeId: id,
          routeName: { type: 'string' },
          status: { type: 'string' },
          reason: { type: 'string', nullable: true },
          visitedRestaurantIds: { type: 'array', items: id },
          receiptUploadIds: { type: 'array', items: id },
          completedAt: { ...dateTime, nullable: true },
          requiredVisits: { type: 'integer' },
          progressPercent: { type: 'number' },
        },
      },
    },
  },
};

const dishItem = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['restaurant_item'] },
    itemId: id,
    restaurantId: id,
    restaurantName: { type: 'string' },
    restaurantAddress: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    price: { type: 'number' },
    pointsToBuy: { type: 'integer' },
    imageUrl: { type: 'string', format: 'uri', nullable: true },
    isAvailable: { type: 'boolean' },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const dishRedemption = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    userId: id,
    itemId: id,
    restaurantId: id,
    restaurantName: { type: 'string' },
    restaurantAddress: { type: 'string' },
    itemName: { type: 'string' },
    itemDescription: { type: 'string', nullable: true },
    itemImageUrl: { type: 'string', format: 'uri', nullable: true },
    pointsSpent: { type: 'integer' },
    redeemedAt: dateTime,
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const dishRedemptionResponse = {
  type: 'object',
  additionalProperties: false,
  properties: {
    redemption: dishRedemption,
    userXpAfter: { type: 'integer' },
    userPointsAfter: { type: 'integer' },
  },
};

const route = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    routeName: { type: 'string' },
    description: { type: 'string', nullable: true },
    city: { type: 'string' },
    zone: { type: 'string', nullable: true },
    neighborhood: { type: 'string', nullable: true },
    restaurantIds: { type: 'array', items: id },
    restaurants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id,
          name: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          category: { type: 'string' },
          imageUrl: { type: 'string', format: 'uri', nullable: true },
          currentPackage: { type: 'string', nullable: true },
          billingCycle: { type: 'string', nullable: true, enum: ['monthly', 'annual'] },
          routeFeatureEnabled: { type: 'boolean' },
        },
      },
    },
    restaurantCount: { type: 'integer' },
    status: { type: 'string', enum: ['draft', 'active', 'paused', 'completed', 'expired'] },
    startDate: { ...dateTime, nullable: true },
    endDate: { ...dateTime, nullable: true },
    requiredVisits: { type: 'integer', description: 'BR-017: visits needed to complete.' },
    mandatoryOrder: { type: 'boolean' },
    pointsPerReceiptUpload: { type: 'integer' },
    completionBonus: { type: 'integer' },
    limitPerUser: { type: 'integer', nullable: true },
    repeatable: { type: 'boolean' },
    cooldownMinutes: { type: 'integer', description: 'BR-018: recommended 60 minutes.' },
    createdBy: { type: 'string' },
    createdAt: dateTime,
    updatedAt: dateTime,
    userProgress: {
      nullable: true,
      type: 'object',
      additionalProperties: false,
      properties: {
        id,
        status: { type: 'string' },
        visitedRestaurantIds: { type: 'array', items: id },
        receiptUploadIds: { type: 'array', items: id },
        completedAt: { ...dateTime, nullable: true },
        requiredVisits: { type: 'integer' },
        progressPercent: { type: 'number' },
        lastReceiptUploadedAt: { ...dateTime, nullable: true },
      },
    },
  },
};

const challenge = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    rewardPoints: { type: 'integer' },
    rewardId: { type: 'string', nullable: true },
    startAt: dateTime,
    endAt: { ...dateTime, nullable: true },
    status: { type: 'string', enum: ['pending', 'active', 'completed', 'cancelled'] },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id,
          type: { type: 'string', enum: ['check_in_count', 'receipt_upload', 'route_visit'] },
          requiredCount: { type: 'integer' },
        },
      },
    },
    createdBy: { type: 'string' },
    createdAt: dateTime,
    updatedAt: dateTime,
    criteriaCount: { type: 'integer' },
  },
};

const challengeParticipation = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    challengeId: id,
    challengeTitle: { type: 'string' },
    challengeDescription: { type: 'string', nullable: true },
    rewardPoints: { type: 'integer' },
    userId: id,
    userFullname: { type: 'string' },
    userEmail: { type: 'string', format: 'email' },
    status: { type: 'string', enum: ['in_progress', 'completed', 'expired'] },
    totalCheckIns: { type: 'integer' },
    progressPercent: { type: 'number' },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id,
          type: { type: 'string' },
          requiredCount: { type: 'integer' },
          currentCount: { type: 'integer' },
          completed: { type: 'boolean' },
        },
      },
    },
    startedAt: dateTime,
    updatedAt: dateTime,
    completedAt: { ...dateTime, nullable: true },
  },
};

const notification = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    type: { type: 'string' },
    category: { type: 'string', enum: ['promotions', 'challenges', 'rewards', 'nearby', 'general'] },
    title: { type: 'string' },
    body: { type: 'string' },
    sourceId: { type: 'string', nullable: true },
    targetType: { type: 'string', nullable: true },
    targetId: { type: 'string', nullable: true },
    targetUrl: { type: 'string', nullable: true },
    pointsDelta: { type: 'integer', nullable: true },
    createdAt: dateTime,
    isRead: { type: 'boolean' },
  },
};

const notificationListEnvelope = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: { type: 'array', items: notification },
    pagination,
    unreadCount: { type: 'integer' },
  },
};

const notificationCampaign = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    campaignTitle: { type: 'string' },
    campaignBody: { type: 'string' },
    campaignCategory: { type: 'string' },
    targetAudience: { type: 'string' },
    cityName: { type: 'string', nullable: true },
    ageGroup: { type: 'string', nullable: true },
    deliveryType: { type: 'string' },
    scheduledAt: { ...dateTime, nullable: true },
    status: { type: 'string' },
    deliveryRate: { type: 'number', nullable: true },
    createdBy: { type: 'string' },
    sentAt: { ...dateTime, nullable: true },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const supportRequest = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    title: { type: 'string' },
    message: { type: 'string' },
    status: { type: 'string' },
    createdByUid: id,
    createdByEmail: { type: 'string', format: 'email' },
    createdByName: { type: 'string' },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const cmsPage = {
  type: 'object',
  additionalProperties: false,
  properties: {
    slug: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const qrCode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    restaurantId: id,
    restaurantName: { type: 'string' },
    restaurantAddress: { type: 'string' },
    restaurantCategory: { type: 'string' },
    qrCodeName: { type: 'string' },
    qrCodeToken: { type: 'string' },
    qrCodeLatitude: { type: 'number' },
    qrCodeLongitude: { type: 'number' },
    currentPackage: { type: 'string', nullable: true },
    billingCycle: { type: 'string', nullable: true },
    activatedAt: { ...dateTime, nullable: true },
    expiresAt: { ...dateTime, nullable: true },
    isExpired: { type: 'boolean' },
  },
};

const level = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    name: { type: 'string' },
    minXp: { type: 'integer' },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const placement = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id,
    feature: { type: 'string', enum: ['sponsored', 'featured', 'trending'] },
    active: { type: 'boolean' },
    sortOrder: { type: 'integer' },
    restaurantId: id,
    restaurantName: { type: 'string' },
    restaurantCategory: { type: 'string' },
    restaurantAddress: { type: 'string' },
    restaurantImageUrl: { type: 'string', format: 'uri', nullable: true },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const packageCatalogItem = {
  type: 'object',
  additionalProperties: false,
  properties: {
    code: { type: 'string' },
    name: { type: 'string' },
    badge: { type: 'string' },
    price: { type: 'number' },
    billingCycle: { type: 'string', enum: ['monthly', 'annual'] },
    description: { type: 'string' },
    features: { type: 'array', items: { type: 'string' } },
  },
};

const sharePreview = {
  type: 'object',
  additionalProperties: false,
  properties: {
    shareType: { type: 'string', enum: ['checkin', 'reward', 'receipt'] },
    entityId: id,
    title: { type: 'string' },
    text: { type: 'string' },
    imageUrl: { type: 'string', format: 'uri', nullable: true },
    pointsReward: { type: 'integer' },
    restaurantId: { type: 'string', nullable: true },
    restaurantName: { type: 'string', nullable: true },
    rewardId: { type: 'string', nullable: true },
    rewardTitle: { type: 'string', nullable: true },
    rewardCategory: { type: 'string', nullable: true },
    awardedPoints: { type: 'integer', nullable: true },
    redeemedAt: { ...dateTime, nullable: true },
    createdAt: { ...dateTime, nullable: true },
  },
};

// Public registry exported for the openapi generator. Keep keys stable.
export const componentSchemas = {
  ErrorResponse: errorResponse,
  SuccessEnvelope: successEnvelope,
  MessageResponse: messageResponse,
  Pagination: pagination,
  PaginatedEnvelope: paginatedEnvelope,

  User: user,
  AuthSession: authSession,
  XpSummary: xpSummary,
  PointsSummary: pointsSummary,
  RankingPointsSummary: rankingPointsSummary,
  Streak: streak,
  Ranks: ranks,
  UserSummary: userSummary,

  Restaurant: restaurant,
  RestaurantListItem: restaurantListItem,
  RestaurantDetail: restaurantDetail,
  RestaurantMenu: restaurantMenu,
  MenuItem: menuItem,
  Review: review,
  Directions: directions,
  ServiceArea: serviceArea,
  RestaurantListEnvelope: restaurantListEnvelope,

  CheckIn: checkIn,
  CheckInEnvelope: checkInEnvelope,

  Reward: reward,
  RewardRedemption: rewardRedemption,
  RedemptionResponse: redemptionResponse,

  SpinReward: spinReward,
  SpinHistoryItem: spinHistoryItem,
  SpinResponse: spinResponse,

  LeaderboardRow: leaderboardRow,
  LeaderboardEnvelope: leaderboardEnvelope,

  ReceiptUpload: receiptUpload,
  DishItem: dishItem,
  DishRedemption: dishRedemption,
  DishRedemptionResponse: dishRedemptionResponse,

  Route: route,
  Challenge: challenge,
  ChallengeParticipation: challengeParticipation,

  Notification: notification,
  NotificationListEnvelope: notificationListEnvelope,
  NotificationCampaign: notificationCampaign,

  SupportRequest: supportRequest,
  CmsPage: cmsPage,
  QrCode: qrCode,
  Level: level,
  Placement: placement,
  PackageCatalogItem: packageCatalogItem,
  SharePreview: sharePreview,
};

// Convenience: wraps a component schema in the standard success envelope.
export function wrapInEnvelope(schemaName, description) {
  return successEnvelope({ $ref: `#/components/schemas/${schemaName}` }, description);
}

export function wrapPaginated(schemaName, description) {
  return paginatedEnvelope(
    { $ref: `#/components/schemas/${schemaName}` },
    description,
  );
}
