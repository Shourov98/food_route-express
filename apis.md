Admin auth and profile:

- POST /api/v1/admin/auth/seed-super-admin
- POST /api/v1/admin/auth/login
- POST /api/v1/admin/auth/forgot-password
- POST /api/v1/admin/auth/resend-forgot-otp
- POST /api/v1/admin/auth/verify-forgot-otp
- PATCH /api/v1/admin/change-password
- GET /api/v1/admin/profile
- PATCH /api/v1/admin/profile
- PATCH /api/v1/admin/profile/image

Super admin admin-management:

- POST /api/v1/admin/admins
- GET /api/v1/admin/admins
- GET /api/v1/admin/admins/{admin_id}
- PATCH /api/v1/admin/admins/{admin_id}
- POST /api/v1/admin/admins/{admin_id}/block
- POST /api/v1/admin/admins/{admin_id}/unblock

Admin user-management:

- GET /api/v1/admin/users
- GET /api/v1/admin/users/blocked
- GET /api/v1/admin/users/{user_id}
- PATCH /api/v1/admin/users/{user_id}/points
- POST /api/v1/admin/users/{user_id}/block
- POST /api/v1/admin/users/{user_id}/unblock
- GET /api/v1/admin/check-ins
- GET /api/v1/admin/levels
- GET /api/v1/admin/levels/config
- POST /api/v1/admin/levels
- GET /api/v1/admin/levels/{level_id}
- PATCH /api/v1/admin/levels/{level_id}
- DELETE /api/v1/admin/levels/{level_id}

User auth:

- POST /api/v1/auth/register
- POST /api/v1/auth/register-with-referral
- POST /api/v1/auth/send-verification-email
- POST /api/v1/auth/resend-verify-otp
- POST /api/v1/auth/verify-otp
- POST /api/v1/auth/login
- POST /api/v1/auth/forgot-password
- POST /api/v1/auth/send-password-reset-email
- POST /api/v1/auth/resend-forgot-otp
- POST /api/v1/auth/verify-forgot-otp
- POST /api/v1/auth/change-password

User profile:

- GET /api/v1/users/me
- GET /api/v1/users/me/overview
- GET /api/v1/users/me/referral
- GET /api/v1/users/me/summary
- GET /api/v1/users/me/xp-summary
- GET /api/v1/users/me/points-summary
- GET /api/v1/users/me/xp-history
- GET /api/v1/users/me/ranks
- GET /api/v1/users/me/favorites/restaurants
- PATCH /api/v1/users/me/favorites/restaurants/{restaurant_id}
- PATCH /api/v1/users/me/image
- GET /api/v1/check-ins/history
- GET /api/v1/restaurants
- GET /api/v1/restaurants/nearby
- GET /api/v1/restaurants/featured
- GET /api/v1/restaurants/{restaurant_id}
- POST /api/v1/restaurants/{restaurant_id}/reviews
- GET /api/v1/restaurants/{restaurant_id}/reviews
- PATCH /api/v1/restaurants/{restaurant_id}/reviews/{review_id}
- DELETE /api/v1/restaurants/{restaurant_id}/reviews/{review_id}
- POST /api/v1/support-requests

Leaderboard:

- GET /api/v1/users/leaderboard

Spin System:

- GET /api/v1/users/me/spins/rewards
- POST /api/v1/users/me/spins
- GET /api/v1/users/me/spins/history

Admin Daily Rewards:

- POST /api/v1/admin/daily-rewards
- GET /api/v1/admin/daily-rewards
- GET /api/v1/admin/daily-rewards/{reward_id}
- PATCH /api/v1/admin/daily-rewards/{reward_id}
- DELETE /api/v1/admin/daily-rewards/{reward_id}
- GET /api/v1/admin/daily-rewards/analytics

- daily rewards are discount-only spin-wheel rewards
- the spin wheel always includes an implicit 0% no-discount segment that is not stored in Firestore
- `GET /api/v1/admin/daily-rewards/analytics` now returns low-stock alerts for rewards that fall below 20% of their original stock and includes discount averages

Support Requests:

- POST /api/v1/support-requests
- GET /api/v1/admin/support-requests
- GET /api/v1/admin/support-requests/{request_id}

Spin Wheel:

- GET /api/v1/admin/spin-wheel/analytics
- GET /api/v1/admin/spin-wheel/settings
- PATCH /api/v1/admin/spin-wheel/settings

- `GET /api/v1/admin/spin-wheel/settings` and `PATCH /api/v1/admin/spin-wheel/settings` include `noRewardProbability`, which controls the always-present 0% no-discount segment weight
- `GET /api/v1/admin/spin-wheel/analytics` includes the total configured probability weight and whether any probability weight is configured

Payload notes:

- `POST /api/v1/admin/auth/seed-super-admin` expects `fullname`, `phone`, `email`, `password`
- `POST /api/v1/admin/auth/seed-super-admin` can also omit the body and use `INITIAL_SUPER_ADMIN_FULLNAME`, `INITIAL_SUPER_ADMIN_PHONE`, `INITIAL_SUPER_ADMIN_EMAIL`, and `INITIAL_SUPER_ADMIN_PASSWORD` from environment settings
- `POST /api/v1/admin/admins` expects `multipart/form-data` with `fullname`, optional `phone`, `email`, `password`, optional `confirmPassword`, and optional `image`
- `PATCH /api/v1/admin/admins/{admin_id}` expects `fullname`, `phone`
- `PATCH /api/v1/admin/profile` expects `fullname`, `phone`
- `PATCH /api/v1/admin/profile/image` expects `multipart/form-data` with `image`
- `POST /api/v1/admin/restaurants/{restaurant_id}/menu/items` expects `multipart/form-data` with `name`, `description`, `price`, `pointsToBuy`, `isAvailable`, and optional `image`
- `PATCH /api/v1/admin/restaurants/{restaurant_id}/menu/items/{item_id}` expects `multipart/form-data` with optional `name`, `description`, `price`, `pointsToBuy`, `isAvailable`, `imageUrl`, and optional `image`
- `POST /api/v1/admin/daily-rewards` expects `multipart/form-data` with `discountPercentage`, `quantityAvailable`, `probability`, optional `isActive`, optional `hasExpiry`, optional `expiresAt`, and optional `image`
- `PATCH /api/v1/admin/daily-rewards/{reward_id}` expects `multipart/form-data` with optional `discountPercentage`, `quantityAvailable`, `probability`, optional `isActive`, optional `hasExpiry`, optional `expiresAt`, and optional `image`
- daily rewards are discount-only, and the title/description are fixed by the backend
- `discountPercentage` controls the actual discount value; `0` is valid and means no reward
- the user rewards catalog remains separate under `/api/v1/admin/rewards` and `/api/v1/users/me/rewards`, where spin wins are added to the user's owned rewards and can be redeemed later at restaurants
- if `image` is omitted on daily reward update, the existing image is preserved; if a new file is sent, the backend replaces the previous image
- `GET /api/v1/admin/spin-wheel/analytics` returns total spins today, average redemption rate, the current reset cycle, total probability, and the no-reward probability
- `GET /api/v1/admin/spin-wheel/settings` returns the active reset logic, reset time, and no-reward probability
- `PATCH /api/v1/admin/spin-wheel/settings` expects JSON with `resetLogic`, `resetTimeUtc`, and optional `noRewardProbability`
- `POST /api/v1/admin/restaurants` and `PUT /api/v1/admin/restaurants/{restaurant_id}` also accept `city` so route management can filter restaurants by city
- `GET /api/v1/admin/packages/catalog`
- `GET /api/v1/admin/packages/features`
- `POST /api/v1/admin/packages/restaurants/{restaurant_id}/activate`
- `POST /api/v1/admin/packages/restaurants/{restaurant_id}/upgrade`
- `GET /api/v1/admin/placements/features`
- `GET /api/v1/admin/placements/feature/{feature}`
- `POST /api/v1/admin/placements`
- `DELETE /api/v1/admin/placements/{placement_id}`
- `PATCH /api/v1/admin/placements/{placement_id}/toggle`
- `GET /api/v1/admin/qr-codes`
- `GET /api/v1/admin/qr-codes/{restaurant_id}`
- `GET /api/v1/admin/qr-codes/{restaurant_id}/image`
- `GET /api/v1/admin/qr-codes/{restaurant_id}/pdf`
- `POST /api/v1/admin/restaurants` expects `multipart/form-data` with restaurant fields and required `image`; packages are assigned later from the restaurant view flow
- `PUT /api/v1/admin/restaurants/{restaurant_id}` expects `multipart/form-data` with restaurant fields and optional `image`; packages are managed separately through package APIs
- `POST /api/v1/auth/register` expects `fullname`, `email`, `gender`, `age`, `country`, `city`, `password`
- `PATCH /api/v1/users/me/image` expects `multipart/form-data` with `image`
- `PATCH /api/v1/admin/users/{user_id}/points` expects `pointsDelta`
- `GET /api/v1/admin/users/{user_id}/points-history` returns paginated points ledger entries, including increases and decreases
- `GET /api/v1/admin/check-ins` returns paginated check-in history
- `GET /api/v1/check-ins/history` returns paginated user check-in history
- `GET /api/v1/users/me/xp-history` returns paginated XP ledger entries
- `GET /api/v1/users/me/summary` returns the current user XP, points, streak, total check-in count, and rank summary in one response
- `GET /api/v1/users/me/points-summary` returns the current spendable points balance
- `GET /api/v1/users/me/ranks` returns current user city and national ranks
- `XP` is progression only and never decreases from spending
- `Points` are the spendable balance used for redemptions and admin adjustments
- `GET /api/v1/users/leaderboard` expects `scope=local|national`, `period=weekly|monthly`, and `Authorization: Bearer <access_token>`
- `POST /api/v1/check-ins/scan` expects `qrToken`, `latitude`, and `longitude`. The user must be within the configured check-in radius of the restaurant QR location, and can check in once per restaurant per UTC meal window per day: breakfast (`05:00-10:59`), lunch (`11:00-16:59`), and dinner (`17:00-22:59`).
- `GET /api/v1/restaurants/nearby` sorts results by minimum distance when both `latitude` and `longitude` are present. Without coordinates it falls back to the explicit `city` query or the authenticated user's saved city.
- `GET /api/v1/admin/restaurants/analytics/summary` lists check-in based analytics summaries for the dashboard restaurant table and accepts `range=last_7_days|last_30_days|last_90_days`.
- `GET /api/v1/admin/restaurants/{restaurant_id}/analytics` returns chart-ready check-in analytics for one restaurant. Route traffic fields remain zero until route visit events are tracked.
- `GET /api/v1/admin/routes/analytics` reports per-route check-in coverage for restaurants in each route. Route visit counts remain zero until route visit events are tracked.
- `GET /api/v1/restaurants` expects `page`, `pageSize`, optional `search`, optional `city`, optional `latitude`, optional `longitude`, and `Authorization: Bearer <access_token>`
- `GET /api/v1/restaurants/featured` expects `page`, `pageSize`, optional `search`, optional `city`, optional `latitude`, optional `longitude`, and `Authorization: Bearer <access_token>`
- Both user restaurant list endpoints return `latitude` and `longitude` on each restaurant item.
- `GET /api/v1/restaurants/{restaurant_id}` expects optional `latitude`, optional `longitude`, and `Authorization: Bearer <access_token>`
- restaurant discovery responses now include `isFavorite` per restaurant for the current user
- `GET /api/v1/users/me/favorites/restaurants` returns the current user's favorite restaurants
- `PATCH /api/v1/users/me/favorites/restaurants/{restaurant_id}` toggles the current user's favorite state for a restaurant
- `POST /api/v1/restaurants/{restaurant_id}/reviews` expects JSON with `rating` and optional `comment`
- `GET /api/v1/restaurants/{restaurant_id}/reviews` expects `page`, `pageSize`, and `Authorization: Bearer <access_token>`
- `PATCH /api/v1/restaurants/{restaurant_id}/reviews/{review_id}` expects JSON with optional `rating` and optional `comment`
- `DELETE /api/v1/restaurants/{restaurant_id}/reviews/{review_id}` expects `Authorization: Bearer <access_token>`
- `POST /api/v1/support-requests` expects JSON with `title` and `message`
- `GET /api/v1/admin/support-requests` returns paginated support requests
- `GET /api/v1/admin/support-requests/{request_id}` returns a specific support request
- `GET /api/v1/admin/levels/config` returns the configured level thresholds
- `GET /api/v1/users/me/spins/rewards` returns the available spin rewards
- `POST /api/v1/users/me/spins` expects no JSON body and requires `Authorization: Bearer <access_token>`
- `GET /api/v1/users/me/spins/history` expects `page`, `pageSize`, and `Authorization: Bearer <access_token>`

CMS:

- `GET /api/v1/cms/about-us`
- `PUT /api/v1/cms/admin/about-us`
- `GET /api/v1/cms/privacy-policy`
- `PUT /api/v1/cms/admin/privacy-policy`
- `GET /api/v1/cms/terms-and-conditions`
- `GET /api/v1/cms/terms-of-service`
- `PUT /api/v1/cms/admin/terms-and-conditions`
- `GET /api/v1/cms/pages/{slug}`
- `GET /api/v1/cms/admin/pages`
- `POST /api/v1/cms/admin/pages`
- `PATCH /api/v1/cms/admin/pages/{slug}`
- `DELETE /api/v1/cms/admin/pages/{slug}`

Reward catalog:

- `POST /api/v1/admin/rewards`
- `GET /api/v1/admin/rewards`
- `GET /api/v1/admin/rewards/{reward_id}`
- `PATCH /api/v1/admin/rewards/{reward_id}`
- `DELETE /api/v1/admin/rewards/{reward_id}`
- `GET /api/v1/admin/rewards/analytics`

- `POST /api/v1/admin/rewards` expects `multipart/form-data` with `title`, `description`, `pointsRequired`, `quantityAvailable`, `rewardCategory`, optional `xpPoints`, optional `foodItemName`, optional `discountPercentage`, optional `giftCardCode`, optional `termsAndConditions`, optional `isActive`, optional `hasExpiry`, optional `expiresAt`, and optional `image`
- `PATCH /api/v1/admin/rewards/{reward_id}` expects `multipart/form-data` with optional `title`, `description`, `pointsRequired`, `quantityAvailable`, `rewardCategory`, optional `xpPoints`, optional `foodItemName`, optional `discountPercentage`, optional `giftCardCode`, optional `termsAndConditions`, optional `isActive`, optional `hasExpiry`, optional `expiresAt`, and optional `image`
- `rewardCategory` supports `xp`, `food_item`, `discount`, `gift_card`, `experience`, `product`, `vip_experience`, `grand_prize`, and `bundle`
- if `image` is omitted on update, the existing image is preserved; if a new file is sent, the backend replaces the previous image

Reward redemption:

- `POST /api/v1/rewards/{reward_id}/redeem`
- `GET /api/v1/users/me/rewards`
- `POST /api/v1/users/me/rewards/{redemption_id}/redeem`

- `POST /api/v1/rewards/{reward_id}/redeem` expects no JSON body and requires `Authorization: Bearer <access_token>`
- `GET /api/v1/users/me/rewards` expects `page` and `pageSize` query params plus `Authorization: Bearer <access_token>`
- `POST /api/v1/users/me/rewards/{redemption_id}/redeem` expects no JSON body and requires `Authorization: Bearer <access_token>`

Restaurant item redemption:

- `GET /api/v1/users/me/reward-store/items`
- `POST /api/v1/users/me/reward-store/items/{item_id}/redeem`
- `GET /api/v1/users/me/reward-store/history`

- `GET /api/v1/users/me/reward-store/items` expects `page`, `pageSize`, optional `search`, and `Authorization: Bearer <access_token>`
- `POST /api/v1/users/me/reward-store/items/{item_id}/redeem` expects no JSON body and requires `Authorization: Bearer <access_token>`
- `GET /api/v1/users/me/reward-store/history` expects `page`, `pageSize`, and `Authorization: Bearer <access_token>`

Notification campaigns:

- `POST /api/v1/admin/notification-campaigns`
- `GET /api/v1/admin/notification-campaigns`
- `GET /api/v1/admin/notification-campaigns/{campaign_id}`
- `PATCH /api/v1/admin/notification-campaigns/{campaign_id}`
- `DELETE /api/v1/admin/notification-campaigns/{campaign_id}`

- `POST /api/v1/admin/notification-campaigns` expects JSON or form-data parsed payload fields:
  - `campaignTitle`
  - `campaignBody`
  - `campaignCategory`
  - `targetAudience`
  - `cityName` when `targetAudience` is `city`
  - `ageGroup` when `targetAudience` is `age_group`
  - `deliveryType`
  - `scheduledAt` when `deliveryType` is `schedule_later`
- `GET /api/v1/admin/notification-campaigns` supports `page`, `pageSize`, `search`, `status`, `campaignCategory`, `targetAudience`, `deliveryType`, `cityName`, `ageGroup`, `scheduledFrom`, `scheduledTo`, `minDeliveryRate`, `maxDeliveryRate`, `sortBy`, and `sortOrder`
- `PATCH /api/v1/admin/notification-campaigns/{campaign_id}` supports the same payload shape as create, with fields optional

Route management:

- `POST /api/v1/admin/routes`
- `GET /api/v1/admin/routes`
- `GET /api/v1/admin/routes/{route_id}`
- `PATCH /api/v1/admin/routes/{route_id}`
- `DELETE /api/v1/admin/routes/{route_id}`
- `GET /api/v1/admin/routes/restaurants/search`

- `POST /api/v1/admin/routes` expects JSON with `routeName` or `name`, `description`, `restaurantIds`, and optional `city`, optional `status`
- `PATCH /api/v1/admin/routes/{route_id}` expects JSON with optional `routeName` or `name`, `description`, optional `city`, `restaurantIds`, and `status`
- `GET /api/v1/admin/routes` supports `page`, `pageSize`, optional `search`, optional `city`, and optional `status`
- `GET /api/v1/admin/routes/restaurants/search` supports optional `city`, optional `search`, plus `page` and `pageSize`
- All selected route restaurants must belong to the same city and have the route feature enabled in their active package

Challenge admin:

- `POST /api/v1/admin/challenges`
- `GET /api/v1/admin/challenges`
- `GET /api/v1/admin/challenges/{challenge_id}`
- `PATCH /api/v1/admin/challenges/{challenge_id}`
- `DELETE /api/v1/admin/challenges/{challenge_id}`
- `GET /api/v1/admin/challenges/{challenge_id}/analytics`

- `POST /api/v1/admin/challenges` expects JSON with `title`, `description`, `rewardPoints`, `startAt`, `endAt`, `criteria`, and optional `status`
- `criteria` items must use one of:
  - `check_in_count`
  - `breakfast_check_ins`
  - `lunch_check_ins`
  - `dinner_check_ins`
- `GET /api/v1/admin/challenges` supports `page`, `pageSize`, optional `search`, and optional `status`
- `PATCH /api/v1/admin/challenges/{challenge_id}` accepts the same payload shape as create, with all fields optional except validation rules that require a valid date range when both dates are provided
- Challenge records include `rewardPoints` and a criteria array so the admin can define check-in-count and meal-window targets
- `GET /api/v1/admin/challenges/{challenge_id}/analytics` returns participation analytics and completion analytics for the selected challenge

Challenge participation:

- `POST /api/v1/users/me/challenges/{challenge_id}/start`
- `GET /api/v1/users/me/challenges`
- `GET /api/v1/users/me/challenges/{participation_id}`
- `POST /api/v1/users/me/challenges/{participation_id}/complete`

- `POST /api/v1/users/me/challenges/{challenge_id}/start` expects no JSON body and requires `Authorization: Bearer <access_token>`
- `GET /api/v1/users/me/challenges` expects `page`, `pageSize`, and `Authorization: Bearer <access_token>`
- `GET /api/v1/users/me/challenges/{participation_id}` expects `Authorization: Bearer <access_token>`
- `POST /api/v1/users/me/challenges/{participation_id}/complete` expects no JSON body and requires `Authorization: Bearer <access_token>`
