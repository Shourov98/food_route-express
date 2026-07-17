function toDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate();
  }

  return new Date(value);
}

function toUtcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function userFromDoc(doc) {
  if (!doc.exists) {
    return null;
  }

  const data = doc.data();
  const uid = data.uid ?? data.id ?? doc.id;

  return {
    uid,
    fullname: data.fullname ?? data.fullName ?? 'Unknown User',
    phone: data.phone ?? null,
    email: data.email,
    gender: data.gender ?? 'unspecified',
    age: data.age ?? null,
    dateOfBirth: data.date_of_birth ?? data.dateOfBirth ?? null,
    city: data.city ?? data.cityName ?? null,
    country: data.country ?? data.countryName ?? null,
    profileImageUrl: data.profile_image_url ?? data.profileImageUrl ?? null,
    referralCode: data.referral_code ?? data.referralCode ?? null,
    referredByUid: data.referred_by_uid ?? data.referredByUid ?? null,
    referralBonusAwarded: data.referral_bonus_awarded ?? data.referralBonusAwarded ?? false,
    role: data.role ?? 'user',
    isVerified: data.is_verified ?? data.isVerified ?? false,
    isBlocked: data.is_blocked ?? data.isBlocked ?? false,
    createdAt: toDate(data.created_at ?? data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updated_at ?? data.updatedAt) ?? new Date(),
    proximityDistanceKm: data.proximity_distance_km ?? data.proximityDistanceKm ?? null,
    lastKnownLatitude: data.last_known_latitude ?? data.lastKnownLatitude ?? null,
    lastKnownLongitude: data.last_known_longitude ?? data.lastKnownLongitude ?? null,
    proximityAlertsEnabled:
      data.proximity_alerts_enabled ?? data.proximityAlertsEnabled ?? false,
    pushNotificationToken: data.push_notification_token ?? data.pushNotificationToken ?? null,
    pushNotificationPlatform:
      data.push_notification_platform ?? data.pushNotificationPlatform ?? null,
    pushNotificationProvider:
      data.push_notification_provider ?? data.pushNotificationProvider ?? null,
    pushNotificationTokenUpdatedAt:
      toDate(data.push_notification_token_updated_at ?? data.pushNotificationTokenUpdatedAt) ??
      null,
  };
}

function otpFromDoc(doc) {
  if (!doc.exists) {
    return null;
  }

  const data = doc.data();
  return {
    documentId: doc.id,
    email: data.email,
    purpose: data.purpose,
    otpHash: data.otp_hash ?? data.otpHash,
    expiresAt: toDate(data.expires_at ?? data.expiresAt),
    resendAvailableAt: toDate(data.resend_available_at ?? data.resendAvailableAt),
    attemptCount: data.attempt_count ?? data.attemptCount ?? 0,
    consumedAt: toDate(data.consumed_at ?? data.consumedAt),
    createdAt: toDate(data.created_at ?? data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updated_at ?? data.updatedAt) ?? new Date(),
  };
}

export class FirestoreUserRepository {
  constructor(firestore) {
    this.collection = firestore.collection('users');
  }

  async create(record) {
    await this.collection.doc(record.uid).set({
      uid: record.uid,
      fullname: record.fullname,
      phone: record.phone,
      email: record.email,
      gender: record.gender,
      age: record.age,
      date_of_birth: record.dateOfBirth ?? null,
      city: record.city,
      country: record.country,
      profile_image_url: record.profileImageUrl,
      referral_code: record.referralCode,
      referred_by_uid: record.referredByUid,
      referral_bonus_awarded: record.referralBonusAwarded,
      role: record.role,
      is_verified: record.isVerified,
      is_blocked: record.isBlocked,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      proximity_distance_km: record.proximityDistanceKm ?? null,
      last_known_latitude: record.lastKnownLatitude ?? null,
      last_known_longitude: record.lastKnownLongitude ?? null,
      proximity_alerts_enabled: record.proximityAlertsEnabled ?? false,
      push_notification_token: record.pushNotificationToken ?? null,
      push_notification_platform: record.pushNotificationPlatform ?? null,
      push_notification_provider: record.pushNotificationProvider ?? null,
      push_notification_token_updated_at: record.pushNotificationTokenUpdatedAt ?? null,
    });
    return record;
  }

  async getByEmail(email) {
    const snapshot = await this.collection.where('email', '==', email).limit(1).get();
    if (snapshot.empty) {
      return null;
    }
    return userFromDoc(snapshot.docs[0]);
  }

  async getByUid(uid) {
    return userFromDoc(await this.collection.doc(uid).get());
  }

  async getByReferralCode(referralCode) {
    const snapshot = await this.collection.where('referral_code', '==', referralCode).limit(1).get();
    if (snapshot.empty) {
      return null;
    }
    return userFromDoc(snapshot.docs[0]);
  }

  async listByReferredByUid(referrerUid) {
    const snapshot = await this.collection.where('referred_by_uid', '==', referrerUid).get();
    return snapshot.docs
      .map(userFromDoc)
      .filter(Boolean)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async listByRole(role, { blockedOnly = false } = {}) {
    let query = this.collection.where('role', '==', role);
    if (blockedOnly) {
      query = query.where('is_blocked', '==', true);
    }
    const snapshot = await query.get();
    return snapshot.docs.map(userFromDoc).filter(Boolean);
  }

  async countVerifiedReferrals(referrerUid) {
    const snapshot = await this.collection
      .where('referred_by_uid', '==', referrerUid)
      .where('is_verified', '==', true)
      .get();
    return snapshot.size;
  }

  async markVerified(email) {
    const snapshot = await this.collection.where('email', '==', email).limit(1).get();
    if (snapshot.empty) {
      return;
    }
    await snapshot.docs[0].ref.update({ is_verified: true, updated_at: new Date() });
  }

  async updateFields(uid, fields) {
    const ref = this.collection.doc(uid);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.update({ ...fields, updated_at: new Date() });
    return userFromDoc(await ref.get());
  }

  async setBlockStatus(uid, { isBlocked }) {
    const ref = this.collection.doc(uid);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.update({ is_blocked: isBlocked, updated_at: new Date() });
    return userFromDoc(await ref.get());
  }
}

export class FirestoreOtpRepository {
  constructor(firestore) {
    this.collection = firestore.collection('otps');
  }

  async save(record) {
    await this.collection.doc(record.documentId).set({
      email: record.email,
      purpose: record.purpose,
      otp_hash: record.otpHash,
      expires_at: record.expiresAt,
      resend_available_at: record.resendAvailableAt,
      attempt_count: record.attemptCount,
      consumed_at: record.consumedAt,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    });
    return record;
  }

  async getLatestActive(email, purpose) {
    const snapshot = await this.collection.where('email', '==', email).where('purpose', '==', purpose).get();
    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs
      .map(otpFromDoc)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
  }

  async incrementAttempts(documentId) {
    const ref = this.collection.doc(documentId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return;
    }
    const current = snapshot.data().attempt_count ?? snapshot.data().attemptCount ?? 0;
    await ref.update({ attempt_count: current + 1, updated_at: new Date() });
  }

  async consume(documentId) {
    await this.collection.doc(documentId).update({
      consumed_at: new Date(),
      updated_at: new Date(),
    });
  }
}

export class FirestoreLoginEventRepository {
  constructor(firestore) {
    this.collection = firestore.collection('login_events');
  }

  async create(record) {
    await this.collection.doc(record.id).set({
      id: record.id,
      userId: record.userId,
      createdAt: record.createdAt,
    });
    return record;
  }

  async listByUser(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = toDate(data.createdAt) ?? new Date();
      return {
        id: data.id,
        userId: data.userId,
        createdAt,
      };
    });
  }

  // Filters in-memory rather than via a composite `where(userId) + where(createdAt)`
  // query, which would require a manual Firestore index. Per-user row counts
  // are tiny (a few dozen a month at most), so the fetch is cheap.
  async findByUserOnUtcDay(userId, utcDay) {
    const records = await this.listByUser(userId);
    return records.find((record) => toUtcDayKey(record.createdAt) === utcDay) || null;
  }

  async countCurrentStreak(userId) {
    const records = await this.listByUser(userId);
    const uniqueDates = [...new Set(records.map((record) => toUtcDayKey(record.createdAt)))]
      .sort()
      .reverse();
    if (uniqueDates.length === 0) {
      return 0;
    }

    // Streak is only "active" if the most recent login was today or yesterday
    // in UTC. Anything older means the chain is broken and the user must log
    // in again to start a new streak. Without this guard the function would
    // happily report a stale streak as if it were still alive.
    const todayUtc = toUtcDayKey(new Date());
    const todayMs = new Date(`${todayUtc}T00:00:00.000Z`).getTime();
    const latestMs = new Date(`${uniqueDates[0]}T00:00:00.000Z`).getTime();
    const daysSinceLatest = Math.round((todayMs - latestMs) / 86_400_000);
    if (daysSinceLatest > 1) {
      return 0;
    }

    let streak = 1;
    let current = new Date(`${uniqueDates[0]}T00:00:00.000Z`);
    for (const dateString of uniqueDates.slice(1)) {
      const candidate = new Date(`${dateString}T00:00:00.000Z`);
      const diffDays = Math.round((current.getTime() - candidate.getTime()) / 86_400_000);
      if (diffDays !== 1) {
        break;
      }
      streak += 1;
      current = candidate;
    }
    return streak;
  }
}
