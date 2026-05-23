import { randomUUID } from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';

function buildEnabledFeatures(enabledPackages) {
  const packageSet = new Set(enabledPackages);
  const rules = [
    ['basicListing', 'Basic Listing', ['start', 'active', 'pro', 'prime', 'dominio']],
    ['checkInRewards', 'Check-in Rewards', ['active', 'pro', 'prime', 'dominio']],
    ['featuredListing', 'Featured Listing', ['pro', 'prime', 'dominio']],
    ['proximityAlerts', 'Proximity Alerts', ['prime', 'dominio']],
    ['routes', 'Routes', ['dominio']],
    ['premiumAnalytics', 'Premium Analytics', ['dominio']],
  ];

  return rules.map(([key, name, packages]) => ({
    key,
    name,
    enabled: packages.some((item) => packageSet.has(item)),
  }));
}

function restaurantResponse(record) {
  return {
    id: record.id,
    name: record.name,
    address: record.address,
    city: record.city,
    latitude: record.latitude,
    longitude: record.longitude,
    category: record.category,
    openingTime: record.openingTime,
    closingTime: record.closingTime,
    imageUrl: record.imageUrl,
    qrCode: record.qrCode,
    pointsPerCheckIn: record.pointsPerCheckIn,
    status: record.status,
    createdBy: record.createdBy,
    enabledPackages: record.enabledPackages,
    enabledFeatures: buildEnabledFeatures(record.enabledPackages),
    packageState:
      record.currentPackage || record.billingCycle || record.activatedAt || record.expiresAt
        ? {
            currentPackage: record.currentPackage ?? null,
            billingCycle: record.billingCycle ?? null,
            activatedAt: record.activatedAt ?? null,
            expiresAt: record.expiresAt ?? null,
          }
        : null,
  };
}

const ANALYTICS_RANGES = {
  last_7_days: 7,
  last_30_days: 30,
  last_90_days: 90,
};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEATMAP_PERIODS = [
  { key: 'morning', label: 'Morning', from: 5, to: 11 },
  { key: 'lunch', label: 'Lunch', from: 11, to: 15 },
  { key: 'afternoon', label: 'Afternoon', from: 15, to: 18 },
  { key: 'dinner', label: 'Dinner', from: 18, to: 24 },
];

function roundPercentage(value) {
  return Math.round(value * 100) / 100;
}

function utcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function analyticsWindow(range, now = new Date()) {
  const days = ANALYTICS_RANGES[range] ?? ANALYTICS_RANGES.last_30_days;
  const end = new Date(now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  start.setUTCHours(0, 0, 0, 0);
  return { range, days, start, end };
}

function checkinDayIndex(date) {
  return (date.getUTCDay() + 6) % 7;
}

function checkinHeatmapPeriod(date) {
  const hour = date.getUTCHours();
  return HEATMAP_PERIODS.find((period) => period.from <= hour && hour < period.to) ?? null;
}

function groupCountsByUser(checkins) {
  const counts = new Map();
  for (const checkin of checkins) {
    counts.set(checkin.userId, (counts.get(checkin.userId) ?? 0) + 1);
  }
  return counts;
}

export class RestaurantService {
  constructor({
    restaurantRepository,
    checkinRepository = null,
    menuService,
    userRepository,
    identityProvider,
    imageStorage,
  }) {
    this.restaurantRepository = restaurantRepository;
    this.checkinRepository = checkinRepository;
    this.menuService = menuService;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.imageStorage = imageStorage;
  }

  async createRestaurant({ accessToken, payload, image }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const now = new Date();
    const restaurantId = randomUUID();
    const imageUrl = (
      await this.imageStorage.uploadImage({ folder: `restaurants/${restaurantId}`, file: image })
    ).publicUrl;

    const created = await this.restaurantRepository.create({
      id: restaurantId,
      name: payload.name,
      address: payload.address,
      city: payload.city,
      latitude: payload.latitude,
      longitude: payload.longitude,
      category: payload.category,
      openingTime: payload.openingTime,
      closingTime: payload.closingTime,
      imageUrl,
      qrCode: payload.qrCode,
      pointsPerCheckIn: payload.pointsPerCheckIn,
      enabledPackages: [],
      status: 'inactive',
      createdBy: admin.uid,
      createdAt: now,
      updatedAt: now,
      currentPackage: null,
      billingCycle: null,
      activatedAt: null,
      expiresAt: null,
    });

    await this.menuService.ensureDefaultMenu({
      restaurantId: created.id,
      restaurantName: created.name,
      createdBy: admin.uid,
    });

    return restaurantResponse(created);
  }

  async updateRestaurant({ accessToken, restaurantId, payload, image }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const existing = await this.restaurantRepository.getById(restaurantId);
    if (!existing) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }

    const updated = {
      ...existing,
      name: payload.name,
      address: payload.address,
      city: payload.city,
      latitude: payload.latitude,
      longitude: payload.longitude,
      category: payload.category,
      openingTime: payload.openingTime,
      closingTime: payload.closingTime,
      imageUrl: image
        ? (await this.imageStorage.uploadImage({ folder: `restaurants/${restaurantId}`, file: image }))
            .publicUrl
        : payload.imageUrl || existing.imageUrl,
      qrCode: payload.qrCode,
      pointsPerCheckIn: payload.pointsPerCheckIn,
      createdBy: existing.createdBy || admin.uid,
      updatedAt: new Date(),
    };

    await this.restaurantRepository.update(restaurantId, updated);
    return restaurantResponse(updated);
  }

  async listRestaurants({ accessToken }) {
    await this.getCurrentAccount(accessToken);
    return (await this.restaurantRepository.listAll()).map(restaurantResponse);
  }

  async getRestaurant({ accessToken, restaurantId }) {
    await this.getCurrentAccount(accessToken);
    const restaurant = await this.restaurantRepository.getById(restaurantId);
    if (!restaurant) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
    return restaurantResponse(restaurant);
  }

  async listRestaurantAnalytics({ accessToken, range }) {
    await this.getCurrentAdmin(accessToken);
    const window = analyticsWindow(range);
    const [restaurants, checkins] = await Promise.all([
      this.restaurantRepository.listAll(),
      this.listAnalyticsCheckins(),
    ]);
    const filtered = this.filterAnalyticsCheckins(checkins, window);

    return {
      range: window.range,
      from: window.start,
      to: window.end,
      items: restaurants.map((restaurant) => {
        const restaurantCheckins = filtered.filter((record) => record.restaurantId === restaurant.id);
        const counts = groupCountsByUser(restaurantCheckins);
        const repeatVisitors = [...counts.values()].filter((count) => count > 1).length;
        return {
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          city: restaurant.city,
          imageUrl: restaurant.imageUrl,
          status: restaurant.status,
          totalCheckIns: restaurantCheckins.length,
          uniqueVisitors: counts.size,
          repeatVisitors,
          repeatVisitRate: counts.size ? roundPercentage((repeatVisitors / counts.size) * 100) : 0,
          routeVisitors: 0,
          conversionRate: counts.size ? 100 : 0,
        };
      }),
      routeTrafficTracked: false,
    };
  }

  async getRestaurantAnalytics({ accessToken, restaurantId, range }) {
    await this.getCurrentAdmin(accessToken);
    const restaurant = await this.restaurantRepository.getById(restaurantId);
    if (!restaurant) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }

    const window = analyticsWindow(range);
    const allRestaurantCheckins = (await this.listAnalyticsCheckins()).filter(
      (record) => record.restaurantId === restaurant.id,
    );
    const checkins = this.filterAnalyticsCheckins(allRestaurantCheckins, window);
    const userCounts = groupCountsByUser(checkins);
    const repeatVisitors = [...userCounts.values()].filter((count) => count > 1).length;
    const vipVisitors = [...userCounts.values()].filter((count) => count >= 5).length;
    const newVisitors = [...userCounts.keys()].filter((userId) => {
      const firstCheckin = allRestaurantCheckins
        .filter((record) => record.userId === userId)
        .sort((left, right) => left.createdAt - right.createdAt)[0];
      return firstCheckin && window.start <= firstCheckin.createdAt && firstCheckin.createdAt <= window.end;
    }).length;

    return {
      restaurant: restaurantResponse(restaurant),
      range: window.range,
      from: window.start,
      to: window.end,
      dataBasis: 'check_ins',
      routeTrafficTracked: false,
      kpis: {
        totalCheckIns: checkins.length,
        uniqueVisitors: userCounts.size,
        repeatVisitRate: userCounts.size ? roundPercentage((repeatVisitors / userCounts.size) * 100) : 0,
        routeVisitors: 0,
        conversionRate: userCounts.size ? 100 : 0,
      },
      trend: this.buildAnalyticsTrend(checkins, window),
      loyalty: {
        returningCustomers: repeatVisitors,
        newCustomers: newVisitors,
        vipCustomers: vipVisitors,
        returningRate: userCounts.size ? roundPercentage((repeatVisitors / userCounts.size) * 100) : 0,
      },
      heatmap: this.buildAnalyticsHeatmap(checkins),
      routeTrafficPerformance: [],
      visitBreakdown: this.buildVisitBreakdown(checkins, window),
      topUsers: this.buildAnalyticsTopUsers(checkins),
    };
  }

  async deleteRestaurant({ accessToken, restaurantId }) {
    await this.getCurrentAdmin(accessToken);
    const deleted = await this.restaurantRepository.delete(restaurantId);
    if (!deleted) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
  }

  async listAnalyticsCheckins() {
    return this.checkinRepository ? this.checkinRepository.listAll() : [];
  }

  filterAnalyticsCheckins(checkins, window) {
    return checkins.filter(
      (record) => window.start <= record.createdAt && record.createdAt <= window.end,
    );
  }

  buildAnalyticsTrend(checkins, window) {
    return this.dayBuckets(checkins, window).map((bucket) => ({
      date: bucket.date,
      label: bucket.label,
      visitors: bucket.userIds.size,
      checkIns: bucket.checkIns,
    }));
  }

  buildVisitBreakdown(checkins, window) {
    return this.dayBuckets(checkins, window)
      .map((bucket) => ({
        date: bucket.date,
        label: bucket.label,
        visitors: bucket.userIds.size,
        checkIns: bucket.checkIns,
        repeatVisits: [...bucket.userCounts.values()].filter((count) => count > 1).length,
        conversionRate: bucket.userIds.size ? 100 : 0,
        routeTraffic: 0,
      }))
      .reverse();
  }

  dayBuckets(checkins, window) {
    const buckets = [];
    const cursor = new Date(window.start);
    while (cursor <= window.end) {
      const date = utcDayKey(cursor);
      buckets.push({
        date,
        label: cursor.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }),
        userIds: new Set(),
        userCounts: new Map(),
        checkIns: 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));
    for (const checkin of checkins) {
      const bucket = byDate.get(utcDayKey(checkin.createdAt));
      if (!bucket) continue;
      bucket.checkIns += 1;
      bucket.userIds.add(checkin.userId);
      bucket.userCounts.set(checkin.userId, (bucket.userCounts.get(checkin.userId) ?? 0) + 1);
    }
    return buckets;
  }

  buildAnalyticsHeatmap(checkins) {
    const rows = new Map(
      HEATMAP_PERIODS.map((period) => [period.key, { period: period.label, values: Array(7).fill(0) }]),
    );
    for (const checkin of checkins) {
      const period = checkinHeatmapPeriod(checkin.createdAt);
      if (!period) continue;
      rows.get(period.key).values[checkinDayIndex(checkin.createdAt)] += 1;
    }
    return [...rows.values()].map((row) => ({
      period: row.period,
      values: row.values,
      days: Object.fromEntries(DAY_KEYS.map((key, index) => [key, row.values[index]])),
      dayLabels: DAY_LABELS,
    }));
  }

  buildAnalyticsTopUsers(checkins) {
    const users = new Map();
    for (const record of checkins) {
      const current = users.get(record.userId) ?? {
        userId: record.userId,
        fullname: record.userFullname || 'Unknown User',
        email: record.userEmail || '',
        checkIns: 0,
        pointsEarned: 0,
      };
      current.checkIns += 1;
      current.pointsEarned += record.awardedPoints ?? 0;
      users.set(record.userId, current);
    }
    return [...users.values()]
      .sort((left, right) => right.checkIns - left.checkIns || left.fullname.localeCompare(right.fullname))
      .slice(0, 10);
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
