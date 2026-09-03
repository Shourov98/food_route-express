# Food Route API Endpoints

Total unique endpoints: 169

## Admin / Admins

- GET /api/v1/admin/admins
- POST /api/v1/admin/admins
- GET /api/v1/admin/admins/{adminId}
- PATCH /api/v1/admin/admins/{adminId}
- POST /api/v1/admin/admins/{adminId}/block
- POST /api/v1/admin/admins/{adminId}/unblock

## Admin / Auth

- POST /api/v1/admin/auth/forgot-password
- POST /api/v1/admin/auth/login
- POST /api/v1/admin/auth/refresh
- POST /api/v1/admin/auth/resend-forgot-otp
- POST /api/v1/admin/auth/reset-password
- POST /api/v1/admin/auth/seed-super-admin
- POST /api/v1/admin/auth/verify-forgot-otp

## Admin / Challenges

- GET /api/v1/admin/challenges
- POST /api/v1/admin/challenges
- DELETE /api/v1/admin/challenges/{challengeId}
- GET /api/v1/admin/challenges/{challengeId}
- PATCH /api/v1/admin/challenges/{challengeId}
- GET /api/v1/admin/challenges/{challengeId}/analytics

## Admin / Change Password

- PATCH /api/v1/admin/change-password

## Admin / Check Ins

- GET /api/v1/admin/check-ins

## Admin / Daily Rewards

- GET /api/v1/admin/daily-rewards
- POST /api/v1/admin/daily-rewards
- DELETE /api/v1/admin/daily-rewards/{rewardId}
- GET /api/v1/admin/daily-rewards/{rewardId}
- PATCH /api/v1/admin/daily-rewards/{rewardId}
- GET /api/v1/admin/daily-rewards/analytics

## Admin / Dashboard

- GET /api/v1/admin/dashboard/summary

## Admin / Levels

- GET /api/v1/admin/levels
- POST /api/v1/admin/levels
- DELETE /api/v1/admin/levels/{levelId}
- GET /api/v1/admin/levels/{levelId}
- PATCH /api/v1/admin/levels/{levelId}
- GET /api/v1/admin/levels/config

## Admin / Notification Campaigns

- GET /api/v1/admin/notification-campaigns
- POST /api/v1/admin/notification-campaigns
- DELETE /api/v1/admin/notification-campaigns/{campaignId}
- GET /api/v1/admin/notification-campaigns/{campaignId}
- PATCH /api/v1/admin/notification-campaigns/{campaignId}

## Admin / Packages

- GET /api/v1/admin/packages/catalog
- GET /api/v1/admin/packages/features
- POST /api/v1/admin/packages/restaurants/{restaurantId}/activate
- POST /api/v1/admin/packages/restaurants/{restaurantId}/upgrade

## Admin / Placements

- POST /api/v1/admin/placements
- DELETE /api/v1/admin/placements/{placementId}
- PATCH /api/v1/admin/placements/{placementId}/toggle
- GET /api/v1/admin/placements/feature/{feature}
- GET /api/v1/admin/placements/features

## Admin / Profile

- GET /api/v1/admin/profile
- PATCH /api/v1/admin/profile
- PATCH /api/v1/admin/profile/image

## Admin / Qr Codes

- GET /api/v1/admin/qr-codes
- GET /api/v1/admin/qr-codes/{restaurantId}
- GET /api/v1/admin/qr-codes/{restaurantId}/image
- GET /api/v1/admin/qr-codes/{restaurantId}/pdf

## Admin / Restaurants

- GET /api/v1/admin/restaurants
- POST /api/v1/admin/restaurants
- DELETE /api/v1/admin/restaurants/{restaurantId}
- GET /api/v1/admin/restaurants/{restaurantId}
- PUT /api/v1/admin/restaurants/{restaurantId}
- GET /api/v1/admin/restaurants/{restaurantId}/menu
- GET /api/v1/admin/restaurants/{restaurantId}/menu/items
- POST /api/v1/admin/restaurants/{restaurantId}/menu/items
- DELETE /api/v1/admin/restaurants/{restaurantId}/menu/items/{itemId}
- GET /api/v1/admin/restaurants/{restaurantId}/menu/items/{itemId}
- PATCH /api/v1/admin/restaurants/{restaurantId}/menu/items/{itemId}

## Admin / Rewards

- GET /api/v1/admin/rewards
- POST /api/v1/admin/rewards
- DELETE /api/v1/admin/rewards/{rewardId}
- GET /api/v1/admin/rewards/{rewardId}
- PATCH /api/v1/admin/rewards/{rewardId}
- GET /api/v1/admin/rewards/analytics

## Admin / Routes

- GET /api/v1/admin/routes
- POST /api/v1/admin/routes
- DELETE /api/v1/admin/routes/{routeId}
- GET /api/v1/admin/routes/{routeId}
- PATCH /api/v1/admin/routes/{routeId}
- GET /api/v1/admin/routes/restaurants/search

## Admin / Spin Wheel

- GET /api/v1/admin/spin-wheel/analytics
- GET /api/v1/admin/spin-wheel/settings
- PATCH /api/v1/admin/spin-wheel/settings

## Admin / Support Requests

- GET /api/v1/admin/support-requests
- GET /api/v1/admin/support-requests/{requestId}

## Admin / Users

- GET /api/v1/admin/users
- GET /api/v1/admin/users/{userId}
- GET /api/v1/admin/users/{userId}/points-history
- POST /api/v1/admin/users/{userId}/block
- PATCH /api/v1/admin/users/{userId}/points
- POST /api/v1/admin/users/{userId}/unblock
- GET /api/v1/admin/users/blocked

## Auth

- POST /api/v1/auth/change-password
- POST /api/v1/auth/forgot-password
- POST /api/v1/auth/login
- POST /api/v1/auth/logout
- POST /api/v1/auth/refresh
- POST /api/v1/auth/register
- POST /api/v1/auth/register-with-referral
- POST /api/v1/auth/resend-forgot-otp
- POST /api/v1/auth/resend-verify-otp
- POST /api/v1/auth/send-password-reset-email
- POST /api/v1/auth/send-verification-email
- POST /api/v1/auth/verify-forgot-otp
- POST /api/v1/auth/verify-otp

## Check Ins

- GET /api/v1/check-ins/history
- POST /api/v1/restaurants/{restaurantId}/receipt
- POST /api/v1/check-ins/scan

## Cms

- GET /api/v1/cms/about-us
- PUT /api/v1/cms/admin/about-us
- GET /api/v1/cms/admin/pages
- POST /api/v1/cms/admin/pages
- DELETE /api/v1/cms/admin/pages/{slug}
- PATCH /api/v1/cms/admin/pages/{slug}
- PUT /api/v1/cms/admin/privacy-policy
- PUT /api/v1/cms/admin/terms-and-conditions
- GET /api/v1/cms/pages/{slug}
- GET /api/v1/cms/privacy-policy
- GET /api/v1/cms/terms-and-conditions
- GET /api/v1/cms/terms-of-service

## Internal / Proximity Alerts

- POST /api/v1/internal/proximity-alerts/scan

## Restaurants

- GET /api/v1/restaurants
- GET /api/v1/restaurants/{restaurantId}
- GET /api/v1/restaurants/{restaurantId}/directions
- GET /api/v1/restaurants/{restaurantId}/menu
- GET /api/v1/restaurants/{restaurantId}/reviews
- POST /api/v1/restaurants/{restaurantId}/reviews
- DELETE /api/v1/restaurants/{restaurantId}/reviews/{reviewId}
- PATCH /api/v1/restaurants/{restaurantId}/reviews/{reviewId}
- GET /api/v1/restaurants/dishes
- POST /api/v1/restaurants/dishes/{itemId}/buy
- GET /api/v1/restaurants/featured
- GET /api/v1/restaurants/nearby

## Rewards

- POST /api/v1/rewards/{rewardId}/redeem

## Support Requests

- POST /api/v1/support-requests

## Users

- GET /api/v1/users/leaderboard

## Users / Challenges

- GET /api/v1/users/me/challenges
- POST /api/v1/users/me/challenges/{challengeId}/start
- GET /api/v1/users/me/challenges/{participationId}
- POST /api/v1/users/me/challenges/{participationId}/complete
- GET /api/v1/users/me/challenges/available

## Users / Favorites

- GET /api/v1/users/me/favorites/restaurants
- PATCH /api/v1/users/me/favorites/restaurants/{restaurantId}

## Users / Image

- PATCH /api/v1/users/me/image

## Users / Notifications

- GET /api/v1/users/me/notifications
- POST /api/v1/users/me/notifications/{notificationId}/read
- GET /api/v1/users/me/notifications/preview
- POST /api/v1/users/me/notifications/read-all
- GET /api/v1/users/me/notifications/unread-count

## Users / Overview

- GET /api/v1/users/me/overview

## Users / Points Summary

- GET /api/v1/users/me/points-summary

## Users / Profile

- GET /api/v1/users/me
- PATCH /api/v1/users/me

## Users / Proximity Scan

- POST /api/v1/users/me/proximity-scan

## Users / Proximity Settings

- GET /api/v1/users/me/proximity-settings
- PATCH /api/v1/users/me/proximity-settings

## Users / Push Token

- POST /api/v1/users/me/push-token

## Users / Ranks

- GET /api/v1/users/me/ranks

## Users / Referral

- GET /api/v1/users/me/referral

## Users / Reward Store

- GET /api/v1/users/me/reward-store/history
- GET /api/v1/users/me/reward-store/items
- POST /api/v1/users/me/reward-store/items/{itemId}/redeem

## Users / Rewards

- GET /api/v1/users/me/rewards
- POST /api/v1/users/me/rewards/{redemptionId}/redeem

## Users / Routes

- GET /api/v1/users/me/routes
- GET /api/v1/users/me/routes/{routeId}

## Users / Social Share Reward

- POST /api/v1/users/me/social-share-reward
- GET /api/v1/users/me/share/check-ins/{checkinId}/preview
- GET /api/v1/users/me/share/rewards/{redemptionId}/preview

## Users / Spins

- POST /api/v1/users/me/spins
- GET /api/v1/users/me/spins/history
- GET /api/v1/users/me/spins/rewards

## Users / Streak

- GET /api/v1/users/me/streak

## Users / Summary

- GET /api/v1/users/me/summary

## Users / Xp History

- GET /api/v1/users/me/xp-history

## Users / Xp Summary

- GET /api/v1/users/me/xp-summary
