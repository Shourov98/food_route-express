import crypto from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';
import { generateNumericOtp, hashOtp } from '../../core/security.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import {
  getAuthenticatedAccount,
  requireActiveRoles,
  requireVerifiedAccount,
} from '../../shared/auth/authorization.js';

const ADMIN_FORGOT_PASSWORD = 'admin_forgot_password';

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1_000);
}

function adminResponse(record, stats = {}) {
  return {
    uid: record.uid,
    fullname: record.fullname,
    phone: record.phone,
    email: record.email,
    gender: record.gender,
    age: record.age,
    dateOfBirth: record.dateOfBirth ?? null,
    city: record.city,
    country: record.country,
    profileImageUrl: record.profileImageUrl,
    referralCode: record.referralCode,
    role: record.role,
    is_verified: record.isVerified,
    is_blocked: record.isBlocked,
    currentPoints: stats.currentPoints ?? 0,
    totalCheckIns: stats.totalCheckIns ?? 0,
    redeemedRewards: stats.redeemedRewards ?? 0,
    totalStreakLogins: stats.totalStreakLogins ?? 0,
  };
}

function adminCheckinResponse(record) {
  return {
    id: record.id,
    userId: record.userId,
    userFullname: record.userFullname,
    userEmail: record.userEmail,
    restaurantId: record.restaurantId,
    restaurantName: record.restaurantName,
    restaurantAddress: record.restaurantAddress,
    qrToken: record.qrToken,
    awardedXp: record.awardedXp,
    awardedPoints: record.awardedPoints,
    createdAt: record.createdAt,
  };
}

function loginResponse(record, signInResult) {
  return {
    uid: record.uid,
    email: record.email,
    role: record.role,
    is_verified: record.isVerified,
    access_token: signInResult.idToken,
    refresh_token: signInResult.refreshToken,
    expires_in: signInResult.expiresIn,
  };
}

export class AdminService {
  constructor({
    userRepository,
    otpRepository,
    loginEventRepository,
    identityProvider,
    emailService,
    xpService,
    checkinRepository,
    rewardRedemptionRepository,
    imageStorage,
    config,
  }) {
    this.userRepository = userRepository;
    this.otpRepository = otpRepository;
    this.loginEventRepository = loginEventRepository;
    this.identityProvider = identityProvider;
    this.emailService = emailService;
    this.xpService = xpService;
    this.checkinRepository = checkinRepository;
    this.rewardRedemptionRepository = rewardRedemptionRepository;
    this.imageStorage = imageStorage;
    this.config = config;
  }

  async seedSuperAdmin(payload) {
    const seedPayload = payload ?? this.resolveSeedPayload();
    if ((await this.userRepository.listByRole('super_admin')).length > 0) {
      throw new ApplicationError({
        code: 'super_admin_already_exists',
        message: 'A super admin account already exists.',
        statusCode: 409,
      });
    }
    if (await this.userRepository.getByEmail(seedPayload.email)) {
      throw new ApplicationError({
        code: 'super_admin_already_exists',
        message: 'An account with this email already exists.',
        statusCode: 409,
      });
    }
    let identityUser = await this.identityProvider.getUserByEmail(seedPayload.email);
    if (!identityUser) {
      identityUser = await this.identityProvider.createUser({
        email: seedPayload.email,
        password: seedPayload.password,
        displayName: seedPayload.fullname,
      });
    }
    await this.identityProvider.markEmailVerified(identityUser.uid);
    const now = new Date();
    const record = {
      uid: identityUser.uid,
      fullname: seedPayload.fullname,
      phone: seedPayload.phone,
      email: seedPayload.email,
      gender: 'unspecified',
      age: null,
      dateOfBirth: null,
      city: null,
      country: null,
      profileImageUrl: null,
      referralCode: null,
      referredByUid: null,
      referralBonusAwarded: false,
      role: 'super_admin',
      isVerified: true,
      isBlocked: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.userRepository.create(record);
    return {
      uid: record.uid,
      fullname: record.fullname,
      phone: record.phone ?? '',
      email: record.email,
      role: record.role,
      is_verified: record.isVerified,
    };
  }

  resolveSeedPayload() {
    const missing = [];
    if (!this.config.initialSuperAdminFullname) missing.push('INITIAL_SUPER_ADMIN_FULLNAME');
    if (!this.config.initialSuperAdminPhone) missing.push('INITIAL_SUPER_ADMIN_PHONE');
    if (!this.config.initialSuperAdminEmail) missing.push('INITIAL_SUPER_ADMIN_EMAIL');
    if (!this.config.initialSuperAdminPassword) missing.push('INITIAL_SUPER_ADMIN_PASSWORD');
    if (missing.length > 0) {
      throw new ApplicationError({
        code: 'super_admin_seed_config_missing',
        message: `Missing super admin seed configuration in environment: ${missing.join(', ')}`,
        statusCode: 500,
      });
    }
    return {
      fullname: this.config.initialSuperAdminFullname,
      phone: this.config.initialSuperAdminPhone,
      email: this.config.initialSuperAdminEmail,
      password: this.config.initialSuperAdminPassword,
    };
  }

  async login(payload) {
    const admin = await this.getAdminAccountByEmail(payload.email);
    this.ensureActiveAdminAccount(admin);
    const signInResult = await this.identityProvider.signIn({
      email: payload.email,
      password: payload.password,
    });
    return loginResponse(admin, signInResult);
  }

  async refreshSession(refreshToken) {
    const signInResult = await this.identityProvider.refreshSession(refreshToken);
    const admin = await this.getCurrentAdmin(signInResult.idToken);
    return loginResponse(admin, signInResult);
  }

  async forgotPassword(email) {
    const admin = await this.getAdminAccountByEmail(email);
    this.ensureActiveAdminAccount(admin);
    await this.ensureResendAvailable(email);
    await this.issueOtp(email);
  }

  async resendForgotPasswordOtp(email) {
    await this.forgotPassword(email);
  }

  async verifyForgotPasswordOtp(email, otp) {
    const admin = await this.getAdminAccountByEmail(email);
    this.ensureActiveAdminAccount(admin);
    await this.verifyOtp(email, otp);
    return { email, is_verified: true };
  }

  async resetPasswordAfterOtp(payload) {
    const admin = await this.getAdminAccountByEmail(payload.email);
    this.ensureActiveAdminAccount(admin);
    const latestOtp = await this.otpRepository.getLatestActive(payload.email, ADMIN_FORGOT_PASSWORD);
    if (!latestOtp || !latestOtp.consumedAt) {
      throw new ApplicationError({
        code: 'otp_not_verified',
        message: 'You must verify the forgot-password OTP before resetting your password.',
        statusCode: 400,
      });
    }
    await this.identityProvider.updatePassword({ uid: admin.uid, password: payload.new_password });
  }

  async changePassword({ accessToken, payload }) {
    const admin = await this.getCurrentAdmin(accessToken);
    if (payload.current_password === payload.new_password) {
      throw new ApplicationError({
        code: 'password_unchanged',
        message: 'The new password must be different from the current password.',
        statusCode: 400,
      });
    }
    await this.identityProvider.signIn({ email: admin.email, password: payload.current_password });
    await this.identityProvider.updatePassword({ uid: admin.uid, password: payload.new_password });
  }

  async createAdmin({ accessToken, payload }) {
    await this.ensureSuperAdmin(accessToken);
    if (await this.userRepository.getByEmail(payload.email)) {
      throw new ApplicationError({
        code: 'admin_already_exists',
        message: 'An account with this email already exists.',
        statusCode: 409,
      });
    }
    let identityUser = await this.identityProvider.getUserByEmail(payload.email);
    if (!identityUser) {
      identityUser = await this.identityProvider.createUser({
        email: payload.email,
        password: payload.password,
        displayName: payload.fullname,
      });
    }
    await this.identityProvider.markEmailVerified(identityUser.uid);
    const now = new Date();
    const record = {
      uid: identityUser.uid,
      fullname: payload.fullname,
      phone: payload.phone,
      email: payload.email,
      gender: 'unspecified',
      age: null,
      city: null,
      country: null,
      profileImageUrl: null,
      referralCode: null,
      referredByUid: null,
      referralBonusAwarded: false,
      role: 'admin',
      isVerified: true,
      isBlocked: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.userRepository.create(record);

    const credentialsEmailSent = await this.sendAdminCredentialsEmail({
      email: payload.email,
      password: payload.password,
    });

    return {
      ...adminResponse(record),
      credentialsEmailSent,
    };
  }

  async listAdmins({ accessToken, blockedOnly = false }) {
    await this.ensureSuperAdmin(accessToken);
    return (await this.userRepository.listByRole('admin', { blockedOnly })).map((record) => adminResponse(record));
  }

  async getAdmin({ accessToken, adminId }) {
    await this.ensureSuperAdmin(accessToken);
    return adminResponse(await this.getAdminByUid(adminId));
  }

  async updateAdmin({ accessToken, adminId, payload }) {
    await this.ensureSuperAdmin(accessToken);
    const admin = await this.getAdminByUid(adminId);
    const updated = await this.userRepository.updateFields(admin.uid, {
      fullname: payload.fullname,
      phone: payload.phone,
    });
    return adminResponse(updated);
  }

  async blockAdmin({ accessToken, adminId }) {
    await this.ensureSuperAdmin(accessToken);
    const admin = await this.getAdminByUid(adminId);
    const updated = await this.userRepository.setBlockStatus(admin.uid, { isBlocked: true });
    await this.identityProvider.setDisabled({ uid: admin.uid, disabled: true });
    return adminResponse(updated);
  }

  async unblockAdmin({ accessToken, adminId }) {
    await this.ensureSuperAdmin(accessToken);
    const admin = await this.getAdminByUid(adminId);
    const updated = await this.userRepository.setBlockStatus(admin.uid, { isBlocked: false });
    await this.identityProvider.setDisabled({ uid: admin.uid, disabled: false });
    return adminResponse(updated);
  }

  async getProfile({ accessToken }) {
    return adminResponse(await this.getCurrentAdmin(accessToken));
  }

  async updateProfile({ accessToken, payload }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const updated = await this.userRepository.updateFields(admin.uid, {
      fullname: payload.fullname,
      phone: payload.phone,
    });
    return adminResponse(updated);
  }

  async uploadProfileImage({ accessToken, image }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const stored = await this.imageStorage.uploadImage({
      folder: `admin_profiles/${admin.uid}`,
      file: image,
    });
    const updated = await this.userRepository.updateFields(admin.uid, {
      profile_image_url: stored.publicUrl,
    });
    if (!updated) {
      throw new ApplicationError({
        code: 'admin_not_found',
        message: 'No admin found for the provided credentials.',
        statusCode: 404,
      });
    }
    return adminResponse(updated);
  }

  async getDashboardSummary({ accessToken, dashboardRange, year = null, month = null }) {
    await this.getCurrentAdmin(accessToken);
    const now = new Date();
    const window = this.resolveDashboardWindow({ dashboardRange, now, year, month });

    const checkins = await this.safeList(() => this.checkinRepository.listAll());
    const pointsRecords = await this.safeList(() => this.xpService.listPointsRecords());
    const rewardRedemptions = await this.safeList(() => this.rewardRedemptionRepository.listAll());
    const activeUserRecords = (await this.userRepository.listByRole('user')).filter(
      (record) => record.isVerified && !record.isBlocked,
    );

    const filteredCheckins = checkins.filter(
      (record) => window.start <= record.createdAt && record.createdAt < window.end,
    );
    const filteredPoints = pointsRecords.filter(
      (record) => window.start <= record.createdAt && record.createdAt < window.end,
    );
    const filteredRedemptions = rewardRedemptions.filter((record) => {
      const timestamp = this.rewardRedemptionTimestamp(record);
      return record.status === 'redeemed' && window.start <= timestamp && timestamp < window.end;
    });

    const buckets = this.buildDashboardBuckets({ window });
    for (const record of filteredCheckins) {
      const bucket = buckets[this.bucketIndex(record.createdAt, window)];
      if (bucket) {
        bucket.checkIns += 1;
      }
    }
    for (const record of filteredPoints) {
      if (record.pointsDelta <= 0) {
        continue;
      }
      const bucket = buckets[this.bucketIndex(record.createdAt, window)];
      if (bucket) {
        bucket.pointsIssued += record.pointsDelta;
      }
    }

    return {
      range: dashboardRange,
      year,
      month,
      activeUsers: activeUserRecords.length,
      dailyCheckIns: filteredCheckins.length,
      pointsIssued: filteredPoints.reduce((sum, record) => sum + Math.max(record.pointsDelta, 0), 0),
      rewardsRedeemed: filteredRedemptions.length,
      activity: buckets.map((bucket) => ({
        label: bucket.label,
        checkIns: bucket.checkIns,
        pointsIssued: bucket.pointsIssued,
      })),
      topRestaurants: this.buildTopRestaurants(filteredCheckins),
      topUsers: this.buildTopUsers(filteredCheckins, filteredPoints, activeUserRecords),
      genderAnalysis: this.buildGenderAnalysis(activeUserRecords),
      ageAnalysis: this.buildAgeAnalysis(activeUserRecords),
    };
  }

  async listUsers({ accessToken, page, pageSize, filters, blockedOnly = false }) {
    await this.getCurrentAdmin(accessToken);
    let records = await this.userRepository.listByRole('user', { blockedOnly });
    records = this.filterUsers(records, { ...filters, blockedOnly });
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    const items = await Promise.all(records.slice(start, start + pageSize).map((record) => this.userResponse(record)));
    return {
      items,
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getUser({ accessToken, userId }) {
    await this.getCurrentAdmin(accessToken);
    return this.userResponse(await this.getUserByUid(userId));
  }

  async listUserCheckins({ accessToken, userId, page, pageSize }) {
    await this.getCurrentAdmin(accessToken);
    const user = await this.getUserByUid(userId);
    if (user.role !== 'user') {
      throw new ApplicationError({
        code: 'invalid_user_role',
        message: 'Only end users have check-in history in this view.',
        statusCode: 400,
      });
    }
    const records = await this.checkinRepository.listByUser(user.uid);
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(adminCheckinResponse),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async listUserPointsHistory({ accessToken, userId, page, pageSize }) {
    await this.getCurrentAdmin(accessToken);
    const user = await this.getUserByUid(userId);
    if (user.role !== 'user') {
      throw new ApplicationError({
        code: 'invalid_user_role',
        message: 'Only end users have points history in this view.',
        statusCode: 400,
      });
    }
    return this.xpService.getPointsHistory({ userId: user.uid, page, pageSize });
  }

  async adjustUserPoints({ accessToken, userId, payload }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const user = await this.getUserByUid(userId);
    if (user.role !== 'user') {
      throw new ApplicationError({
        code: 'invalid_user_role',
        message: 'Only end users can have their points adjusted through this endpoint.',
        statusCode: 400,
      });
    }
    const adjustment = await this.xpService.adjustPoints({
      userId: user.uid,
      delta: payload.pointsDelta,
      sourceId: `admin-adjustment:${admin.uid}:${crypto.randomUUID()}`,
      city: user.city ?? '',
      country: user.country ?? '',
    });
    if (!adjustment && payload.pointsDelta !== 0) {
      throw new ApplicationError({
        code: 'points_adjustment_not_applied',
        message: 'The requested points adjustment could not be applied.',
        statusCode: 400,
      });
    }
    return this.userResponse(user);
  }

  async blockUser({ accessToken, userId }) {
    await this.getCurrentAdmin(accessToken);
    const user = await this.getUserByUid(userId);
    if (user.role !== 'user') {
      throw new ApplicationError({
        code: 'invalid_user_role',
        message: 'Only end users can be blocked through this endpoint.',
        statusCode: 400,
      });
    }
    const updated = await this.userRepository.setBlockStatus(userId, { isBlocked: true });
    await this.identityProvider.setDisabled({ uid: userId, disabled: true });
    return this.userResponse(updated);
  }

  async unblockUser({ accessToken, userId }) {
    await this.getCurrentAdmin(accessToken);
    const user = await this.getUserByUid(userId);
    if (user.role !== 'user') {
      throw new ApplicationError({
        code: 'invalid_user_role',
        message: 'Only end users can be unblocked through this endpoint.',
        statusCode: 400,
      });
    }
    const updated = await this.userRepository.setBlockStatus(userId, { isBlocked: false });
    await this.identityProvider.setDisabled({ uid: userId, disabled: false });
    return this.userResponse(updated);
  }

  async issueOtp(email) {
    const otp = generateNumericOtp();
    const now = new Date();
    await this.otpRepository.save({
      documentId: crypto.randomUUID(),
      email,
      purpose: ADMIN_FORGOT_PASSWORD,
      otpHash: hashOtp(otp, this.config.otpSigningSecret),
      expiresAt: addMinutes(now, this.config.otpExpiryMinutes),
      resendAvailableAt: addSeconds(now, this.config.otpResendCooldownSeconds),
      attemptCount: 0,
      consumedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    this.emailService.sendOtp({ email, otp, purpose: ADMIN_FORGOT_PASSWORD });
  }

  async verifyOtp(email, otp) {
    const record = await this.otpRepository.getLatestActive(email, ADMIN_FORGOT_PASSWORD);
    if (!record || record.consumedAt) {
      throw new ApplicationError({ code: 'otp_not_found', message: 'No active OTP found.', statusCode: 404 });
    }
    if (record.expiresAt < new Date()) {
      throw new ApplicationError({ code: 'otp_expired', message: 'The OTP has expired.', statusCode: 400 });
    }
    if (record.attemptCount >= this.config.otpMaxAttempts) {
      throw new ApplicationError({
        code: 'otp_attempt_limit_exceeded',
        message: 'The OTP attempt limit has been reached.',
        statusCode: 429,
      });
    }
    if (hashOtp(otp, this.config.otpSigningSecret) !== record.otpHash) {
      await this.otpRepository.incrementAttempts(record.documentId);
      throw new ApplicationError({ code: 'otp_invalid', message: 'The provided OTP is invalid.', statusCode: 400 });
    }
    await this.otpRepository.consume(record.documentId);
  }

  async ensureResendAvailable(email) {
    const record = await this.otpRepository.getLatestActive(email, ADMIN_FORGOT_PASSWORD);
    if (record && !record.consumedAt && record.resendAvailableAt > new Date()) {
      throw new ApplicationError({
        code: 'otp_resend_cooldown',
        message: 'OTP resend is temporarily unavailable. Please wait before retrying.',
        statusCode: 429,
      });
    }
  }

  async sendAdminCredentialsEmail({ email, password }) {
    if (!this.emailService?.sendAdminCredentials) {
      return false;
    }

    try {
      await this.emailService.sendAdminCredentials({
        email,
        password,
        loginUrl: this.config.adminDashboardLoginUrl,
      });
      return true;
    } catch (error) {
      console.error('[admin-email] Failed to send admin credentials email', {
        email,
        error: error?.message ?? String(error),
      });
      return false;
    }
  }

  async getCurrentAdmin(accessToken) {
    const admin = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'admin_not_found',
      notFoundMessage: 'No admin or super admin account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    requireActiveRoles({
      record: admin,
      allowedRoles: new Set(['admin', 'super_admin']),
      roleErrorCode: 'admin_not_found',
      roleErrorMessage: 'No admin or super admin account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'admin_blocked',
      blockedErrorMessage: 'The admin account is blocked.',
    });
    return requireVerifiedAccount({
      record: admin,
      errorCode: 'admin_not_verified',
      errorMessage: 'The admin account is not verified.',
    });
  }

  async getAdminAccountByEmail(email) {
    const record = await this.userRepository.getByEmail(email);
    if (!record || !['admin', 'super_admin'].includes(record.role)) {
      throw new ApplicationError({
        code: 'admin_not_found',
        message: 'No admin or super admin account found for the provided email.',
        statusCode: 404,
      });
    }
    return record;
  }

  ensureActiveAdminAccount(record) {
    requireActiveRoles({
      record,
      allowedRoles: new Set(['admin', 'super_admin']),
      roleErrorCode: 'admin_not_found',
      roleErrorMessage: 'No admin or super admin account found for the provided email.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'admin_blocked',
      blockedErrorMessage: 'The admin account is blocked.',
    });
    requireVerifiedAccount({
      record,
      errorCode: 'admin_not_verified',
      errorMessage: 'The admin account is not verified.',
    });
  }

  async ensureSuperAdmin(accessToken) {
    const admin = await this.getCurrentAdmin(accessToken);
    if (admin.role !== 'super_admin') {
      throw new ApplicationError({
        code: 'super_admin_required',
        message: 'Only super admin accounts can perform this action.',
        statusCode: 403,
      });
    }
    return admin;
  }

  async getAdminByUid(uid) {
    const record = await this.userRepository.getByUid(uid);
    if (!record || record.role !== 'admin') {
      throw new ApplicationError({
        code: 'admin_not_found',
        message: 'No admin found for the provided identifier.',
        statusCode: 404,
      });
    }
    return record;
  }

  async getUserByUid(uid) {
    const record = await this.userRepository.getByUid(uid);
    if (!record) {
      throw new ApplicationError({
        code: 'user_not_found',
        message: 'No user found for the provided identifier.',
        statusCode: 404,
      });
    }
    return record;
  }

  filterUsers(records, { search, city, country, gender, isVerified, isBlocked, blockedOnly }) {
    let filtered = records;
    if (search) {
      const needle = search.trim().toLowerCase();
      filtered = filtered.filter(
        (record) =>
          record.fullname.toLowerCase().includes(needle) ||
          record.email.toLowerCase().includes(needle) ||
          (record.city ?? '').toLowerCase().includes(needle) ||
          (record.country ?? '').toLowerCase().includes(needle) ||
          (record.referralCode ?? '').toLowerCase().includes(needle),
      );
    }
    if (city) filtered = filtered.filter((record) => (record.city ?? '').toLowerCase() === city.trim().toLowerCase());
    if (country) filtered = filtered.filter((record) => (record.country ?? '').toLowerCase() === country.trim().toLowerCase());
    if (gender) filtered = filtered.filter((record) => record.gender.toLowerCase() === gender.trim().toLowerCase());
    if (isVerified !== null) filtered = filtered.filter((record) => record.isVerified === isVerified);
    if (isBlocked !== null) filtered = filtered.filter((record) => record.isBlocked === isBlocked);
    if (blockedOnly) filtered = filtered.filter((record) => record.isBlocked);
    return filtered;
  }

  async userResponse(record) {
    let currentPoints = 0;
    let totalCheckIns = 0;
    let redeemedRewards = 0;
    let totalStreakLogins = 0;
    try {
      currentPoints = await this.xpService.getTotalPoints(record.uid);
    } catch {}
    try {
      totalCheckIns = await this.checkinRepository.countByUser(record.uid);
    } catch {}
    try {
      redeemedRewards = await this.rewardRedemptionRepository.countByUser(record.uid);
    } catch {}
    try {
      totalStreakLogins = await this.loginEventRepository.countCurrentStreak(record.uid);
    } catch {}
    return adminResponse(record, { currentPoints, totalCheckIns, redeemedRewards, totalStreakLogins });
  }

  async safeList(loader) {
    try {
      return await loader();
    } catch {
      return [];
    }
  }

  resolveDashboardWindow({ dashboardRange, now, year, month }) {
    if (dashboardRange === 'last_24_hours') {
      return {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now,
        bucketKind: 'hour',
        dashboardRange,
      };
    }
    if (dashboardRange === 'last_7_days') {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6, 0, 0, 0, 0));
      return { start, end: now, bucketKind: 'day', dashboardRange };
    }
    if (dashboardRange === 'last_30_days') {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29, 0, 0, 0, 0));
      return { start, end: now, bucketKind: 'day', dashboardRange };
    }
    const selectedYear = year ?? now.getUTCFullYear();
    const selectedMonth = month ?? now.getUTCMonth() + 1;
    const start = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0));
    let end;
    if (selectedYear === now.getUTCFullYear() && selectedMonth === now.getUTCMonth() + 1) {
      end = now;
    } else {
      end = new Date(Date.UTC(selectedYear, selectedMonth, 0, 23, 59, 59, 999));
    }
    return { start, end, bucketKind: 'day', dashboardRange };
  }

  buildDashboardBuckets({ window }) {
    const buckets = [];
    const stepMs = window.bucketKind === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    let current = new Date(window.start);
    while (current < window.end) {
      const bucketEnd = new Date(Math.min(current.getTime() + stepMs, window.end.getTime()));
      buckets.push({
        start: new Date(current),
        end: bucketEnd,
        label: this.formatBucketLabel(current, window),
        checkIns: 0,
        pointsIssued: 0,
      });
      current = bucketEnd;
    }
    return buckets;
  }

  formatBucketLabel(value, window) {
    if (window.bucketKind === 'hour') {
      return value.toISOString().slice(11, 13) + ':00';
    }
    const date = value;
    if (window.dashboardRange === 'last_30_days') {
      return date.toLocaleString('en-US', { timeZone: 'UTC', day: '2-digit', month: 'short' });
    }
    if (window.dashboardRange === 'monthly') {
      return date.toLocaleString('en-US', { timeZone: 'UTC', day: '2-digit' });
    }
    return date.toLocaleString('en-US', { timeZone: 'UTC', weekday: 'short' });
  }

  bucketIndex(value, window) {
    if (window.bucketKind === 'hour') {
      return Math.max(0, Math.floor((value.getTime() - window.start.getTime()) / (60 * 60 * 1000)));
    }
    const startDay = Date.UTC(window.start.getUTCFullYear(), window.start.getUTCMonth(), window.start.getUTCDate());
    const valueDay = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
    return Math.max(0, Math.floor((valueDay - startDay) / (24 * 60 * 60 * 1000)));
  }

  rewardRedemptionTimestamp(record) {
    return record.usedAt ?? record.redeemedAt;
  }

  buildTopRestaurants(records) {
    const grouped = new Map();
    for (const record of records) {
      const current = grouped.get(record.restaurantId) ?? {
        restaurantId: record.restaurantId,
        restaurantName: record.restaurantName || 'Unknown Restaurant',
        checkIns: 0,
        pointsIssued: 0,
      };
      current.checkIns += 1;
      current.pointsIssued += Math.max(record.awardedPoints, 0);
      grouped.set(record.restaurantId, current);
    }
    return [...grouped.values()]
      .sort((a, b) =>
        b.checkIns - a.checkIns ||
        b.pointsIssued - a.pointsIssued ||
        a.restaurantName.toLowerCase().localeCompare(b.restaurantName.toLowerCase()),
      )
      .slice(0, 5);
  }

  buildTopUsers(checkinRecords, pointsRecords, activeUserRecords) {
    const checkinsByUser = new Map();
    for (const record of checkinRecords) {
      checkinsByUser.set(record.userId, (checkinsByUser.get(record.userId) ?? 0) + 1);
    }
    const pointsByUser = new Map();
    for (const record of pointsRecords) {
      pointsByUser.set(record.userId, (pointsByUser.get(record.userId) ?? 0) + record.pointsDelta);
    }
    const ranked = [];
    for (const user of activeUserRecords) {
      const currentPoints = pointsByUser.get(user.uid) ?? 0;
      const totalCheckIns = checkinsByUser.get(user.uid) ?? 0;
      if (currentPoints === 0 && totalCheckIns === 0) {
        continue;
      }
      ranked.push({
        uid: user.uid,
        fullname: user.fullname,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
        currentPoints,
        totalCheckIns,
      });
    }
    ranked.sort((a, b) =>
      b.currentPoints - a.currentPoints ||
      b.totalCheckIns - a.totalCheckIns ||
      a.fullname.toLowerCase().localeCompare(b.fullname.toLowerCase()) ||
      a.uid.localeCompare(b.uid),
    );
    return ranked.slice(0, 5).map((item, index) => ({ rank: index + 1, ...item }));
  }

  buildGenderAnalysis(activeUserRecords) {
    const buckets = [
      { label: 'Male', count: 0 },
      { label: 'Female', count: 0 },
      { label: 'Unspecified', count: 0 },
      { label: 'Other', count: 0 },
    ];

    for (const user of activeUserRecords) {
      const normalized = String(user.gender ?? '').trim().toLowerCase();
      if (normalized === 'male') {
        buckets[0].count += 1;
      } else if (normalized === 'female') {
        buckets[1].count += 1;
      } else if (!normalized || normalized === 'unspecified') {
        buckets[2].count += 1;
      } else {
        buckets[3].count += 1;
      }
    }

    return this.attachPercentages(buckets, activeUserRecords.length);
  }

  buildAgeAnalysis(activeUserRecords) {
    const buckets = [
      { label: 'Child', minAge: 0, maxAge: 12, count: 0 },
      { label: 'Teenage', minAge: 13, maxAge: 17, count: 0 },
      { label: 'Young Man', minAge: 18, maxAge: 24, count: 0 },
      { label: 'Middle Age Man', minAge: 25, maxAge: 44, count: 0 },
      { label: 'Older Man', minAge: 45, maxAge: null, count: 0 },
    ];

    for (const user of activeUserRecords) {
      const age = Number(user.age);
      if (!Number.isFinite(age) || age < 0) {
        continue;
      }
      if (age <= 12) {
        buckets[0].count += 1;
      } else if (age <= 17) {
        buckets[1].count += 1;
      } else if (age <= 24) {
        buckets[2].count += 1;
      } else if (age <= 44) {
        buckets[3].count += 1;
      } else {
        buckets[4].count += 1;
      }
    }

    return this.attachPercentages(buckets, activeUserRecords.length);
  }

  attachPercentages(items, total) {
    return items.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.count / total) * 10000) / 100 : 0,
    }));
  }
}
