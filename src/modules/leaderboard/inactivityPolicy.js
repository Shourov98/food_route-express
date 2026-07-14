// BR-008: Inactive-user policy.
//
// This module is the single source of truth for "is this user active for
// ranking purposes" and the seam where future configurable point-expiration
// can be added without touching the leaderboard aggregation logic.
//
// MVP rules (per BR-008 Phase 1 / implementation note for India team):
//   1. Wallet Points do NOT expire.
//   2. User history (xp_ledger, points_ledger rows) is preserved.
//   3. A user appears in active rankings only if they had valid activity
//      in that period (or any positive earned XP for all_time).
//   4. The system should be prepared for future configurable expiration —
//      represented here by `pointsExpiryDays` which is `null` in MVP.
//
// "Activity" for ranking purposes means a positive sum of earned XP
// (xp_ledger rows whose sourceType is in EARNING_SOURCE_TYPES) within the
// requested period window — or any positive lifetime earned XP for
// all_time. This is intentionally derived from the ledger (no separate
// last_active_at field is required) so the rule can never drift from
// actual user behaviour.

import { EARNING_SOURCE_TYPES } from './rankingPolicy.js';

export const INACTIVITY_CONFIG_DEFAULTS = Object.freeze({
  // When true, the leaderboard drops users with no activity in the period.
  // MVP default: ON (BR-008 Rule 3).
  rankFilterEnabled: true,
  // Number of days of inactivity after which points could expire. Phase 2
  // feature — left null in MVP. When set to a positive integer, a future
  // scheduled job can call `shouldExpirePoints(lastActivityAt, config)` to
  // decide whether to write compensating negative rows.
  pointsExpiryDays: null,
});

const DEFAULT_POINTS_EXPIRY_DAYS = null;

export function loadInactivityConfig(env = process.env) {
  const rawEnabled = env?.RANK_FILTER_ENABLED;
  const rawDays = env?.POINTS_EXPIRY_DAYS;
  const enabled = rawEnabled === undefined || rawEnabled === null || rawEnabled === ''
    ? INACTIVITY_CONFIG_DEFAULTS.rankFilterEnabled
    : ['1', 'true', 'yes', 'on'].includes(String(rawEnabled).toLowerCase());
  const days = rawDays === undefined || rawDays === null || rawDays === ''
    ? DEFAULT_POINTS_EXPIRY_DAYS
    : Number(rawDays);
  return {
    rankFilterEnabled: enabled,
    pointsExpiryDays: Number.isFinite(days) && days > 0 ? days : null,
  };
}

/**
 * Decide whether a row should appear in the leaderboard.
 *
 * @param {{ currentXp: number, currentPoints: number, latestActivityAt: Date | null }} row
 * @param {{ rankFilterEnabled: boolean }} [config] - defaults to INACTIVITY_CONFIG_DEFAULTS
 * @returns {boolean} true if the user should appear in active rankings
 */
export function isUserActiveForRanking(row, config = INACTIVITY_CONFIG_DEFAULTS) {
  if (!config || config.rankFilterEnabled === false) {
    return true;
  }
  // Per BR-008 Rule 3: a user appears only if they have valid activity. For
  // any period (weekly/monthly/all_time) `currentXp > 0` after the service
  // has already applied the period cutoff — so this single check is correct
  // for all three periods. Wallet points are intentionally not consulted;
  // they can include signup bonuses and reward redemptions which do not
  // count as "earned" activity.
  return Number.isFinite(row?.currentXp) && row.currentXp > 0;
}

/**
 * Future-facing helper for Phase 2. Returns true if a user's last activity
 * is older than the configured expiry window. NOT used in MVP — included
 * here so the seam is in place.
 */
export function shouldExpirePoints(lastActivityAt, config = INACTIVITY_CONFIG_DEFAULTS) {
  if (!config || !Number.isFinite(config.pointsExpiryDays) || config.pointsExpiryDays <= 0) {
    return false;
  }
  if (!lastActivityAt) {
    return true;
  }
  const ageMs = Date.now() - new Date(lastActivityAt).getTime();
  const windowMs = config.pointsExpiryDays * 24 * 60 * 60 * 1000;
  return ageMs > windowMs;
}

export const INACTIVITY_DESCRIPTION =
  'BR-008 Inactive-User Policy: wallet points do not expire in MVP; user ' +
  'history is preserved; a user appears in active rankings only if they had ' +
  'valid earned XP in the requested period. The policy module is the seam ' +
  'where future configurable point expiration will be enforced.';