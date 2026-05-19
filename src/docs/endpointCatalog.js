function makeJsonRequestBody({ description, properties, required = [], examples }) {
  const schema = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  const body = {
    required: required.length > 0,
    content: {
      'application/json': {
        schema,
      },
    },
  };

  if (description) {
    body.description = description;
  }

  if (examples) {
    body.content['application/json'].examples = examples;
  }

  return body;
}

function makeMultipartRequestBody({ description, properties, required = [] }) {
  const schema = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  const body = {
    required: required.length > 0,
    content: {
      'multipart/form-data': {
        schema,
      },
    },
  };

  if (description) {
    body.description = description;
  }

  return body;
}

function makeQueryParameters(definitions) {
  return definitions.map((definition) => ({
    name: definition.name,
    in: 'query',
    required: definition.required ?? false,
    description: definition.description,
    schema: definition.schema ?? { type: 'string' },
  }));
}

function stringParam(name, description, required = false) {
  return { name, schema: { type: 'string' }, description, required };
}

function integerParam(name, description, required = false) {
  return { name, schema: { type: 'integer' }, description, required };
}

function numberParam(name, description, required = false) {
  return { name, schema: { type: 'number' }, description, required };
}

function booleanParam(name, description, required = false) {
  return { name, schema: { type: 'boolean' }, description, required };
}

function binaryParam(name, description, required = false) {
  return { name, schema: { type: 'string', format: 'binary' }, description, required };
}

const stringProperty = (description) => ({ type: 'string', description });
const integerProperty = (description, minimum, maximum) => ({
  type: 'integer',
  description,
  minimum,
  maximum,
});
const numberProperty = (description, minimum, maximum) => ({
  type: 'number',
  description,
  minimum,
  maximum,
});
const booleanProperty = (description) => ({ type: 'boolean', description });
const binaryProperty = (description) => ({ type: 'string', format: 'binary', description });

export const endpointCatalog = {
  'POST /api/v1/auth/refresh': {
    requestBody: makeJsonRequestBody({
      description: 'Refresh a user session.',
      required: ['refreshToken'],
      properties: {
        refreshToken: stringProperty('Refresh token returned from login.'),
      },
    }),
  },
  'POST /api/v1/auth/register': {
    requestBody: makeJsonRequestBody({
      description: 'Create a new user account.',
      required: ['fullname', 'email', 'gender', 'dateOfBirth', 'city', 'country', 'password'],
      properties: {
        fullname: stringProperty('User full name.'),
        email: stringProperty('User email address.'),
        gender: stringProperty('User gender.'),
        dateOfBirth: stringProperty('User date of birth in YYYY-MM-DD format.'),
        city: stringProperty('City of residence.'),
        country: stringProperty('Country of residence.'),
        password: stringProperty('Password with minimum length 8.'),
      },
      examples: {
        default: {
          summary: 'Register a user',
          value: {
            fullname: 'Jane Doe',
            email: 'jane@example.com',
            gender: 'female',
            dateOfBirth: '1996-05-14',
            city: 'Dhaka',
            country: 'Bangladesh',
            password: 'Password123',
          },
        },
      },
    }),
  },
  'POST /api/v1/auth/register-with-referral': {
    requestBody: makeJsonRequestBody({
      description: 'Create a new user account with a referral code.',
      required: ['fullname', 'email', 'gender', 'dateOfBirth', 'city', 'country', 'password', 'referralCode'],
      properties: {
        fullname: stringProperty('User full name.'),
        email: stringProperty('User email address.'),
        gender: stringProperty('User gender.'),
        dateOfBirth: stringProperty('User date of birth in YYYY-MM-DD format.'),
        city: stringProperty('City of residence.'),
        country: stringProperty('Country of residence.'),
        password: stringProperty('Password with minimum length 8.'),
        referralCode: stringProperty('8-character uppercase alphanumeric referral code.'),
      },
    }),
  },
  'POST /api/v1/auth/resend-verify-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Resend the registration verification OTP.',
      required: ['email'],
      properties: { email: stringProperty('User email address.') },
    }),
  },
  'POST /api/v1/auth/send-verification-email': {
    requestBody: makeJsonRequestBody({
      description: 'Send a verification email link.',
      required: ['email'],
      properties: { email: stringProperty('User email address.') },
    }),
  },
  'POST /api/v1/auth/verify-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Verify the 4-digit registration OTP.',
      required: ['email', 'otp'],
      properties: {
        email: stringProperty('User email address.'),
        otp: stringProperty('4-digit numeric OTP.'),
      },
    }),
  },
  'POST /api/v1/auth/login': {
    requestBody: makeJsonRequestBody({
      description: 'Authenticate a verified user.',
      required: ['email', 'password'],
      properties: {
        email: stringProperty('User email address.'),
        password: stringProperty('Password with minimum length 8.'),
      },
    }),
  },
  'POST /api/v1/auth/forgot-password': {
    requestBody: makeJsonRequestBody({
      description: 'Begin the forgot-password flow.',
      required: ['email'],
      properties: { email: stringProperty('User email address.') },
    }),
  },
  'POST /api/v1/auth/resend-forgot-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Resend the forgot-password OTP.',
      required: ['email'],
      properties: { email: stringProperty('User email address.') },
    }),
  },
  'POST /api/v1/auth/send-password-reset-email': {
    requestBody: makeJsonRequestBody({
      description: 'Send a password reset email link.',
      required: ['email'],
      properties: { email: stringProperty('User email address.') },
    }),
  },
  'POST /api/v1/auth/verify-forgot-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Verify the forgot-password OTP.',
      required: ['email', 'otp'],
      properties: {
        email: stringProperty('User email address.'),
        otp: stringProperty('4-digit numeric OTP.'),
      },
    }),
  },
  'POST /api/v1/auth/change-password': {
    requestBody: makeJsonRequestBody({
      description: 'Change the password for the authenticated user.',
      required: ['current_password', 'new_password'],
      properties: {
        current_password: stringProperty('Current password.'),
        new_password: stringProperty('New password.'),
      },
    }),
  },
  'PATCH /api/v1/users/me': {
    requestBody: makeMultipartRequestBody({
      description: 'Update the current user profile.',
      properties: {
        fullname: stringProperty('Optional full name.'),
        city: stringProperty('Optional city.'),
        country: stringProperty('Optional country.'),
        image: binaryProperty('Optional profile image upload.'),
      },
    }),
  },
  'PATCH /api/v1/users/me/image': {
    requestBody: makeMultipartRequestBody({
      description: 'Upload a profile image.',
      required: ['image'],
      properties: {
        image: binaryProperty('Profile image upload.'),
      },
    }),
  },
  'PATCH /api/v1/admin/profile/image': {
    requestBody: makeMultipartRequestBody({
      description: 'Upload an admin profile image.',
      required: ['image'],
      properties: {
        image: binaryProperty('Profile image upload.'),
      },
    }),
  },
  'POST /api/v1/admin/auth/login': {
    requestBody: makeJsonRequestBody({
      description: 'Authenticate an admin user.',
      required: ['email', 'password'],
      properties: {
        email: stringProperty('Admin email address.'),
        password: stringProperty('Admin password.'),
      },
    }),
  },
  'POST /api/v1/admin/auth/refresh': {
    requestBody: makeJsonRequestBody({
      description: 'Refresh an admin session.',
      required: ['refreshToken'],
      properties: {
        refreshToken: stringProperty('Refresh token returned from admin login.'),
      },
    }),
  },
  'POST /api/v1/admin/auth/forgot-password': {
    requestBody: makeJsonRequestBody({
      description: 'Begin the admin forgot-password flow.',
      required: ['email'],
      properties: {
        email: stringProperty('Admin email address.'),
      },
    }),
  },
  'POST /api/v1/admin/auth/resend-forgot-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Resend the admin forgot-password OTP.',
      required: ['email'],
      properties: {
        email: stringProperty('Admin email address.'),
      },
    }),
  },
  'POST /api/v1/admin/auth/verify-forgot-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Verify the admin forgot-password OTP.',
      required: ['email', 'otp'],
      properties: {
        email: stringProperty('Admin email address.'),
        otp: stringProperty('4-digit numeric OTP.'),
      },
    }),
  },
  'POST /api/v1/admin/auth/reset-password': {
    requestBody: makeJsonRequestBody({
      description: 'Reset an admin password after OTP verification.',
      required: ['email', 'new_password'],
      properties: {
        email: stringProperty('Admin email address.'),
        new_password: stringProperty('New password with minimum length 8.'),
      },
    }),
  },
  'POST /api/v1/admin/admins': {
    requestBody: makeMultipartRequestBody({
      description: 'Create a new admin account.',
      required: ['fullname', 'email', 'password'],
      properties: {
        fullname: stringProperty('Admin full name.'),
        phone: stringProperty('Optional phone number.'),
        email: stringProperty('Admin email address.'),
        password: stringProperty('Admin password.'),
        confirmPassword: stringProperty('Optional password confirmation.'),
        image: binaryProperty('Optional admin profile image.'),
      },
    }),
  },
  'PATCH /api/v1/admin/admins/{admin_id}': {
    requestBody: makeJsonRequestBody({
      description: 'Update an admin profile.',
      required: ['fullname', 'phone'],
      properties: {
        fullname: stringProperty('Admin full name.'),
        phone: stringProperty('Admin phone number.'),
      },
    }),
  },
  'POST /api/v1/admin/admins/{admin_id}/block': {
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: false, properties: {} },
        },
      },
      description: 'Block an admin without a body.',
    },
  },
  'POST /api/v1/admin/admins/{admin_id}/unblock': {
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: false, properties: {} },
        },
      },
      description: 'Unblock an admin without a body.',
    },
  },
  'PATCH /api/v1/admin/change-password': {
    requestBody: makeJsonRequestBody({
      description: 'Change the current admin password.',
      required: ['current_password', 'new_password'],
      properties: {
        current_password: stringProperty('Current password.'),
        new_password: stringProperty('New password with minimum length 8.'),
      },
    }),
  },
  'PATCH /api/v1/admin/profile': {
    requestBody: makeJsonRequestBody({
      description: 'Update the current admin profile.',
      required: ['fullname', 'phone'],
      properties: {
        fullname: stringProperty('Admin full name.'),
        phone: stringProperty('Admin phone number.'),
      },
    }),
  },
  'GET /api/v1/admin/dashboard/summary': {
    parameters: makeQueryParameters([
      stringParam('range', 'Dashboard summary range.'),
      integerParam('year', 'Optional year for monthly range.'),
      integerParam('month', 'Optional month for monthly range.'),
    ]),
  },
  'POST /api/v1/admin/levels': {
    requestBody: makeJsonRequestBody({
      description: 'Create a level threshold.',
      required: ['name', 'minXp'],
      properties: {
        name: stringProperty('Level name.'),
        minXp: integerProperty('Minimum XP required for the level.', 0, 30_000),
      },
    }),
  },
  'PATCH /api/v1/admin/levels/{level_id}': {
    requestBody: makeJsonRequestBody({
      description: 'Update a level threshold.',
      properties: {
        name: stringProperty('Level name.'),
        minXp: integerProperty('Minimum XP required for the level.', 0, 30_000),
      },
    }),
  },
  'POST /api/v1/admin/restaurants': {
    requestBody: makeMultipartRequestBody({
      description: 'Create a restaurant.',
      required: [
        'name',
        'address',
        'latitude',
        'longitude',
        'category',
        'qrCodeName',
        'qrCodeLatitude',
        'qrCodeLongitude',
        'qrCodeToken',
        'pointsPerCheckIn',
        'image',
      ],
      properties: {
        name: stringProperty('Restaurant name.'),
        address: stringProperty('Restaurant address.'),
        city: stringProperty('Optional restaurant city.'),
        latitude: numberProperty('Restaurant latitude.', -90, 90),
        longitude: numberProperty('Restaurant longitude.', -180, 180),
        category: stringProperty('Restaurant category.'),
        qrCodeName: stringProperty('QR code label.'),
        qrCodeLatitude: numberProperty('QR code latitude.', -90, 90),
        qrCodeLongitude: numberProperty('QR code longitude.', -180, 180),
        qrCodeToken: stringProperty('QR token string.'),
        pointsPerCheckIn: integerProperty('Points granted for a check-in.', 0, 10000),
        image: binaryProperty('Restaurant image upload.'),
      },
    }),
  },
  'PUT /api/v1/admin/restaurants/{restaurant_id}': {
    requestBody: makeMultipartRequestBody({
      description: 'Update a restaurant.',
      required: [
        'name',
        'address',
        'latitude',
        'longitude',
        'category',
        'qrCodeName',
        'qrCodeLatitude',
        'qrCodeLongitude',
        'qrCodeToken',
        'pointsPerCheckIn',
      ],
      properties: {
        name: stringProperty('Restaurant name.'),
        address: stringProperty('Restaurant address.'),
        city: stringProperty('Optional restaurant city.'),
        latitude: numberProperty('Restaurant latitude.', -90, 90),
        longitude: numberProperty('Restaurant longitude.', -180, 180),
        category: stringProperty('Restaurant category.'),
        qrCodeName: stringProperty('QR code label.'),
        qrCodeLatitude: numberProperty('QR code latitude.', -90, 90),
        qrCodeLongitude: numberProperty('QR code longitude.', -180, 180),
        qrCodeToken: stringProperty('QR token string.'),
        pointsPerCheckIn: integerProperty('Points granted for a check-in.', 0, 10000),
        imageUrl: stringProperty('Existing image URL when no replacement image is uploaded.'),
        image: binaryProperty('Optional replacement restaurant image upload.'),
      },
    }),
  },
  'POST /api/v1/admin/restaurants/{restaurant_id}/menu/items': {
    requestBody: makeMultipartRequestBody({
      description: 'Create a menu item.',
      required: ['name', 'description', 'price', 'pointsToBuy'],
      properties: {
        name: stringProperty('Menu item name.'),
        description: stringProperty('Menu item description.'),
        price: numberProperty('Menu item price.', 0, 100000),
        pointsToBuy: integerProperty('Points required to buy the item.', 0, 1000000),
        isAvailable: booleanProperty('Whether the item is currently available.'),
        image: binaryProperty('Optional menu item image upload.'),
      },
    }),
  },
  'PATCH /api/v1/admin/restaurants/{restaurant_id}/menu/items/{item_id}': {
    requestBody: makeMultipartRequestBody({
      description: 'Update a menu item.',
      properties: {
        name: stringProperty('Updated menu item name.'),
        description: stringProperty('Updated menu item description.'),
        price: numberProperty('Updated menu item price.', 0, 100000),
        pointsToBuy: integerProperty('Updated points required to buy the item.', 0, 1000000),
        imageUrl: stringProperty('Replacement image URL when not uploading a new image.'),
        isAvailable: booleanProperty('Whether the item is currently available.'),
        image: binaryProperty('Optional replacement menu item image upload.'),
      },
    }),
  },
  'GET /api/v1/users/me/proximity-settings': {
    description: 'Get the current user proximity notification settings.',
  },
  'PATCH /api/v1/users/me/proximity-settings': {
    requestBody: makeJsonRequestBody({
      description: 'Update proximity notification settings.',
      properties: {
        distanceInMeter: numberProperty('Minimum distance in meters.', 1, 100000),
        enabled: booleanProperty('Whether proximity alerts are enabled.'),
      },
    }),
  },
  'POST /api/v1/users/me/proximity-scan': {
    requestBody: makeJsonRequestBody({
      description: 'Trigger a proximity alert scan using the user’s current coordinates.',
      required: ['latitude', 'longitude'],
      properties: {
        latitude: numberProperty('Current user latitude.', -90, 90),
        longitude: numberProperty('Current user longitude.', -180, 180),
      },
    }),
  },
  'POST /api/v1/internal/proximity-alerts/scan': {
    description: 'Run a scheduled proximity scan for all users. Requires X-Internal-Job-Secret header.',
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: false, properties: {} },
        },
      },
      description: 'No body required. Authenticate via X-Internal-Job-Secret header.',
    },
  },
  'POST /api/v1/users/me/spins': {
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: false, properties: {} },
        },
      },
      description: 'Spin the daily reward wheel without a body.',
    },
  },
  'POST /api/v1/check-ins/scan': {
    requestBody: makeJsonRequestBody({
      description: 'Scan a restaurant QR token or QR payload.',
      required: ['qrToken'],
      properties: {
        qrToken: stringProperty('Restaurant QR token or encoded QR payload string.'),
      },
    }),
  },
  'GET /api/v1/check-ins/history': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
  },
  'GET /api/v1/admin/check-ins': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
  },
  'GET /api/v1/admin/qr-codes': {},
  'GET /api/v1/admin/qr-codes/{restaurant_id}': {},
  'GET /api/v1/admin/qr-codes/{restaurant_id}/image': {},
  'GET /api/v1/admin/qr-codes/{restaurant_id}/pdf': {},
  'GET /api/v1/users/me/spins/history': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
  },
  'PATCH /api/v1/admin/spin-wheel/settings': {
    requestBody: makeJsonRequestBody({
      description: 'Update spin-wheel settings.',
      required: ['resetLogic', 'resetTimeUtc'],
      properties: {
        resetLogic: stringProperty('Spin reset logic: daily or manual.'),
        resetTimeUtc: stringProperty('UTC reset time in HH:MM format.'),
        noRewardProbability: integerProperty('No-reward probability weight.', 0, 100),
      },
    }),
  },
  'GET /api/v1/admin/rewards': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('status', 'Optional status filter.'),
      booleanParam('isActive', 'Optional active-state filter.'),
      booleanParam('hasExpiry', 'Optional expiry flag filter.'),
      integerParam('minPoints', 'Optional minimum points filter.'),
      integerParam('maxPoints', 'Optional maximum points filter.'),
      stringParam('expiresFrom', 'Optional ISO start expiry filter.'),
      stringParam('expiresTo', 'Optional ISO end expiry filter.'),
      stringParam('sortBy', 'Optional sort field.'),
      stringParam('sortOrder', 'Optional sort order.'),
    ]),
  },
  'GET /api/v1/admin/daily-rewards': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('status', 'Optional status filter.'),
      booleanParam('isActive', 'Optional active-state filter.'),
      booleanParam('hasExpiry', 'Optional expiry flag filter.'),
      stringParam('expiresFrom', 'Optional ISO start expiry filter.'),
      stringParam('expiresTo', 'Optional ISO end expiry filter.'),
      stringParam('sortBy', 'Optional sort field.'),
      stringParam('sortOrder', 'Optional sort order.'),
    ]),
  },
  'GET /api/v1/rewards': {
    description: 'List rewards available for the authenticated end-user to redeem.',
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      integerParam('minPoints', 'Optional minimum points filter.'),
      integerParam('maxPoints', 'Optional maximum points filter.'),
      stringParam('sortBy', 'Optional sort field.'),
      stringParam('sortOrder', 'Optional sort order.'),
    ]),
  },
  'GET /api/v1/users/leaderboard': {
    parameters: makeQueryParameters([
      { name: 'scope', required: true, description: 'Leaderboard scope.', schema: { type: 'string', enum: ['local', 'national'] } },
      { name: 'period', required: true, description: 'Leaderboard period.', schema: { type: 'string', enum: ['weekly', 'monthly'] } },
    ]),
  },
  'GET /api/v1/users/me/reward-store': {
    description: 'List a combined reward store catalog for the authenticated user, merging rewards and restaurant dishes sorted by name.',
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
    ]),
  },
  'GET /api/v1/restaurants': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('city', 'Optional city filter.'),
      numberParam('latitude', 'Optional latitude.'),
      numberParam('longitude', 'Optional longitude.'),
    ]),
  },
  'GET /api/v1/restaurants/featured': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('city', 'Optional city filter.'),
      numberParam('latitude', 'Optional latitude.'),
      numberParam('longitude', 'Optional longitude.'),
    ]),
  },
  'GET /api/v1/restaurants/{restaurant_id}': {
    parameters: makeQueryParameters([
      numberParam('latitude', 'Optional latitude.'),
      numberParam('longitude', 'Optional longitude.'),
    ]),
  },
  'POST /api/v1/restaurants/{restaurant_id}/reviews': {
    requestBody: makeJsonRequestBody({
      description: 'Create a restaurant review.',
      required: ['rating'],
      properties: {
        rating: integerProperty('Rating from 1 to 5.', 1, 5),
        comment: stringProperty('Optional review comment.'),
      },
    }),
  },
  'GET /api/v1/restaurants/{restaurant_id}/reviews': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
  },
  'PATCH /api/v1/restaurants/{restaurant_id}/reviews/{review_id}': {
    requestBody: makeJsonRequestBody({
      description: 'Update a restaurant review.',
      properties: {
        rating: integerProperty('Rating from 1 to 5.', 1, 5),
        comment: stringProperty('Optional review comment.'),
      },
    }),
  },
  'GET /api/v1/users/me/favorites/restaurants': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('city', 'Optional city filter.'),
      numberParam('latitude', 'Optional latitude.'),
      numberParam('longitude', 'Optional longitude.'),
    ]),
  },
  'POST /api/v1/support-requests': {
    requestBody: makeJsonRequestBody({
      description: 'Create a support request.',
      required: ['title', 'message'],
      properties: {
        title: stringProperty('Support request title.'),
        message: stringProperty('Support request message.'),
      },
    }),
  },
  'GET /api/v1/admin/support-requests': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
  },
  'GET /api/v1/admin/notification-campaigns': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('status', 'Optional campaign status filter.'),
      stringParam('campaignCategory', 'Optional campaign category filter.'),
      stringParam('targetAudience', 'Optional target audience filter.'),
      stringParam('deliveryType', 'Optional delivery type filter.'),
      stringParam('cityName', 'Optional target city filter.'),
      stringParam('ageGroup', 'Optional target age group filter.'),
      stringParam('scheduledFrom', 'Optional ISO start schedule filter.'),
      stringParam('scheduledTo', 'Optional ISO end schedule filter.'),
      numberParam('minDeliveryRate', 'Optional minimum delivery rate filter.'),
      numberParam('maxDeliveryRate', 'Optional maximum delivery rate filter.'),
      stringParam('sortBy', 'Optional sort field.'),
      stringParam('sortOrder', 'Optional sort order.'),
    ]),
  },
  'POST /api/v1/admin/challenges': {
    requestBody: makeJsonRequestBody({
      description: 'Create a challenge.',
      required: ['title', 'description', 'rewardPoints', 'startAt', 'endAt', 'criteria'],
      properties: {
        title: stringProperty('Challenge title.'),
        description: stringProperty('Challenge description.'),
        rewardPoints: integerProperty('Reward points.', 0, 1_000_000),
        rewardId: stringProperty('Optional reward ID unlocked on completion.'),
        startAt: stringProperty('Challenge start timestamp.'),
        endAt: stringProperty('Challenge end timestamp.'),
        status: stringProperty('Optional challenge status.'),
        criteria: {
          type: 'array',
          description: 'Challenge criteria definitions.',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              requiredCount: { type: 'integer', minimum: 1, maximum: 1_000_000 },
            },
          },
        },
      },
    }),
  },
  'GET /api/v1/admin/challenges': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('status', 'Optional challenge status filter.'),
    ]),
  },
  'PATCH /api/v1/admin/challenges/{challenge_id}': {
    requestBody: makeJsonRequestBody({
      description: 'Update a challenge.',
      properties: {
        title: stringProperty('Challenge title.'),
        description: stringProperty('Challenge description.'),
        rewardPoints: integerProperty('Reward points.', 0, 1_000_000),
        rewardId: stringProperty('Optional reward ID unlocked on completion.'),
        startAt: stringProperty('Challenge start timestamp.'),
        endAt: stringProperty('Challenge end timestamp.'),
        status: stringProperty('Optional challenge status.'),
        criteria: {
          type: 'array',
          description: 'Challenge criteria definitions.',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              requiredCount: { type: 'integer', minimum: 1, maximum: 1_000_000 },
            },
          },
        },
      },
    }),
  },
  'GET /api/v1/users/me/challenges': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
  },
  'GET /api/v1/users/me/challenges/available': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
    ]),
  },
  'POST /api/v1/admin/auth/seed-super-admin': {
    requestBody: makeJsonRequestBody({
      description: 'Seed the initial super admin user. Body is optional when env vars are present.',
      properties: {
        fullname: stringProperty('Super admin full name.'),
        phone: stringProperty('Phone number.'),
        email: stringProperty('Email address.'),
        password: stringProperty('Password.'),
      },
    }),
  },
  'POST /api/v1/admin/users/{user_id}/block': {
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: false, properties: {} },
        },
      },
      description: 'Block a user without a body.',
    },
  },
  'POST /api/v1/admin/users/{user_id}/unblock': {
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: false, properties: {} },
        },
      },
      description: 'Unblock a user without a body.',
    },
  },
  'PATCH /api/v1/admin/users/{user_id}/points': {
    requestBody: makeJsonRequestBody({
      description: 'Adjust a user points balance.',
      required: ['pointsDelta'],
      properties: {
        pointsDelta: integerProperty('Points delta to add or subtract.', -1_000_000, 1_000_000),
      },
    }),
  },
  'POST /api/v1/admin/restaurants': {
    requestBody: makeMultipartRequestBody({
      description: 'Create a restaurant.',
      required: ['image'],
      properties: {
        name: stringProperty('Restaurant name.'),
        description: stringProperty('Restaurant description.'),
        city: stringProperty('City.'),
        address: stringProperty('Address.'),
        latitude: numberProperty('Latitude.'),
        longitude: numberProperty('Longitude.'),
        category: stringProperty('Restaurant category.'),
        image: binaryProperty('Restaurant image upload.'),
      },
    }),
  },
  'PUT /api/v1/admin/restaurants/{restaurant_id}': {
    requestBody: makeMultipartRequestBody({
      description: 'Update a restaurant.',
      properties: {
        name: stringProperty('Restaurant name.'),
        description: stringProperty('Restaurant description.'),
        city: stringProperty('City.'),
        address: stringProperty('Address.'),
        latitude: numberProperty('Latitude.'),
        longitude: numberProperty('Longitude.'),
        category: stringProperty('Restaurant category.'),
        image: binaryProperty('Restaurant image upload.'),
      },
    }),
  },
  'POST /api/v1/admin/restaurants/{restaurant_id}/menu/items': {
    requestBody: makeMultipartRequestBody({
      description: 'Create a restaurant menu item.',
      required: ['name', 'description', 'price', 'pointsToBuy', 'isAvailable'],
      properties: {
        name: stringProperty('Menu item name.'),
        description: stringProperty('Menu item description.'),
        price: numberProperty('Item price.', 0, 1_000_000),
        pointsToBuy: integerProperty('Points needed to buy this item.', 0, 1_000_000),
        isAvailable: booleanProperty('Whether the item is available.'),
        image: binaryProperty('Optional menu item image.'),
      },
    }),
  },
  'PATCH /api/v1/admin/restaurants/{restaurant_id}/menu/items/{item_id}': {
    requestBody: makeMultipartRequestBody({
      description: 'Update a restaurant menu item.',
      properties: {
        name: stringProperty('Menu item name.'),
        description: stringProperty('Menu item description.'),
        price: numberProperty('Item price.', 0, 1_000_000),
        pointsToBuy: integerProperty('Points needed to buy this item.', 0, 1_000_000),
        isAvailable: booleanProperty('Whether the item is available.'),
        imageUrl: stringProperty('Existing image URL to keep.'),
        image: binaryProperty('Optional replacement image.'),
      },
    }),
  },
  'POST /api/v1/admin/daily-rewards': {
    requestBody: makeMultipartRequestBody({
      description: 'Create a daily reward.',
      required: ['discountPercentage', 'quantityAvailable', 'probability'],
      properties: {
        discountPercentage: integerProperty('Discount percentage.', 0, 1_000_000),
        quantityAvailable: integerProperty('Quantity available.', 0, 1_000_000),
        probability: integerProperty('Probability weight.', 0, 100),
        isActive: booleanProperty('Whether reward is active.'),
        hasExpiry: booleanProperty('Whether reward has an expiry date.'),
        expiresAt: stringProperty('ISO timestamp for expiry.'),
        image: binaryProperty('Optional reward image.'),
      },
    }),
  },
  'PATCH /api/v1/admin/daily-rewards/{reward_id}': {
    requestBody: makeMultipartRequestBody({
      description: 'Update a daily reward.',
      properties: {
        discountPercentage: integerProperty('Discount percentage.', 0, 1_000_000),
        quantityAvailable: integerProperty('Quantity available.', 0, 1_000_000),
        probability: integerProperty('Probability weight.', 0, 100),
        isActive: booleanProperty('Whether reward is active.'),
        hasExpiry: booleanProperty('Whether reward has an expiry date.'),
        expiresAt: stringProperty('ISO timestamp for expiry.'),
        image: binaryProperty('Optional replacement image.'),
      },
    }),
  },
  'POST /api/v1/admin/rewards': {
    requestBody: makeMultipartRequestBody({
      description: 'Create a reward catalog item.',
      required: ['title', 'description', 'pointsRequired', 'quantityAvailable', 'rewardCategory'],
      properties: {
        title: stringProperty('Reward item title selected from the catalog.'),
        description: stringProperty('Reward description.'),
        pointsRequired: integerProperty('Points required.', 0, 1_000_000),
        quantityAvailable: integerProperty('Quantity available.', 0, 1_000_000),
        rewardCategory: stringProperty('Structured reward category key.'),
        isActive: booleanProperty('Whether reward is active.'),
        hasExpiry: booleanProperty('Whether reward has expiry.'),
        expiresAt: stringProperty('ISO timestamp for expiry.'),
        image: binaryProperty('Optional reward image.'),
      },
    }),
  },
  'PATCH /api/v1/admin/rewards/{reward_id}': {
    requestBody: makeMultipartRequestBody({
      description: 'Update a reward catalog item.',
      properties: {
        title: stringProperty('Reward item title selected from the catalog.'),
        description: stringProperty('Reward description.'),
        pointsRequired: integerProperty('Points required.', 0, 1_000_000),
        quantityAvailable: integerProperty('Quantity available.', 0, 1_000_000),
        rewardCategory: stringProperty('Structured reward category key.'),
        isActive: booleanProperty('Whether reward is active.'),
        hasExpiry: booleanProperty('Whether reward has expiry.'),
        expiresAt: stringProperty('ISO timestamp for expiry.'),
        image: binaryProperty('Optional replacement image.'),
      },
    }),
  },
  'POST /api/v1/admin/notification-campaigns': {
    requestBody: makeJsonRequestBody({
      description: 'Create a notification campaign.',
      required: ['campaignTitle', 'campaignBody', 'campaignCategory', 'targetAudience', 'deliveryType'],
      properties: {
        campaignTitle: stringProperty('Campaign title.'),
        campaignBody: stringProperty('Campaign body.'),
        campaignCategory: stringProperty('Campaign category.'),
        targetAudience: stringProperty('Target audience.'),
        cityName: stringProperty('City name, required for city audience.'),
        ageGroup: stringProperty('Age group, required for age-group audience.'),
        deliveryType: stringProperty('Delivery type.'),
        scheduledAt: stringProperty('ISO timestamp, required for scheduled delivery.'),
      },
    }),
  },
  'PATCH /api/v1/admin/notification-campaigns/{campaign_id}': {
    requestBody: makeJsonRequestBody({
      description: 'Update a notification campaign.',
      properties: {
        campaignTitle: stringProperty('Campaign title.'),
        campaignBody: stringProperty('Campaign body.'),
        campaignCategory: stringProperty('Campaign category.'),
        targetAudience: stringProperty('Target audience.'),
        cityName: stringProperty('City name, required for city audience.'),
        ageGroup: stringProperty('Age group, required for age-group audience.'),
        deliveryType: stringProperty('Delivery type.'),
        scheduledAt: stringProperty('ISO timestamp, required for scheduled delivery.'),
        status: stringProperty('Optional campaign status.'),
        deliveryRate: numberProperty('Optional delivery rate percentage.', 0, 100),
      },
    }),
  },
  'GET /api/v1/users/me/notifications': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('category', 'Optional notification category filter.'),
    ]),
  },
  'GET /api/v1/users/me/notifications/preview': {
    parameters: makeQueryParameters([
      integerParam('limit', 'Preview item limit.'),
    ]),
  },
  'PUT /api/v1/cms/admin/about-us': {
    requestBody: makeJsonRequestBody({
      description: 'Upsert the About Us CMS page.',
      properties: {
        title: stringProperty('Optional page title.'),
        content: stringProperty('HTML or rich-text page content.'),
      },
    }),
  },
  'PUT /api/v1/cms/admin/privacy-policy': {
    requestBody: makeJsonRequestBody({
      description: 'Upsert the Privacy Policy CMS page.',
      properties: {
        title: stringProperty('Optional page title.'),
        content: stringProperty('HTML or rich-text page content.'),
      },
    }),
  },
  'PUT /api/v1/cms/admin/terms-and-conditions': {
    requestBody: makeJsonRequestBody({
      description: 'Upsert the Terms and Conditions CMS page.',
      properties: {
        title: stringProperty('Optional page title.'),
        content: stringProperty('HTML or rich-text page content.'),
      },
    }),
  },
  'POST /api/v1/cms/admin/pages': {
    requestBody: makeJsonRequestBody({
      description: 'Create a CMS page.',
      required: ['slug', 'title'],
      properties: {
        slug: stringProperty('URL slug for the CMS page.'),
        title: stringProperty('Page title.'),
        content: stringProperty('HTML or rich-text page content.'),
      },
    }),
  },
  'PATCH /api/v1/cms/admin/pages/{slug}': {
    requestBody: makeJsonRequestBody({
      description: 'Update a CMS page.',
      properties: {
        title: stringProperty('Page title.'),
        content: stringProperty('HTML or rich-text page content.'),
      },
    }),
  },
  'POST /api/v1/users/me/push-token': {
    requestBody: makeJsonRequestBody({
      description:
        'Register the current user push token or OneSignal subscription id used for push delivery.',
      required: ['pushToken'],
      properties: {
        pushToken: stringProperty(
          'Push notification token. When using OneSignal, send the OneSignal subscription id here.',
        ),
        subscriptionId: stringProperty(
          'Optional alias for pushToken when using OneSignal subscription ids.',
        ),
        platform: stringProperty('Optional platform, such as ios or android.'),
        provider: stringProperty('Optional provider label, such as onesignal or firebase.'),
      },
    }),
  },
  'POST /api/v1/users/me/social-share-reward': {
    requestBody: makeJsonRequestBody({
      description: 'Claim the social-share reward for a unique share action.',
      required: ['shareId'],
      properties: {
        shareId: stringProperty('Unique idempotent share identifier from the client.'),
        platform: stringProperty('Optional social platform name.'),
        shareUrl: stringProperty('Optional shared URL.'),
      },
    }),
  },
  'POST /api/v1/admin/packages/restaurants/{restaurant_id}/activate': {
    requestBody: makeJsonRequestBody({
      description: 'Activate a restaurant package.',
      required: ['package'],
      properties: {
        package: stringProperty('Package key such as start, active, pro, prime, or dominio.'),
      },
    }),
  },
  'POST /api/v1/admin/packages/restaurants/{restaurant_id}/upgrade': {
    requestBody: makeJsonRequestBody({
      description: 'Upgrade a restaurant package.',
      required: ['package'],
      properties: {
        package: stringProperty('Target package key such as start, active, pro, prime, or dominio.'),
      },
    }),
  },
  'POST /api/v1/admin/routes': {
    requestBody: makeJsonRequestBody({
      description: 'Create a route.',
      required: ['description', 'restaurantIds'],
      properties: {
        routeName: stringProperty('Route name.'),
        name: stringProperty('Route name alias.'),
        description: stringProperty('Route description.'),
        city: stringProperty('Optional route city label. When omitted, the backend derives it from selected restaurants.'),
        restaurantIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ordered restaurant IDs included in the route.',
        },
        status: stringProperty('Optional route status.'),
      },
    }),
  },
  'PATCH /api/v1/admin/routes/{route_id}': {
    requestBody: makeJsonRequestBody({
      description: 'Update a route.',
      properties: {
        routeName: stringProperty('Route name.'),
        name: stringProperty('Route name alias.'),
        description: stringProperty('Route description.'),
        city: stringProperty('Optional route city label override.'),
        restaurantIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional ordered restaurant IDs included in the route.',
        },
        status: stringProperty('Optional route status.'),
      },
    }),
  },
  'GET /api/v1/admin/routes': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('city', 'Optional city filter.'),
      stringParam('status', 'Optional route status filter.'),
    ]),
  },
  'GET /api/v1/admin/routes/restaurants/search': {
    parameters: makeQueryParameters([
      stringParam('city', 'Optional city filter.'),
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
    ]),
  },
  'GET /api/v1/users/me/routes': {
    description: 'List routes available for the authenticated user. No request body.',
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
    ]),
  },
  'GET /api/v1/users/me/routes/{routeId}': {
    description: 'Get one route available for the authenticated user. No request body.',
  },
  'POST /api/v1/admin/placements': {
    requestBody: makeJsonRequestBody({
      description: 'Assign a restaurant placement feature.',
      required: ['feature', 'restaurantId'],
      properties: {
        feature: stringProperty('Placement feature.'),
        restaurantId: stringProperty('Restaurant ID.'),
        sortOrder: integerProperty('Sort order.', 0, 1_000_000),
        active: booleanProperty('Whether placement is active.'),
      },
    }),
  },
  'PATCH /api/v1/admin/placements/{placement_id}/toggle': {
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: false, properties: {} },
        },
      },
      description: 'Toggle a placement without a body.',
    },
  },
  'GET /api/v1/admin/placements/feature/{feature}': {},
  'GET /api/v1/admin/placements/features': {},
};

function normalizeCatalogKey(method, path) {
  const normalizedPath = path.replace(/\{[^}]+\}/g, '{}');
  return `${method.toUpperCase()} ${normalizedPath}`;
}

export function getEndpointCatalogEntry(method, path) {
  const exactKey = `${method.toUpperCase()} ${path}`;
  if (endpointCatalog[exactKey]) {
    return endpointCatalog[exactKey];
  }

  const normalizedKey = normalizeCatalogKey(method, path);
  for (const [catalogKey, entry] of Object.entries(endpointCatalog)) {
    const [catalogMethod, ...catalogPathParts] = catalogKey.split(' ');
    const catalogPath = catalogPathParts.join(' ');
    if (normalizeCatalogKey(catalogMethod, catalogPath) === normalizedKey) {
      return entry;
    }
  }

  return undefined;
}
