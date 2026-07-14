// BR-007: Positive sourceType allowlist used by ranking reads.
//
// Ranking must be based on earned XP only. The historical implementation
// used a denylist (`sourceType !== 'admin_adjustment'`) which silently
// subtracted any future negative `xpDelta` (e.g. a clawback feature).
//
// This module is the single source of truth for which `xp_ledger` source
// types count toward ranking. New earning flows must explicitly opt-in by
// adding their sourceType here; anything else is ignored.
//
// Notes:
// - Redemptions write to `points_ledger` only — they never touch
//   `xp_ledger`, so they cannot affect ranking regardless of this allowlist.
//   This allowlist is defense-in-depth, not the primary isolation.
// - `admin_adjustment` is intentionally excluded (manual corrections are
//   not "earned" XP).

export const EARNING_SOURCE_TYPES = new Set([
  'check_in',
  'receipt_upload',
  'route_receipt_upload',
  'route_completion',
  'challenge_completion',
  'daily_reward_spin',
  'social_share',
]);

export function isEarningSourceType(sourceType) {
  return EARNING_SOURCE_TYPES.has(sourceType);
}

export const RANKING_DESCRIPTION =
  'Weekly/Monthly/All-Time ranking is computed from earned XP recorded in ' +
  'xp_ledger. Only the source types in EARNING_SOURCE_TYPES count toward ' +
  'ranking; everything else (admin_adjustment, future clawbacks, or any ' +
  'unknown sourceType) is ignored. Wallet balance (points_ledger) is never ' +
  'used for ranking, so reward redemptions cannot reduce a user\'s rank.';