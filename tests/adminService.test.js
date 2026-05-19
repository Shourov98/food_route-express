import assert from 'node:assert/strict';
import test from 'node:test';

import { AdminService } from '../src/modules/admin/adminService.js';

class FakeUserRepository {
  constructor(users = []) {
    this.users = new Map(users.map((user) => [user.uid, user]));
  }

  async create(record) {
    this.users.set(record.uid, record);
    return record;
  }

  async getByEmail(email) {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async getByUid(uid) {
    return this.users.get(uid) ?? null;
  }

  async listByRole(role, { blockedOnly = false } = {}) {
    return [...this.users.values()].filter(
      (user) => user.role === role && (!blockedOnly || user.isBlocked),
    );
  }

  async updateFields(uid, fields) {
    const user = this.users.get(uid);
    if (!user) return null;
    Object.assign(user, {
      fullname: fields.fullname ?? user.fullname,
      phone: fields.phone ?? user.phone,
      profileImageUrl: fields.profile_image_url ?? user.profileImageUrl,
    });
    return user;
  }

  async setBlockStatus(uid, { isBlocked }) {
    const user = this.users.get(uid);
    if (!user) return null;
    user.isBlocked = isBlocked;
    return user;
  }
}

class FakeOtpRepository {
  async save() {}
  async getLatestActive() {
    return null;
  }
}

class FakeLoginEventRepository {
  async countCurrentStreak() {
    return 2;
  }
}

class FakeCheckInRepository {
  constructor(records = []) {
    this.records = records;
  }

  async countByUser() {
    return 3;
  }

  async listAll() {
    return this.records;
  }
}

class FakeIdentityProvider {
  constructor() {
    this.created = 0;
    this.disabled = new Map();
  }

  async getUserByEmail(email) {
    return null;
  }

  async createUser({ email }) {
    this.created += 1;
    return { uid: `identity-${this.created}`, email };
  }

  async markEmailVerified() {}

  async verifyIdToken(token) {
    return { uid: token, email: `${token}@example.com` };
  }

  async signIn({ email }) {
    return {
      uid: email,
      email,
      idToken: 'token',
      refreshToken: 'refresh',
      expiresIn: 3600,
    };
  }

  async updatePassword() {}

  async setDisabled({ uid, disabled }) {
    this.disabled.set(uid, disabled);
  }
}

class FakeEmailService {
  sendOtp() {}

  async sendAdminCredentials({ email, password, loginUrl }) {
    this.lastAdminCredentials = { email, password, loginUrl };
  }
}

class FakeXpService {
  constructor() {
    this.points = new Map();
    this.records = [];
  }

  async getTotalPoints(userId) {
    return this.points.get(userId) ?? 0;
  }

  async adjustPoints({ userId, delta }) {
    const current = this.points.get(userId) ?? 0;
    const appliedDelta = Math.max(delta, -current);
    if (appliedDelta === 0) return null;
    this.points.set(userId, current + appliedDelta);
    const record = {
      pointsDelta: appliedDelta,
      sourceType: 'admin_adjustment',
      sourceId: 'adjustment-1',
      userId,
      createdAt: new Date(),
    };
    this.records.push(record);
    return record;
  }

  async listPointsRecords() {
    return this.records;
  }
}

class FakeRewardRedemptionRepository {
  constructor(records = []) {
    this.records = records;
  }

  async listAll() {
    return this.records;
  }

  async countByUser(userId) {
    return this.records.filter((record) => record.userId === userId).length;
  }
}

class FakeImageStorage {
  async uploadImage({ folder, file }) {
    return {
      publicUrl: `https://cdn.example.com/${folder}/${file.originalname}`,
    };
  }
}

function makeUser(overrides = {}) {
  return {
    uid: 'user-1',
    fullname: 'Jane Doe',
    phone: null,
    email: 'user@example.com',
    gender: 'female',
    age: 28,
    city: 'Dhaka',
    country: 'Bangladesh',
    profileImageUrl: null,
    referralCode: 'ABCDEFGH',
    role: 'user',
    isVerified: true,
    isBlocked: false,
    ...overrides,
  };
}

function createService() {
  const checkinRepository = new FakeCheckInRepository();
  const userRepository = new FakeUserRepository([
    makeUser({
      uid: 'super-1',
      email: 'super@example.com',
      role: 'super_admin',
      gender: 'unspecified',
    }),
    makeUser(),
  ]);
  const identityProvider = new FakeIdentityProvider();
  const emailService = new FakeEmailService();
  const xpService = new FakeXpService();
  const service = new AdminService({
    userRepository,
    otpRepository: new FakeOtpRepository(),
    loginEventRepository: new FakeLoginEventRepository(),
    identityProvider,
    emailService,
    xpService,
    checkinRepository,
    rewardRedemptionRepository: new FakeRewardRedemptionRepository(),
    imageStorage: new FakeImageStorage(),
    config: {
      otpSigningSecret: 'secret',
      otpExpiryMinutes: 10,
      otpResendCooldownSeconds: 60,
      otpMaxAttempts: 5,
      adminDashboardLoginUrl: 'https://admin.example.com/sign-in',
      initialSuperAdminFullname: 'Super Admin',
      initialSuperAdminPhone: '+8801700000000',
      initialSuperAdminEmail: 'seed@example.com',
      initialSuperAdminPassword: 'Password123',
    },
  });
  return { service, userRepository, identityProvider, xpService, checkinRepository, emailService };
}

test('AdminService creates admins only for super admin tokens', async () => {
  const { service, userRepository, emailService } = createService();

  const result = await service.createAdmin({
    accessToken: 'super-1',
    payload: {
      fullname: 'Admin User',
      phone: '+8801700000001',
      email: 'admin@example.com',
      password: 'Password123',
    },
  });

  assert.equal(result.role, 'admin');
  assert.equal(result.is_verified, true);
  assert.equal(result.credentialsEmailSent, true);
  assert.equal((await userRepository.getByEmail('admin@example.com')).fullname, 'Admin User');
  assert.deepEqual(emailService.lastAdminCredentials, {
    email: 'admin@example.com',
    password: 'Password123',
    loginUrl: 'https://admin.example.com/sign-in',
  });
});

test('AdminService lists and filters managed users', async () => {
  const { service } = createService();

  const result = await service.listUsers({
    accessToken: 'super-1',
    page: 1,
    pageSize: 10,
    filters: {
      search: 'jane',
      city: null,
      country: null,
      gender: null,
      isVerified: null,
      isBlocked: null,
    },
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].email, 'user@example.com');
  assert.equal(result.pagination.totalItems, 1);
});

test('AdminService blocks users and disables Firebase auth account', async () => {
  const { service, identityProvider } = createService();

  const result = await service.blockUser({ accessToken: 'super-1', userId: 'user-1' });

  assert.equal(result.is_blocked, true);
  assert.equal(identityProvider.disabled.get('user-1'), true);
});

test('AdminService adjusts user points', async () => {
  const { service } = createService();

  const result = await service.adjustUserPoints({
    accessToken: 'super-1',
    userId: 'user-1',
    payload: { pointsDelta: 75 },
  });

  assert.equal(result.currentPoints, 75);
});

test('AdminService uploads profile image', async () => {
  const { service } = createService();

  const result = await service.uploadProfileImage({
    accessToken: 'super-1',
    image: { originalname: 'avatar.png', mimetype: 'image/png', buffer: Buffer.from('ok') },
  });

  assert.equal(result.profileImageUrl, 'https://cdn.example.com/admin_profiles/super-1/avatar.png');
});

test('AdminService builds dashboard summary', async () => {
  const { service, checkinRepository, xpService } = createService();
  const now = new Date();
  checkinRepository.records = [
    {
      id: 'check-1',
      userId: 'user-1',
      restaurantId: 'restaurant-1',
      restaurantName: 'Route Cafe',
      awardedPoints: 25,
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
    },
  ];
  xpService.records = [
    {
      userId: 'user-1',
      pointsDelta: 25,
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
    },
  ];

  const result = await service.getDashboardSummary({
    accessToken: 'super-1',
    dashboardRange: 'last_24_hours',
    year: null,
    month: null,
  });

  assert.equal(result.activeUsers, 1);
  assert.equal(result.dailyCheckIns, 1);
  assert.equal(result.pointsIssued, 25);
  assert.equal(result.topRestaurants.length, 1);
  assert.equal(result.topUsers.length, 1);
  assert.equal(result.genderAnalysis.find((item) => item.label === 'Female')?.count, 1);
  assert.equal(result.ageAnalysis.find((item) => item.label === 'Middle Age Man')?.count, 1);
});
