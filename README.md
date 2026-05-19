# Food Route Express Backend

This folder contains an Express.js backend in its own directory, separate from the FastAPI backend in `../food_route`.

It keeps Swagger/OpenAPI definitions outside of `route.js` and serves them from dedicated files under `src/docs/`.
The app is being migrated toward native request/response parity with the FastAPI backend, so the frontend/mobile app can eventually switch only the base URL.

## How it works

- `src/modules/auth/` contains the first native service/repository/controller port.
- `src/docs/openapi.js` builds the Swagger schema from the existing API documentation files.
- `src/docs/endpointCatalog.js` adds explicit request-body and query-parameter metadata for common endpoints.
- `src/app.js` serves `/docs` and `/openapi.json`.

## Native Parity Status

Native Express implementation started:

- `GET /api/v1/health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/register-with-referral`
- `POST /api/v1/auth/resend-verify-otp`
- `POST /api/v1/auth/send-verification-email`
- `POST /api/v1/auth/verify-otp`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/resend-forgot-otp`
- `POST /api/v1/auth/send-password-reset-email`
- `POST /api/v1/auth/verify-forgot-otp`
- `POST /api/v1/auth/change-password`
- `POST /api/v1/admin/auth/seed-super-admin`
- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/refresh`
- `POST /api/v1/admin/auth/forgot-password`
- `POST /api/v1/admin/auth/resend-forgot-otp`
- `POST /api/v1/admin/auth/verify-forgot-otp`
- `POST /api/v1/admin/auth/reset-password`
- `PATCH /api/v1/admin/change-password`
- `POST /api/v1/admin/admins`
- `GET /api/v1/admin/admins`
- `GET /api/v1/admin/admins/{admin_id}`
- `PATCH /api/v1/admin/admins/{admin_id}`
- `POST /api/v1/admin/admins/{admin_id}/block`
- `POST /api/v1/admin/admins/{admin_id}/unblock`
- `GET /api/v1/admin/profile`
- `PATCH /api/v1/admin/profile`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/blocked`
- `GET /api/v1/admin/users/{user_id}`
- `PATCH /api/v1/admin/users/{user_id}/points`
- `POST /api/v1/admin/users/{user_id}/block`
- `POST /api/v1/admin/users/{user_id}/unblock`
- `GET /api/v1/admin/check-ins`
- `GET /api/v1/admin/placements/features`
- `GET /api/v1/admin/placements/feature/{feature}`
- `POST /api/v1/admin/placements`
- `DELETE /api/v1/admin/placements/{placement_id}`
- `PATCH /api/v1/admin/placements/{placement_id}/toggle`
- `POST /api/v1/admin/restaurants`
- `PUT /api/v1/admin/restaurants/{restaurant_id}`
- `GET /api/v1/admin/restaurants`
- `GET /api/v1/admin/restaurants/{restaurant_id}`
- `DELETE /api/v1/admin/restaurants/{restaurant_id}`
- `GET /api/v1/admin/restaurants/{restaurant_id}/menu`
- `POST /api/v1/admin/restaurants/{restaurant_id}/menu/items`
- `PATCH /api/v1/admin/restaurants/{restaurant_id}/menu/items/{item_id}`
- `GET /api/v1/admin/restaurants/{restaurant_id}/menu/items`
- `GET /api/v1/admin/restaurants/{restaurant_id}/menu/items/{item_id}`
- `DELETE /api/v1/admin/restaurants/{restaurant_id}/menu/items/{item_id}`
- `POST /api/v1/admin/rewards`
- `PATCH /api/v1/admin/rewards/{reward_id}`
- `GET /api/v1/admin/rewards`
- `GET /api/v1/admin/rewards/{reward_id}`
- `DELETE /api/v1/admin/rewards/{reward_id}`
- `GET /api/v1/admin/rewards/analytics`
- `POST /api/v1/admin/daily-rewards`
- `PATCH /api/v1/admin/daily-rewards/{reward_id}`
- `GET /api/v1/admin/daily-rewards`
- `GET /api/v1/admin/daily-rewards/{reward_id}`
- `DELETE /api/v1/admin/daily-rewards/{reward_id}`
- `GET /api/v1/admin/daily-rewards/analytics`
- `GET /api/v1/admin/qr-codes`
- `GET /api/v1/admin/qr-codes/{restaurant_id}`
- `GET /api/v1/admin/qr-codes/{restaurant_id}/image`
- `GET /api/v1/admin/qr-codes/{restaurant_id}/pdf`
- `POST /api/v1/admin/notification-campaigns`
- `PATCH /api/v1/admin/notification-campaigns/{campaign_id}`
- `GET /api/v1/admin/notification-campaigns`
- `GET /api/v1/admin/notification-campaigns/{campaign_id}`
- `DELETE /api/v1/admin/notification-campaigns/{campaign_id}`
- `POST /api/v1/admin/challenges`
- `GET /api/v1/admin/challenges`
- `GET /api/v1/admin/challenges/{challenge_id}`
- `PATCH /api/v1/admin/challenges/{challenge_id}`
- `DELETE /api/v1/admin/challenges/{challenge_id}`
- `GET /api/v1/admin/challenges/{challenge_id}/analytics`
- `POST /api/v1/admin/routes`
- `GET /api/v1/admin/routes`
- `GET /api/v1/admin/routes/{route_id}`
- `PATCH /api/v1/admin/routes/{route_id}`
- `DELETE /api/v1/admin/routes/{route_id}`
- `GET /api/v1/admin/routes/restaurants/search`
- `POST /api/v1/check-ins/scan`
- `GET /api/v1/check-ins/history`
- `GET /api/v1/users/me/routes`
- `GET /api/v1/users/me/routes/{route_id}`
- `GET /api/v1/users/me/spins/rewards`
- `POST /api/v1/users/me/spins`
- `GET /api/v1/users/me/spins/history`
- `GET /api/v1/admin/spin-wheel/analytics`
- `GET /api/v1/admin/spin-wheel/settings`
- `PATCH /api/v1/admin/spin-wheel/settings`
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
- `POST /api/v1/restaurants/{restaurant_id}/reviews`
- `GET /api/v1/restaurants/{restaurant_id}/reviews`
- `PATCH /api/v1/restaurants/{restaurant_id}/reviews/{review_id}`
- `DELETE /api/v1/restaurants/{restaurant_id}/reviews/{review_id}`
- `POST /api/v1/support-requests`
- `GET /api/v1/users/me`
- `GET /api/v1/users/me/favorites/restaurants`
- `PATCH /api/v1/users/me/favorites/restaurants/{restaurant_id}`
- `POST /api/v1/users/me/challenges/{challenge_id}/start`
- `GET /api/v1/users/me/challenges`
- `GET /api/v1/users/me/challenges/available`
- `GET /api/v1/users/me/challenges/{participation_id}`
- `POST /api/v1/users/me/challenges/{participation_id}/complete`
- `GET /api/v1/users/me/notifications`
- `GET /api/v1/users/me/notifications/preview`
- `GET /api/v1/users/me/notifications/unread-count`
- `POST /api/v1/users/me/notifications/{notification_id}/read`
- `POST /api/v1/users/me/notifications/read-all`
- `GET /api/v1/users/me/overview`
- `PATCH /api/v1/users/me`
- `GET /api/v1/users/me/referral`
- `GET /api/v1/users/me/xp-summary`
- `GET /api/v1/users/me/summary`
- `GET /api/v1/users/me/points-summary`
- `GET /api/v1/users/me/proximity-settings`
- `PATCH /api/v1/users/me/proximity-settings`
- `POST /api/v1/users/me/proximity-scan`
- `POST /api/v1/users/me/push-token`
- `POST /api/v1/users/me/social-share-reward`
- `GET /api/v1/users/me/xp-history`
- `GET /api/v1/users/me/streak`
- `GET /api/v1/users/me/ranks`

Remaining modules still need native ports before `express-backend` can be considered equivalent to `food_route`.

## Environment

Copy `.env.example` to `.env` and set:

- `PORT` for the Express server
- `API_V1_PREFIX` if the API prefix changes
- Firebase and auth settings matching the FastAPI backend

## Development

```bash
npm install
npm run dev
```

Run tests:

```bash
npm test
```

To run both backends together from the repo root:

```bash
docker compose up --build
```

The Express app is intentionally isolated from the FastAPI folder.
