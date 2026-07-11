# Food Route — Backend Remediation Plan

**Version:** 1.0
**Created:** 2026-07-06
**Scope:** Bring `/functions` backend into compliance with the Business Rules & MVP Acceptance Criteria v1.0 (June 29, 2026)
**Approach:** Sequential phases — data-model first, then user-facing flows, then auxiliary modules, then QA/docs.

---

## Table of Contents

1. [How to Read This Plan](#how-to-read-this-plan)
2. [Phase 1 — Data Model Foundation](#phase-1--data-model-foundation)
3. [Phase 2 — User-Facing Critical Flows](#phase-2--user-facing-critical-flows)
4. [Phase 3 — Routes / Challenges](#phase-3--routes--challenges)
5. [Phase 4 — Rankings & Location](#phase-4--rankings--location)
6. [Phase 5 — Auth & Security](#phase-5--auth--security)
7. [Phase 6 — Admin & Operational Tasks](#phase-6--admin--operational-tasks)
8. [Phase 7 — QA & Documentation](#phase-7--qa--documentation)
9. [Sprint Layout](#sprint-layout)
10. [Acceptance Criteria Checklist](#acceptance-criteria-checklist)
11. [Risk Register](#risk-register)

---

## How to Read This Plan

Each task has:

- **Goal** — what we are delivering
- **Why** — which Business Rule (BR) is violated
- **Files Touched** — paths in `/functions/src/`
- **Steps** — concrete ordered actions
- **Acceptance Criteria** — verifiable outcome
- **Owner Hint** — suggested role
- **Estimate** — relative size

Tasks are grouped by phase. A task depends only on tasks in earlier phases (unless explicitly noted).

---

## Phase 1 — Data Model Foundation

> **Why this phase first:** Every critical flow (check-in, spin, redemption, route) writes to the points ledger and/or relies on idempotency. Until the ledger is split into Wallet vs Ranking and supports transactions, we cannot safely fix the flows. The transaction/idempotency helper is reused everywhere downstream.

---

### Task 1.1 — Split Wallet vs Ranking balance

- **Goal:** Introduce two distinct balances per user: **Wallet Points** (redeemable) and **Ranking Points** (earned, never decreases).
- **Why:** BR-001 — current combined ledger makes Wallet-only deduction impossible; ranking cannot use earned-only.
- **Files Touched:**
  - `src/modules/xp/xpRepository.js`
  - `src/modules/xp/xpService.js`
  - `src/modules/users/userService.js`
  - `src/modules/users/userRepository.js`
- **Steps:**
  1. Add `balanceType: 'wallet' | 'ranking'` field to ledger entries (default `'wallet'` for backward compatibility).
  2. Update `xpRepository.create()` to accept and persist `balanceType`.
  3. Add `xpService.getWalletPoints(userId)` and `getRankingPoints(userId)` derived from ledger sum filtered by `balanceType`.
  4. Update `xpService.awardPoints()` to write TWO ledger entries (one wallet, one ranking) for any positive event.
  5. Update `xpService.adjustPoints()` to write only `'wallet'` entries.
  6. Backfill script (`scripts/migrateLedgerBalanceType.js`):
     - For every existing ledger entry with `delta > 0`: also create mirror entry with same delta, `balanceType: 'ranking'` if not present.
     - For every existing entry with `delta < 0`: ensure `balanceType: 'wallet'`.
  7. Cache: store `user.walletPoints` and `user.rankingPoints` as authoritative denormalized fields; recompute on every ledger write inside the same transaction.
- **Acceptance Criteria:**
  - `getWalletPoints(u)` ≠ `getRankingPoints(u)` after a redemption.
  - A redemption writes exactly one ledger entry with `balanceType: 'wallet'` and `delta < 0`.
  - A check-in writes two ledger entries: one wallet +∞, one ranking +∞.
  - All existing entries have a `balanceType`.
- **Owner Hint:** Backend lead + 1 dev
- **Estimate:** L (3–5 days)

---

### Task 1.2 — Add before/after balance + immutable fields

- **Goal:** Every ledger entry stores `balanceBefore`, `balanceAfter`, `status`, `timestamp`.
- **Why:** BR-002 — required for audit/replay; frontend must never calculate balance.
- **Files Touched:**
  - `src/modules/xp/xpRepository.js`
  - `src/modules/xp/xpService.js`
  - `src/shared/schemas/ledgerRecord.js` (new)
- **Steps:**
  1. Define schema: `{ id, userId, eventId, type, balanceType, balanceBefore, delta, balanceAfter, source, sourceId, status, timestamp, metadata? }`.
  2. Always set `status: 'committed'` on insert; add helper `voidLedgerEntry(id)` for compensation.
  3. Make `xpRepository.create()` accept the full record and reject if `balanceBefore`/`balanceAfter` mismatch computed (defensive).
  4. Update all callers (`awardPoints`, `adjustPoints`, redemption flows) to compute and pass snapshots.
- **Acceptance Criteria:**
  - Every record has all 8 required fields per BR-002.
  - Any change to `delta` would mismatch `balanceAfter - balanceBefore` → record rejected.
- **Owner Hint:** Backend dev
- **Estimate:** M (2 days)

---

### Task 1.3 — Transaction + idempotency infrastructure

- **Goal:** Server-side idempotent + atomic operations across all critical paths.
- **Why:** Non-Negotiable Principle — every critical action idempotent; BR-002 explicitly requires eventId-based dedup.
- **Files Touched:**
  - `src/core/transaction.js` (new)
  - `src/core/idempotency.js` (new)
  - `src/middleware/idempotencyKey.js` (new)
- **Steps:**
  1. Build `runTransaction(workFn, ctx)` wrapper around Firestore `runTransaction` with retry.
  2. Build `assertUniqueEvent(eventId)` that looks up `(sourceType, eventId)` in a dedup collection and throws `DUPLICATE_EVENT` on hit.
  3. Idempotency-Key middleware: read `Idempotency-Key` header, store `(userId, key) → response` in `idempotency_keys` collection for 24h, replay cached response on retry.
  4. Register middleware globally in `app.js`.
- **Acceptance Criteria:**
  - Same `Idempotency-Key` from same user within 24h returns cached response without re-executing handler.
  - Same eventId never produces two ledger entries.
- **Owner Hint:** Backend dev
- **Estimate:** M (2 days)

---

## Phase 2 — User-Facing Critical Flows

> Depends on: Phase 1 complete.

---

### Task 2.1 — Fix check-in rules (BR-003)

- **Goal:** Enforce 1 check-in per restaurant per 24h, max 5 check-ins per user per day, configurable per-restaurant radius.
- **Why:** BR-003 violated; current code allows 3 per restaurant per day and unlimited per day.
- **Files Touched:**
  - `src/modules/checkins/checkinService.js`
  - `src/modules/checkins/checkinRepository.js`
  - `src/modules/checkins/checkinValidators.js`
  - `src/modules/restaurants/restaurantRepository.js` (add `config.radiusMeters`, `pointsPerCheckin`, `qrEnabled`)
  - `src/middleware/geoFence.js` (new)
- **Steps:**
  1. Replace `assertMealWindowCheckinAllowed` with `assertCheckinAllowed(userId, restaurantId, now)`:
     - Query last check-in for `(userId, restaurantId)` where `createdAt > now - 24h` → reject.
     - Query all check-ins for `userId` on the same UTC calendar day → reject if `>= 5`.
  2. Add per-restaurant `radiusMeters` (default 100); remove hard-coded `CHECKIN_MAX_DISTANCE_KM = 0.1`.
  3. Implement geoFence middleware that accepts `{ lat, lng, accuracy, age }` and rejects stale/spoofed fixes.
  4. Wire idempotency: require `Idempotency-Key` on POST; insert dedup row keyed by `(userId, restaurantId, dayBucket)`.
  5. After check-in success, award points via `xpService.awardPoints` (Task 1.1 → writes wallet + ranking).
- **Acceptance Criteria:**
  - 2nd check-in same restaurant within 24h returns 409 `ALREADY_CHECKED_IN_TODAY`.
  - 6th check-in same UTC day returns 429 `DAILY_CHECKIN_LIMIT`.
  - Per-restaurant `radiusMeters` value honored; 50 m radius lets a check-in at 80 m fail; 200 m radius lets it pass.
  - GPS fix with `accuracy > 50 m` rejected.
- **Owner Hint:** Backend dev
- **Estimate:** L (3 days)

---

### Task 2.2 — Fix reward redemption (BR-006)

- **Goal:** Atomic redemption + 1-per-reward + 3-per-day + 7-day expiry + unique codes + spec states.
- **Why:** BR-006 — current flow is non-atomic and misses 4 of 6 mandatory behaviors.
- **Files Touched:**
  - `src/modules/rewardRedemptions/rewardRedemptionService.js`
  - `src/modules/rewardRedemptions/rewardRedemptionRepository.js`
  - `src/modules/rewardRedemptions/rewardRedemptionValidators.js`
  - `src/modules/rewards/rewardService.js` (stock decrement moved into transaction)
  - `src/modules/rewards/rewardRepository.js`
  - `src/jobs/expireRewardRedemptions.js` (new)
- **Steps:**
  1. Wrap `redeemReward` in `runTransaction`:
     - Read reward; if `quantityAvailable <= 0` → throw `OUT_OF_STOCK`.
     - Insert `redemptions` row with `status: 'pending'`, `code: nanoid(10)`, `expiresAt = now + 7d`.
     - Insert ledger entry with `balanceType: 'wallet'`, `delta: -reward.pointCost` (Task 1.1/1.2).
     - Decrement `reward.quantityAvailable`.
  2. Pre-checks inside transaction:
     - User has `walletPoints >= reward.pointCost`.
     - No existing `redemptions` row for `(userId, rewardId)` with status in `[pending, used]` → reject `ALREADY_REDEEMED`.
     - Today's redemption count for `userId` < 3 → reject `DAILY_LIMIT_REACHED`.
  3. New admin endpoints:
     - `POST /admin/reward-redemptions/:code/use` (mark used by staff)
     - `POST /admin/reward-redemptions/:code/cancel`
     - `POST /admin/reward-redemptions/:code/reject`
  4. Scheduled job (Cloud Scheduler, daily): flip `pending` rows past `expiresAt` to `status: 'expired'` and refund points (write a compensating wallet ledger entry).
- **Acceptance Criteria:**
  - Two concurrent redemptions of the last stock → one succeeds, one fails with `OUT_OF_STOCK`.
  - Same user redeeming same reward twice → second fails `ALREADY_REDEEMED`.
  - 4th same-day redemption → fails `DAILY_LIMIT_REACHED`.
  - After 7 days, an unredeemed code auto-flips to `expired` and points return to wallet.
  - Code is non-transferable (single-use, marked `used` on first staff scan).
- **Owner Hint:** Backend dev
- **Estimate:** L (4 days)

---

### Task 2.3 — Fix spin wheel (BR-005)

- **Goal:** Server-side result with idempotency and atomic stock decrement.
- **Why:** BR-005 — current code is non-atomic; concurrent spins overshoot stock; client retry double-credits.
- **Files Touched:**
  - `src/modules/spins/spinService.js`
  - `src/modules/spins/spinRepository.js`
  - `src/modules/spins/spinValidators.js`
  - `src/modules/dailyRewards/dailyRewardService.js` (fix stock consistency)
- **Steps:**
  1. Replace `Math.random()` with `crypto.randomInt(0, totalWeight)`.
  2. Wrap `chooseReward + persist + awardPoints + decrement stock` in `runTransaction` (Task 1.3).
  3. Compute 24h cooldown against `settings.resetTimeUtc` (not UTC midnight).
  4. Require `Idempotency-Key` header on `POST /spins`; return cached result on retry.
  5. Add `dailyRewardRepository.decrementStock(id)` that uses conditional update `where quantityAvailable > 0`.
- **Acceptance Criteria:**
  - Two concurrent spins of last stock → one succeeds, one fails.
  - Retry with same `Idempotency-Key` returns same result.
  - `nextSpinAt` computed against configured reset time, not always midnight.
- **Owner Hint:** Backend dev
- **Estimate:** M (3 days)

---

### Task 2.4 — Restaurant-item redemption race fix

- **Goal:** Atomic deduction when redeeming a menu item with points.
- **Why:** Same TOCTOU pattern as Task 2.2 — read balance, write redemption, deduct ledger.
- **Files Touched:**
  - `src/modules/restaurantItemRedemptions/restaurantItemRedemptionService.js`
  - `src/modules/restaurantItemRedemptions/restaurantItemRedemptionRepository.js`
- **Steps:**
  1. Move into `runTransaction` (Task 1.3).
  2. Replace ad-hoc rollback with compensating ledger entries on partial failure.
  3. Add `Idempotency-Key` requirement.
- **Acceptance Criteria:**
  - Two concurrent `redeemItem` calls cannot both pass when balance < 2× cost.
- **Owner Hint:** Backend dev
- **Estimate:** S (1 day)

---

## Phase 3 — Routes / Challenges

> Depends on: Phase 1, Phase 2.

---

### Task 3.1 — Replace Route data model (BR-017)

- **Goal:** Persist every BR-017 admin-configurable field.
- **Why:** Current model persists only `routeName, description, city, restaurantIds, status`.
- **Files Touched:**
  - `src/modules/routes/routeRepository.js`
  - `src/modules/routes/routeValidators.js`
  - `src/modules/routes/routeService.js`
- **Steps:**
  1. Extend schema: `startDate, endDate, requiredVisits, mandatoryOrder (bool), pointsPerReceiptUpload, completionBonus, limitPerUser, repeatable, cooldownMinutes`.
  2. Update `ROUTE_STATUSES` to `[draft, active, paused, completed, expired]`.
  3. Update `validateRouteCreate` and `validateRouteUpdate` to accept new fields.
  4. Validate `endDate > startDate`, `requiredVisits > 0`, `cooldownMinutes >= 60`.
- **Acceptance Criteria:**
  - Admin POST/PATCH accepts all 11 fields; Firestore persists them.
  - Unknown status rejected.
- **Owner Hint:** Backend dev
- **Estimate:** M (2 days)

---

### Task 3.2 — Build route-participation entity

- **Goal:** Track per-user-per-route progress and unique restaurants visited.
- **Why:** Required for completion detection and bonus issuance.
- **Files Touched:**
  - `src/modules/routeParticipations/routeParticipationRepository.js` (new)
  - `src/modules/routeParticipations/routeParticipationService.js` (new)
  - `src/modules/routeParticipations/routeParticipationController.js` (new)
  - `src/modules/routeParticipations/routeParticipationRouter.js` (new)
- **Steps:**
  1. Collection `route_participations`: `{ userId, routeId, restaurantId, receiptUploadId, completedAt }` with composite index.
  2. Enforce unique `(userId, routeId, restaurantId)`.
  3. Endpoints:
     - `GET /routes/me/active` (with progress %)
     - `POST /routes/:id/join` (opt-in for routes requiring it)
     - `GET /routes/:id/progress`
- **Acceptance Criteria:**
  - Same restaurant cannot appear twice for the same user+route.
- **Owner Hint:** Backend dev
- **Estimate:** M (2 days)

---

### Task 3.3 — Drive route completion from receipt upload (BR-017)

- **Goal:** Receipt upload is the trigger that advances route progress and awards completion bonus.
- **Why:** Current receipt upload awards XP but never touches route state.
- **Files Touched:**
  - `src/modules/receiptUploads/receiptUploadService.js`
  - `src/modules/routeParticipations/routeParticipationService.js` (uses 3.2)
- **Steps:**
  1. After successful receipt upload, find active routes where:
     - `restaurantIds` includes the uploaded receipt's restaurant.
     - User's city matches `route.city` (or route is multi-city).
     - `now` is within `[startDate, endDate]`.
  2. For each matching route:
     - Insert participation row (Task 3.2 dedup).
     - If user now has `>= requiredVisits` distinct restaurants and bonus not yet awarded:
       - Award `completionBonus` via `xpService.awardPoints` (writes wallet + ranking per Task 1.1).
       - Mark `completionGrantedAt = now`.
       - If `repeatable = false`, lock participation row.
  3. Respect 60-min cooldown (Task 3.4).
- **Acceptance Criteria:**
  - Receipt upload at restaurant A advances the route.
  - Repeat receipt at same restaurant does NOT advance further.
  - 3rd unique restaurant (in a 3-of-5 route) triggers bonus once.
  - 4th advance on a non-repeatable route does nothing.
- **Owner Hint:** Backend dev
- **Estimate:** L (3 days)

---

### Task 3.4 — Route cooldowns and expiration (BR-018)

- **Goal:** Enforce 60-min inter-upload cooldown, 24h per restaurant, repeatability.
- **Why:** BR-018 — anti-rapid-scan protection.
- **Files Touched:**
  - `src/modules/receiptUploads/receiptUploadService.js`
  - `src/modules/routeParticipations/routeParticipationService.js`
  - `src/jobs/expireRoutes.js` (new)
- **Steps:**
  1. On receipt upload, validate:
     - Most recent upload in this route at any of its restaurants > 60 min ago (configurable per route).
     - Last receipt upload at this exact restaurant > 24h ago.
  2. If route `repeatable = true`, enforce 7-day minimum repeat cooldown since prior completion.
  3. Scheduled job: every 1h, mark routes with `endDate < now` as `status: 'expired'`.
- **Acceptance Criteria:**
  - Second upload within 60 min inside same route → 429 `ROUTE_COOLDOWN`.
  - Same restaurant second upload within 24h → 429 `RESTAURANT_24H`.
  - Marking route `repeatable = false` after completion blocks subsequent bonuses.
  - Marking route `repeatable = true` allows re-completion only after 7 days.
- **Owner Hint:** Backend dev
- **Estimate:** M (3 days)

---

### Task 3.5 — Challenges module updates

- **Goal:** Add `receipt_upload` criterion type; fix status enum and timezone handling.
- **Why:** Adjacent to BR-017; same completion mechanic.
- **Files Touched:**
  - `src/modules/challenges/challengeValidators.js`
  - `src/modules/challenges/challengeService.js`
  - `src/modules/challengeParticipations/challengeParticipationService.js`
- **Steps:**
  1. Add `CRITERION_TYPES.receipt_upload`.
  2. Fix `CHALLENGE_STATUSES` to spec values.
  3. Use user timezone (from user profile) when bucketing meals, not UTC.
- **Acceptance Criteria:**
  - Admin can create a challenge with `criterionType: 'receipt_upload', targetCount: 3`.
  - Meal windows in different timezones produce correct local-time buckets.
- **Owner Hint:** Backend dev
- **Estimate:** S (1 day)

---

## Phase 4 — Rankings & Location

> Depends on: Phase 1 (for ranking-points split).

---

### Task 4.1 — Fix leaderboard (BR-007, BR-008)

- **Goal:** Rankings use ranking-points only; correct tie-breakers; proper week/month/all-time periods; exclude inactive.
- **Why:** BR-007, BR-008 — current code ranks by combined balance, alphabetically breaks ties, "all-time" returns weekly.
- **Files Touched:**
  - `src/modules/leaderboard/leaderboardService.js`
  - `src/modules/leaderboard/leaderboardRepository.js`
  - `src/modules/leaderboard/leaderboardValidators.js`
- **Steps:**
  1. Query `points_ledger` filtered by `balanceType: 'ranking'`, sum per user.
  2. Tie-breaker chain:
     1. Total valid check-ins (descending) — query `checkins` collection for user.
     2. Earliest timestamp reaching the score (ascending).
     3. Most recent activity (`lastSeenAt`, descending).
  3. Period computation:
     - `weekly`: from last Monday 00:00 local TZ.
     - `monthly`: from 1st of current month 00:00 local TZ.
     - `all-time`: `null` sinceDate (use full sum).
  4. Inactivity filter: exclude users with `lastSeenAt < now - 30d` from weekly/monthly listings (BR-008).
  5. Add `lastSeenAt` to user profile; update on every authenticated request.
- **Acceptance Criteria:**
  - Two users with equal ranking-points → tie broken by check-in count, then `lastSeenAt`.
  - All-time ranking never truncates to a week.
  - Inactive user hidden from weekly/monthly but kept on all-time.
- **Owner Hint:** Backend dev
- **Estimate:** L (3 days)

---

### Task 4.2 — Active cities allow-list (BR-010)

- **Goal:** Enforce Mexico City / Monterrey / Guadalajara at every restaurant and notification flow.
- **Why:** BR-010 — current code lets non-MVP cities leak in.
- **Files Touched:**
  - `src/core/activeCities.js` (new)
  - `src/modules/restaurants/restaurantService.js`
  - `src/modules/restaurants/restaurantValidators.js`
  - `src/modules/restaurantDiscovery/restaurantDiscoveryService.js`
  - `src/modules/users/userService.js` (proximity scan)
  - `src/modules/notificationCampaigns/notificationCampaignService.js`
- **Steps:**
  1. Export constant: `export const ACTIVE_CITIES = ['Mexico City', 'Monterrey', 'Guadalajara'];`
  2. Add lat/lng bounds per city; function `isInActiveCity({lat, lng})`.
  3. Block restaurant creation when `payload.city` not in allow-list.
  4. List endpoints default to filtering by user's active city.
  5. Out-of-service detection: if user GPS > 50 km from any active city center, return 409 `OUT_OF_SERVICE` with `availableCities` payload.
- **Acceptance Criteria:**
  - Restaurant create with `city: 'Tokyo'` → 400 `INVALID_CITY`.
  - Discovery listing with user in Tijuana → `OUT_OF_SERVICE` error with manual city selection payload.
  - Proximity alerts skip non-MVP cities.
- **Owner Hint:** Backend dev
- **Estimate:** M (2 days)

---

### Task 4.3 — BR-011 radius layering and placement order

- **Goal:** 5 km primary, 15 km secondary, sponsored-first ordering, sponsored expansion.
- **Why:** BR-011 — current code sorts purely by distance.
- **Files Touched:**
  - `src/modules/restaurantDiscovery/restaurantDiscoveryService.js`
  - `src/modules/placements/placementService.js`
  - `src/modules/placements/placementRouter.js` (add public endpoint if missing)
- **Steps:**
  1. Endpoint contract: `GET /discovery/nearby?lat&lng&radius?` returns:
     - `tier: 'primary' (≤5km) | 'secondary' (≤15km) | 'extended' (any)`
     - Default radius 5 km.
  2. Read `placements` collection:
     - Filter by `feature: 'discovery_feed'`, `active: true`, `startAt <= now < endAt`.
     - Sort sponsored placements by `priority` ascending; surface in dedicated `sponsored` segment of response.
  3. Order: sponsored → primary nearby → secondary → challenges/routes → highlights.
  4. Always return `distanceKm` per record (compute if missing).
- **Acceptance Criteria:**
  - At user GPS in Roma Norte, restaurants in Polanco (>5 km) do not appear in primary.
  - Sponsored restaurant appears first with `isSponsored: true` flag.
  - Distance returned for every record.
- **Owner Hint:** Backend dev
- **Estimate:** M (3 days)

---

### Task 4.4 — Fix navigation endpoint (BR-012)

- **Goal:** iOS/Android/Waze-aware launcher payload.
- **Why:** BR-012 — current endpoint returns only Google Maps URL.
- **Files Touched:**
  - `src/modules/restaurantDiscovery/restaurantDiscoveryService.js`
  - `src/modules/users/userService.js` (proximity push)
- **Steps:**
  1. Response shape:
     ```json
     {
       "ios": {
         "appleMaps": "maps://?daddr=lat,lng",
         "googleMaps": "comgooglemaps://?daddr=lat,lng&directionsmode=driving",
         "waze": "waze://?ll=lat,lng&navigate=yes"
       },
       "android": {
         "googleMaps": "geo:lat,lng?q=lat,lng(name)",
         "waze": "waze://?ll=lat,lng&navigate=yes"
       },
       "web": "https://www.google.com/maps/dir/?api=1&destination=lat,lng"
     }
     ```
  2. Helper `pickNavigationTargets(platform, installedApps)` on client (out of scope but spec).
  3. If `installedApps` is empty (server can't know), include web URL.
- **Acceptance Criteria:**
  - Response contains all 3 platform payloads.
  - Each URL uses a launchable scheme on the respective platform.
- **Owner Hint:** Backend dev
- **Estimate:** S (1 day)

---

### Task 4.5 — Notification preferences + city filtering (BR-013)

- **Goal:** Per-category opt-out, city-segmented notifications.
- **Why:** BR-013 — no preferences storage; no city filter.
- **Files Touched:**
  - `src/modules/userPreferences/userPreferenceRepository.js` (new collection)
  - `src/modules/userNotifications/userNotificationService.js`
  - `src/modules/userNotifications/userNotificationValidators.js`
- **Steps:**
  1. New collection `user_preferences` keyed by `userId`: `{ promotions, challenges, rewards, nearby, general }` (default all true).
  2. Endpoint `PUT /me/preferences/notifications`.
  3. Update `CATEGORIES` enum to `[promotions, challenges, rewards, nearby, general]`.
  4. `listNotifications` filters by user's enabled categories.
  5. All `from*` builders filter by `record.city === user.city`.
  6. Campaign resolver filters by user's active city when campaign has `city`.
- **Acceptance Criteria:**
  - Disabling `promotions` category hides promotional notifications.
  - Notification created in Mexico City is not shown to a user whose city is Monterrey.
- **Owner Hint:** Backend dev
- **Estimate:** M (2 days)

---

## Phase 5 — Auth & Security

> Depends on: Task 1.3 (idempotency middleware).

---

### Task 5.1 — Generic forgot-password response (BR-015)

- **Files Touched:** `src/modules/auth/authService.js`, `authController.js`
- **Steps:**
  1. `forgotPassword(email)` always returns generic message: `"If the email is registered, we have sent a recovery link."`
  2. Internally: do NOT throw on missing user; if user exists, send email.
- **Acceptance Criteria:** Same 200 response for existing and non-existing emails.
- **Estimate:** S (0.5 day)

---

### Task 5.2 — Defer signup bonus to post-verification

- **Files Touched:** `src/modules/auth/authService.js`
- **Steps:**
  1. Remove `applySignupBonusIfEligible` from `register` flow.
  2. Call it from `verifyRegisterOtp` success handler.
  3. If a user is deleted before verifying, no bonus row exists.
- **Acceptance Criteria:** `walletPoints === 0` for any user whose email is unverified.
- **Estimate:** S (0.5 day)

---

### Task 5.3 — Referral code generation hardening

- **Files Touched:** `src/modules/auth/authService.js`, `src/core/security.js`
- **Steps:**
  1. Use `crypto.randomInt(0, alphabet.length)` (no modulo bias).
  2. Real uniqueness check against `users` collection with bounded retry (max 5 attempts).
- **Acceptance Criteria:** 1,000 generated codes are all unique; randomness passes dieharder.
- **Estimate:** S (0.5 day)

---

### Task 5.4 — Global auth middleware

- **Files Touched:**
  - `src/middleware/requireAuth.js` (new)
  - `src/middleware/requireVerifiedEmail.js` (new)
  - `src/middleware/requireRole.js` (new)
  - `src/app.js`, all `*Router.js`
- **Steps:**
  1. Apply `requireAuth` to all `/api/v1/users/me/*`, `/api/v1/routes/*`, `/api/v1/spins/*`, `/api/v1/reward-redemptions/*`, `/api/v1/admin/*`.
  2. `requireVerifiedEmail` on any action that awards points or writes ledger.
  3. `requireRole('admin')` on admin routes.
- **Acceptance Criteria:** Forgetting the middleware on a new endpoint is impossible (helpers only).
- **Estimate:** M (1.5 days)

---

### Task 5.5 — OTP hardening

- **Files Touched:** `src/core/security.js`, `src/modules/auth/authService.js`
- **Steps:**
  1. Add per-record salt (stored alongside hash).
  2. Switch to 6-digit OTP for stronger entropy (configurable via env).
  3. Add per-IP rate limit on `resendRegisterOtp` and `forgotPassword`.
- **Acceptance Criteria:** Brute-forcing a 6-digit OTP within a 10-min window requires >1M attempts; rejected after 5 attempts.
- **Estimate:** M (1 day)

---

## Phase 6 — Admin & Operational Tasks

> Depends on: Phase 2 (transactions + idempotency).

---

### Task 6.1 — CMS slug race + published flag

- **Files Touched:** `src/modules/cms/cmsService.js`, `cmsRepository.js`
- **Steps:**
  1. Wrap `createPage` in `runTransaction` (Task 1.3) for slug uniqueness.
  2. Add `published: boolean` (default false). Public GET filters `published: true` only.
  3. Admin endpoint to set `published`.
- **Acceptance Criteria:** Two admins creating same slug concurrently → 1 succeeds, 1 fails. Draft pages not publicly visible.
- **Estimate:** S (0.5 day)

---

### Task 6.2 — Receipt upload orphan cleanup

- **Files Touched:**
  - `src/modules/receiptUploads/receiptUploadService.js`
  - `src/jobs/cleanupOrphanReceipts.js` (new)
- **Steps:**
  1. Track Storage path on creation; if write fails after upload, delete Storage object in a `catch` block.
  2. Scheduled job (weekly): scan `receipt_uploads` for any record whose `status === 'failed'` or lacks a corresponding ledger entry → delete Storage object.
- **Acceptance Criteria:** No orphan Storage objects after 30 days.
- **Estimate:** S (1 day)

---

### Task 6.3 — Spanish email templates (BR-014)

- **Files Touched:** `src/infra/emailService.js`
- **Steps:**
  1. Add `templates.es.js`: OTP, password recovery, redemptions, routes.
  2. Use ES by default; fallback to EN if locale missing.
  3. Send `Accept-Language` from client or detect from user profile.
- **Acceptance Criteria:** OTP email subject is `"Tu código de verificación Food Route"`.
- **Estimate:** S (1 day)

---

### Task 6.4 — Add `requestId` propagation from upstream

- **Files Touched:** `src/app.js`, `src/middleware/errorHandler.js`
- **Steps:**
  1. Trust inbound `x-request-id` header if present; else generate new UUID.
  2. Echo `x-request-id` on every response (already done — verify).
  3. Add structured logger (pino/winston) with `requestId` field on every log line.
- **Acceptance Criteria:** Distributed trace continuity preserved across services.
- **Estimate:** S (0.5 day)

---

## Phase 7 — QA & Documentation

> Depends on: Phases 1–6.

---

### Task 7.1 — Test suite per module

- **Files Touched:** `functions/tests/**`
- **Steps:**
  1. `tests/xp/` — idempotency, wallet/ranking split, before/after invariant.
  2. `tests/checkins/` — 24h cap, daily cap, idempotency, GPS radius.
  3. `tests/rewardRedemptions/` — 1/reward, 3/day, 7-day expiry, code use/cancel/reject.
  4. `tests/spins/` — 24h cooldown, idempotency, stock race.
  5. `tests/routes/` — receipt-triggered completion, 60-min cooldown, repeatable 7-day min.
  6. `tests/leaderboard/` — earned-only, tie-breakers, all-time, inactive filter.
  7. `tests/restaurantDiscovery/` — active city, radius layering, sponsored order.
  8. CI workflow (GitHub Actions) running `npm test`.
- **Acceptance Criteria:** All BR acceptance criteria covered; CI green.
- **Estimate:** XL (1+ week)

---

### Task 7.2 — Update API documentation

- **Files Touched:** `functions/apis.md`, `functions/api-endpoints.md`, `functions/README.md`, Postman collection
- **Steps:**
  1. Document new fields: `balanceType`, `balanceBefore`, `balanceAfter`.
  2. Document BR-017 Route fields and admin endpoints.
  3. Document redemption states and admin transitions.
  4. Document `Idempotency-Key` middleware usage.
  5. Document new iOS/Android/Waze navigation response shape.
  6. Regenerate Postman collection.
- **Acceptance Criteria:** Frontend team can build the client without asking questions.
- **Estimate:** M (2 days)

---

### Task 7.3 — Migration playbook

- **Files Touched:** `functions/scripts/README.md`, new migration scripts.
- **Steps:**
  1. `scripts/migrateLedgerBalanceType.js` (Task 1.1).
  2. `scripts/backfillAuthoritativeBalances.js` (Task 1.1 step 7).
  3. `scripts/expireHistoricalRedemptions.js`.
  4. Roll-back procedures documented.
  5. Runbook with checkpoints and stop conditions.
- **Acceptance Criteria:** A junior engineer can run migrations in staging with confidence.
- **Estimate:** M (2 days)

---

### Task 7.4 — Observability

- **Files Touched:** `src/core/logger.js` (new)
- **Steps:**
  1. Replace `console.log/error` with structured logger.
  2. Add metrics endpoint (Prometheus format) for: checkin count, redemption count, spin count, route completions, ledger writes per minute.
  3. Add alerting rules doc.
- **Acceptance Criteria:** Operations can detect silent failures within 5 minutes.
- **Estimate:** M (2 days)

---

## Sprint Layout

| Sprint | Tasks | Days | Output |
|--------|-------|------|--------|
| **Sprint 1** | 1.1, 1.2, 1.3, 5.3 | 8 | Data model + transaction/idempotency infra |
| **Sprint 2** | 2.1, 2.2, 2.3, 2.4, 5.1, 5.2 | 12 | Check-in, redemption, spin race-safe; auth quick wins |
| **Sprint 3** | 3.1, 3.2, 3.3, 3.4, 3.5 | 10 | Routes completion driven by receipts |
| **Sprint 4** | 4.1, 4.2 | 5 | Rankings on earned points; active cities allow-list |
| **Sprint 5** | 4.3, 4.4, 4.5, 5.4, 5.5 | 8 | Discovery/navigation/notifications polish; auth middleware |
| **Sprint 6** | 6.1, 6.2, 6.3, 6.4, 7.1 | 8 | Admin/ops + tests |
| **Sprint 7** | 7.2, 7.3, 7.4 | 6 | Docs, migrations, observability |

**Total estimate:** ~57 working days (≈ 11–12 weeks with 1 dev; 5–6 weeks with 2 devs in parallel where Tasks 2.* and 4.* don't conflict).

---

## Acceptance Criteria Checklist

Use this as the final QA gate before declaring MVP done.

| BR | Done When | Verified By |
|----|-----------|-------------|
| BR-001 | Two ledger entries per positive event; redemptions write only wallet | Task 1.1 + Task 2.2 tests |
| BR-002 | Every ledger has before/after + eventId-dedup | Task 1.2 + Task 1.3 tests |
| BR-003 | 1/restaurant/24h, ≤5/day, configurable radius | Task 2.1 tests |
| BR-004 | QR alone can't award points | Existing → verify Task 2.1 doesn't break |
| BR-005 | 1 spin/day, server result, idempotent | Task 2.3 tests |
| BR-006 | Redemption atomic; 1/reward; 3/day; 7-day code; states | Task 2.2 tests |
| BR-007 | Rankings use earned-only; correct tie-breakers; all-time | Task 4.1 tests |
| BR-008 | Inactive users excluded from period rankings | Task 4.1 |
| BR-010 | Only 3 active cities; out-of-service detected | Task 4.2 |
| BR-011 | 5km/15km tiers; sponsored first | Task 4.3 |
| BR-012 | iOS/Android/Waze launcher payload | Task 4.4 |
| BR-013 | Per-category opt-out, city-segmented | Task 4.5 |
| BR-014 | Spanish user-facing strings | Task 6.3 + frontend |
| BR-015 | Recovery flow visible, generic response | Task 5.1 + frontend |
| BR-016 | Confirmation flow + balance update | Existing frontend wiring |
| BR-017 | All admin fields stored; receipt-driven completion | Task 3.1, 3.2, 3.3 |
| BR-018 | 60-min cooldown; 24h/restaurant; repeatability rules | Task 3.4 |

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| **Data migration breaks existing balances** | Run migration in dry-run mode first; compute expected wallet/ranking for each user; compare with denormalized fields. |
| **Idempotency key collisions across services** | Namespace keys: `userId:requestRoute:eventType`. |
| **Sliding-window 5-day checkin test flaky in test env** | Use ClockProvider abstraction in tests; inject `now`. |
| **Route completion award fires twice in retries** | Atomic completion grant inside `runTransaction` with `completionGrantedAt` guard. |
| **Spanish translations incomplete** | Audit user-facing strings with copywriter before merge. |
| **Spin randomness exploit** | Use cryptographically secure RNG (`crypto.randomInt`) and publish seed-management doc. |
| **Receipt-driven completion creates load on routes query** | Add composite index `(city, restaurantIds array-contains, endAt, status)` to Firestore. |
| **Firestore 1MB doc limit hit on `restaurantRepository.listAll()`** | Replace with cursor pagination in all modules flagged in audit (discovery, routes, etc.). |
| **`verifyIdToken` race with deleted user** | In `getAuthenticatedAccount`, confirm `isDeleted === false` after auth. |
| **CMS published-flag accidental leak** | Integration test: draft +200 returns 404. |

---

## Quick-Win Tasks (≤1 day each)

If capacity opens up before the full plan runs:

1. Add `Idempotency-Key` middleware (prereq for Task 1.3) — 1 day
2. Replace `Math.random()` with `crypto.randomInt()` in spin — 1 hour
3. Define `ACTIVE_CITIES` constant (prereq for Task 4.2) — 1 hour
4. Add `notificationPreferences` user field with defaults — 2 hours
5. Hide drafts in public CMS endpoint — 1 hour
6. Spanish email templates (BR-014) — 1 day
7. Generic forgot-password response (BR-015) — half day
8. Defer signup bonus to post-verification — half day

---

## Done Definition

The MVP is considered compliant when:

- All tasks in Phases 1–6 have `Acceptance Criteria` ✅
- `npm test` passes in CI for all BRs in the acceptance checklist
- New API endpoints documented in `apis.md` and Postman
- Production data migrations completed with zero balance discrepancies
- A stakeholder walkthrough confirms BR-001 through BR-018 are honored
