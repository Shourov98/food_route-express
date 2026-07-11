import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthService } from '../src/modules/auth/authService.js';

class FakeUserRepository {
  constructor() {
    this.usersByEmail = new Map();
    this.usersByUid = new Map();
    this.usersByReferralCode = new Map();
  }

  async create(record) {
    this.usersByEmail.set(record.email, record);
    this.usersByUid.set(record.uid, record);
    this.usersByReferralCode.set(record.referralCode, record);
    return record;
  }

  async getByEmail(email) {
    return this.usersByEmail.get(email) ?? null;
  }

  async getByUid(uid) {
    return this.usersByUid.get(uid) ?? null;
  }

  async getByReferralCode(code) {
    return this.usersByReferralCode.get(code) ?? null;
  }

  async markVerified(email) {
    const user = this.usersByEmail.get(email);
    if (user) {
      user.isVerified = true;
    }
  }
}

class FakeOtpRepository {
  constructor() {
    this.records = [];
  }

  async save(record) {
    this.records.push(record);
    return record;
  }

  async getLatestActive(email, purpose) {
    return (
      this.records
        .filter((record) => record.email === email && record.purpose === purpose)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null
    );
  }

  async incrementAttempts(documentId) {
    const record = this.records.find((item) => item.documentId === documentId);
    if (record) {
      record.attemptCount += 1;
    }
  }

  async consume(documentId) {
    const record = this.records.find((item) => item.documentId === documentId);
    if (record) {
      record.consumedAt = new Date();
    }
  }
}

class FakeLoginEventRepository {
  constructor() {
    this.records = [];
  }

  async create(record) {
    this.records.push(record);
    return record;
  }
}

class FakeIdentityProvider {
  constructor() {
    this.usersByEmail = new Map();
    this.verified = new Set();
  }

  async createUser({ email }) {
    const user = { uid: `uid-${this.usersByEmail.size + 1}`, email };
    this.usersByEmail.set(email, user);
    return user;
  }

  async getUserByEmail(email) {
    return this.usersByEmail.get(email) ?? null;
  }

  async markEmailVerified(uid) {
    this.verified.add(uid);
  }

  async signIn({ email }) {
    const user = this.usersByEmail.get(email);
    return {
      uid: user.uid,
      email,
      idToken: `token-${user.uid}`,
      refreshToken: `refresh-${user.uid}`,
      expiresIn: 3600,
    };
  }

  async verifyIdToken(token) {
    const uid = token.replace('token-', '');
    return { uid, email: [...this.usersByEmail.values()].find((user) => user.uid === uid).email };
  }

  async updatePassword() {}
  async generateEmailVerificationLink(email) {
    return `https://example.test/verify?email=${email}`;
  }
  async generatePasswordResetLink(email) {
    return `https://example.test/reset?email=${email}`;
  }
}

class FakeEmailService {
  constructor() {
    this.otps = [];
  }

  sendOtp(payload) {
    this.otps.push(payload);
  }

  sendVerificationLink() {}
  sendPasswordResetLink() {}
}

class FakeXpService {
  constructor() {
    this.pointAwards = [];
  }

  async awardPoints(payload) {
    const existing = this.pointAwards.find((item) => (
      item.userId === payload.userId
      && item.sourceType === payload.sourceType
      && item.sourceId === payload.sourceId
    ));
    if (existing) {
      return null;
    }

    const record = { id: `points-${this.pointAwards.length + 1}`, ...payload };
    this.pointAwards.push(record);
    return record;
  }
}

function createService() {
  const userRepository = new FakeUserRepository();
  const otpRepository = new FakeOtpRepository();
  const loginEventRepository = new FakeLoginEventRepository();
  const identityProvider = new FakeIdentityProvider();
  const emailService = new FakeEmailService();
  const xpService = new FakeXpService();
  const service = new AuthService({
    userRepository,
    otpRepository,
    loginEventRepository,
    identityProvider,
    emailService,
    xpService,
    config: {
      authVerificationMode: 'otp',
      authPasswordResetMode: 'otp',
      otpSigningSecret: 'test-secret',
      otpExpiryMinutes: 10,
      otpResendCooldownSeconds: 60,
      otpMaxAttempts: 5,
    },
  });

  return {
    service,
    userRepository,
    otpRepository,
    loginEventRepository,
    identityProvider,
    emailService,
    xpService,
  };
}

test('AuthService register returns FastAPI-compatible response data', async () => {
  const { service, userRepository, emailService, xpService } = createService();

  const result = await service.register({
    fullname: 'Jane Doe',
    email: 'jane@example.com',
    gender: 'female',
    dateOfBirth: '1996-05-14',
    city: 'Dhaka',
    country: 'Bangladesh',
    password: 'Password123',
  });

  assert.equal(result.email, 'jane@example.com');
  assert.equal(result.role, 'user');
  assert.equal(result.is_verified, false);
  assert.equal(result.referralCode.length, 8);
  assert.equal(emailService.otps.length, 1);
  assert.equal((await userRepository.getByEmail('jane@example.com')).uid, result.uid);
  assert.equal(xpService.pointAwards.length, 0);
});

test('AuthService awards signup bonus only after register OTP verification', async () => {
  const { service, emailService, xpService } = createService();

  await service.register({
    fullname: 'Jane Doe',
    email: 'jane@example.com',
    gender: 'female',
    dateOfBirth: '1996-05-14',
    city: 'Dhaka',
    country: 'Bangladesh',
    password: 'Password123',
  });

  assert.equal(xpService.pointAwards.length, 0);

  await service.verifyRegisterOtp({
    email: 'jane@example.com',
    otp: emailService.otps[0].otp,
  });

  assert.equal(xpService.pointAwards.length, 1);
  assert.equal(xpService.pointAwards[0].delta, 100);
  assert.equal(xpService.pointAwards[0].sourceType, 'signup_bonus');
});

test('AuthService forgotPassword is generic for missing emails', async () => {
  const { service, emailService } = createService();

  await service.forgotPassword('missing@example.com');

  assert.equal(emailService.otps.length, 0);
});

test('AuthService login rejects unverified users with matching code', async () => {
  const { service } = createService();
  await service.register({
    fullname: 'Jane Doe',
    email: 'jane@example.com',
    gender: 'female',
    dateOfBirth: '1996-05-14',
    city: 'Dhaka',
    country: 'Bangladesh',
    password: 'Password123',
  });

  await assert.rejects(
    service.login({ email: 'jane@example.com', password: 'Password123' }),
    { code: 'user_not_verified', statusCode: 403 },
  );
});
