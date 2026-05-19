import crypto from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';
import { generateNumericOtp, generateReferralCode, hashOtp } from '../../core/security.js';

const OTP_PURPOSE = {
  REGISTER_VERIFY: 'register_verify',
  FORGOT_PASSWORD: 'forgot_password',
};

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1_000);
}

function calculateAge(dateOfBirth, now = new Date()) {
  const birthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const hasHadBirthday =
    now.getUTCMonth() > birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() >= birthDate.getUTCDate());

  if (!hasHadBirthday) {
    age -= 1;
  }

  return Math.max(age, 0);
}

function registerResponseData(user) {
  return {
    uid: user.uid,
    email: user.email,
    fullname: user.fullname,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth ?? null,
    city: user.city,
    country: user.country,
    referralCode: user.referralCode ?? '',
    role: user.role,
    is_verified: user.isVerified,
  };
}

function verifyOtpResponseData(email, isVerified) {
  return { email, is_verified: isVerified };
}

function loginResponseData(user, signInResult) {
  return {
    uid: user.uid,
    email: user.email,
    role: user.role,
    is_verified: user.isVerified,
    access_token: signInResult.idToken,
    refresh_token: signInResult.refreshToken,
    expires_in: signInResult.expiresIn,
  };
}

export class AuthService {
  constructor({
    userRepository,
    otpRepository,
    loginEventRepository,
    identityProvider,
    emailService,
    xpService,
    config,
  }) {
    this.userRepository = userRepository;
    this.otpRepository = otpRepository;
    this.loginEventRepository = loginEventRepository;
    this.identityProvider = identityProvider;
    this.emailService = emailService;
    this.xpService = xpService;
    this.config = config;
  }

  async register(payload) {
    return this.registerInternal(payload, null);
  }

  async registerWithReferral(payload) {
    const referrer = await this.userRepository.getByReferralCode(payload.referralCode);
    if (!referrer) {
      throw new ApplicationError({
        code: 'referral_code_not_found',
        message: 'No user found for the provided referral code.',
        statusCode: 404,
      });
    }

    return this.registerInternal(payload, referrer.uid);
  }

  async registerInternal(payload, referredByUid) {
    const existingUser = await this.userRepository.getByEmail(payload.email);
    if (existingUser) {
      throw new ApplicationError({
        code: 'user_already_exists',
        message: 'A user with this email already exists.',
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

    const now = new Date();
    const referralCode = generateReferralCode((code) => false);
    const user = {
      uid: identityUser.uid,
      fullname: payload.fullname,
      phone: null,
      email: payload.email,
      gender: payload.gender,
      age: calculateAge(payload.dateOfBirth, now),
      dateOfBirth: payload.dateOfBirth,
      city: payload.city,
      country: payload.country,
      profileImageUrl: null,
      referralCode,
      referredByUid,
      referralBonusAwarded: false,
      role: 'user',
      isVerified: false,
      isBlocked: false,
      proximityDistanceKm: 0.3,
      proximityAlertsEnabled: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.userRepository.create(user);
    if (this.config.authVerificationMode === 'email_link') {
      await this.sendVerificationEmail(payload.email);
    } else {
      await this.issueOtp(payload.email, OTP_PURPOSE.REGISTER_VERIFY);
    }
    await this.applySignupBonusIfEligible(user.uid);

    return registerResponseData(user);
  }

  async applySignupBonusIfEligible(userUid) {
    if (!this.xpService) {
      return null;
    }

    const user = await this.userRepository.getByUid(userUid);
    if (!user) {
      return null;
    }

    return this.xpService.awardPoints({
      userId: user.uid,
      delta: 100,
      sourceType: 'signup_bonus',
      sourceId: `signup-bonus-${user.uid}`,
      city: user.city ?? '',
      country: user.country ?? '',
    });
  }

  async resendRegisterOtp(email) {
    if (this.config.authVerificationMode === 'email_link') {
      await this.sendVerificationEmail(email);
      return;
    }

    const user = await this.userRepository.getByEmail(email);
    if (!user) {
      throw new ApplicationError({
        code: 'user_not_found',
        message: 'No user found for the provided email.',
        statusCode: 404,
      });
    }
    if (user.isVerified) {
      throw new ApplicationError({
        code: 'user_already_verified',
        message: 'The user is already verified.',
        statusCode: 409,
      });
    }

    await this.ensureResendAvailable(email, OTP_PURPOSE.REGISTER_VERIFY);
    await this.issueOtp(email, OTP_PURPOSE.REGISTER_VERIFY);
  }

  async verifyRegisterOtp(payload) {
    if (this.config.authVerificationMode === 'email_link') {
      throw new ApplicationError({
        code: 'verification_mode_email_link',
        message:
          'Email-link verification is enabled. Complete verification from the email link instead of the OTP endpoint.',
        statusCode: 400,
      });
    }

    const user = await this.userRepository.getByEmail(payload.email);
    if (!user) {
      throw new ApplicationError({
        code: 'user_not_found',
        message: 'No user found for the provided email.',
        statusCode: 404,
      });
    }
    if (user.isVerified) {
      return verifyOtpResponseData(user.email, true);
    }

    await this.verifyOtp(payload.email, payload.otp, OTP_PURPOSE.REGISTER_VERIFY, 'No active verification OTP found.');
    await this.userRepository.markVerified(payload.email);
    await this.identityProvider.markEmailVerified(user.uid);
    return verifyOtpResponseData(payload.email, true);
  }

  async login(payload) {
    const user = await this.getUserOrRaise(payload.email);
    this.ensureUserCanAuthenticate(user);

    const signInResult = await this.identityProvider.signIn({
      email: payload.email,
      password: payload.password,
    });
    await this.loginEventRepository.create({
      id: crypto.randomUUID(),
      userId: user.uid,
      createdAt: new Date(),
    });

    return loginResponseData(user, signInResult);
  }

  async refreshSession(refreshToken) {
    const signInResult = await this.identityProvider.refreshSession(refreshToken);
    const identityUser = await this.identityProvider.verifyIdToken(signInResult.idToken);
    const user = await this.userRepository.getByUid(identityUser.uid);
    if (!user) {
      throw new ApplicationError({
        code: 'user_not_found',
        message: 'No user found for the provided credentials.',
        statusCode: 404,
      });
    }
    this.ensureUserCanAuthenticate(user);
    return loginResponseData(user, signInResult);
  }

  async forgotPassword(email) {
    const user = await this.getUserOrRaise(email);
    this.ensureUserCanAuthenticate(user);
    if (this.config.authPasswordResetMode === 'email_link') {
      await this.sendPasswordResetEmail(email);
      return;
    }
    await this.ensureResendAvailable(email, OTP_PURPOSE.FORGOT_PASSWORD);
    await this.issueOtp(email, OTP_PURPOSE.FORGOT_PASSWORD);
  }

  async resendForgotPasswordOtp(email) {
    await this.forgotPassword(email);
  }

  async verifyForgotPasswordOtp(payload) {
    if (this.config.authPasswordResetMode === 'email_link') {
      throw new ApplicationError({
        code: 'password_reset_mode_email_link',
        message:
          'Password-reset email links are enabled. Complete the reset from the email link instead of the OTP endpoint.',
        statusCode: 400,
      });
    }
    const user = await this.getUserOrRaise(payload.email);
    this.ensureUserCanAuthenticate(user);
    await this.verifyOtp(payload.email, payload.otp, OTP_PURPOSE.FORGOT_PASSWORD, 'No active OTP found.');
    return verifyOtpResponseData(payload.email, true);
  }

  async sendVerificationEmail(email) {
    const user = await this.getUserOrRaise(email);
    if (user.isVerified) {
      throw new ApplicationError({
        code: 'user_already_verified',
        message: 'The user is already verified.',
        statusCode: 409,
      });
    }
    const link = await this.identityProvider.generateEmailVerificationLink(email);
    await this.emailService.sendVerificationLink({ email, link });
  }

  async sendPasswordResetEmail(email) {
    const user = await this.getUserOrRaise(email);
    this.ensureUserCanAuthenticate(user);
    const link = await this.identityProvider.generatePasswordResetLink(email);
    await this.emailService.sendPasswordResetLink({ email, link });
  }

  async changePassword(accessToken, payload) {
    const identityUser = await this.identityProvider.verifyIdToken(accessToken);
    const user = await this.getUserOrRaise(identityUser.email);
    this.ensureUserCanAuthenticate(user);

    if (payload.current_password === payload.new_password) {
      throw new ApplicationError({
        code: 'password_unchanged',
        message: 'The new password must be different from the current password.',
        statusCode: 400,
      });
    }

    await this.identityProvider.signIn({
      email: identityUser.email,
      password: payload.current_password,
    });
    await this.identityProvider.updatePassword({
      uid: identityUser.uid,
      password: payload.new_password,
    });
  }

  async issueOtp(email, purpose) {
    const otp = generateNumericOtp();
    const now = new Date();
    await this.otpRepository.save({
      documentId: crypto.randomUUID(),
      email,
      purpose,
      otpHash: hashOtp(otp, this.config.otpSigningSecret),
      expiresAt: addMinutes(now, this.config.otpExpiryMinutes),
      resendAvailableAt: addSeconds(now, this.config.otpResendCooldownSeconds),
      attemptCount: 0,
      consumedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await this.emailService.sendOtp({ email, otp, purpose });
  }

  async verifyOtp(email, otp, purpose, notFoundMessage) {
    const activeOtp = await this.otpRepository.getLatestActive(email, purpose);
    if (!activeOtp || activeOtp.consumedAt) {
      throw new ApplicationError({
        code: 'otp_not_found',
        message: notFoundMessage,
        statusCode: 404,
      });
    }

    const now = new Date();
    if (activeOtp.expiresAt < now) {
      throw new ApplicationError({
        code: 'otp_expired',
        message: 'The OTP has expired.',
        statusCode: 400,
      });
    }
    if (activeOtp.attemptCount >= this.config.otpMaxAttempts) {
      throw new ApplicationError({
        code: 'otp_attempt_limit_exceeded',
        message: 'The OTP attempt limit has been reached.',
        statusCode: 429,
      });
    }
    if (hashOtp(otp, this.config.otpSigningSecret) !== activeOtp.otpHash) {
      await this.otpRepository.incrementAttempts(activeOtp.documentId);
      throw new ApplicationError({
        code: 'otp_invalid',
        message: 'The provided OTP is invalid.',
        statusCode: 400,
      });
    }

    await this.otpRepository.consume(activeOtp.documentId);
  }

  async ensureResendAvailable(email, purpose) {
    const activeOtp = await this.otpRepository.getLatestActive(email, purpose);
    if (activeOtp && !activeOtp.consumedAt && activeOtp.resendAvailableAt > new Date()) {
      throw new ApplicationError({
        code: 'otp_resend_cooldown',
        message: 'OTP resend is temporarily unavailable. Please wait before retrying.',
        statusCode: 429,
      });
    }
  }

  async getUserOrRaise(email) {
    const user = await this.userRepository.getByEmail(email);
    if (!user) {
      throw new ApplicationError({
        code: 'user_not_found',
        message: 'No user found for the provided email.',
        statusCode: 404,
      });
    }
    return user;
  }

  ensureUserCanAuthenticate(user) {
    if (user.isBlocked) {
      throw new ApplicationError({
        code: 'user_blocked',
        message: 'The user account is blocked.',
        statusCode: 403,
      });
    }
    if (!user.isVerified) {
      throw new ApplicationError({
        code: 'user_not_verified',
        message: 'The user account is not verified yet.',
        statusCode: 403,
      });
    }
  }

  getRegistrationDeliveryMessage() {
    if (this.config.authVerificationMode === 'email_link') {
      return 'Registration successful. A verification email link has been sent to the email address.';
    }
    return 'Registration successful. A verification OTP has been sent to the email address.';
  }

  getVerificationResendMessage() {
    if (this.config.authVerificationMode === 'email_link') {
      return 'A new verification email link has been sent.';
    }
    return 'A new verification OTP has been sent.';
  }

  getPasswordResetDeliveryMessage() {
    if (this.config.authPasswordResetMode === 'email_link') {
      return 'A password reset email link has been sent.';
    }
    return 'A forgot-password OTP has been sent.';
  }

  getPasswordResetResendMessage() {
    if (this.config.authPasswordResetMode === 'email_link') {
      return 'A new password reset email link has been sent.';
    }
    return 'A new forgot-password OTP has been sent.';
  }
}
