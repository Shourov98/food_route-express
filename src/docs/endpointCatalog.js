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

function stringEnumParam(name, description, allowed, required = false) {
  return { name, schema: { type: 'string', enum: allowed }, description, required };
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

// Response helpers used throughout the catalog. Each builds an OpenAPI
// `responses[status]` entry. Callers can override description / add examples
// inline after the call.

function successEnvelope(dataRef, description, example) {
  const content = {
    'application/json': {
      schema: { $ref: `#/components/schemas/${dataRef}` },
    },
  };
  if (example) content['application/json'].example = example;
  return {
    description: description ?? 'Successful response',
    content,
  };
}

function messageEnvelope(description = 'Operation completed.', example) {
  const content = {
    'application/json': {
      schema: { $ref: '#/components/schemas/MessageResponse' },
    },
  };
  if (example) content['application/json'].example = example;
  return { description, content };
}

function paginatedEnvelope(itemRef, description, example) {
  const content = {
    'application/json': {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['items', 'pagination'],
        properties: {
          items: { type: 'array', items: { $ref: `#/components/schemas/${itemRef}` } },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },
    },
  };
  if (example) content['application/json'].example = example;
  return { description: description ?? 'Paginated list response.', content };
}

function rawJson(schema, description, example) {
  const content = { 'application/json': { schema } };
  if (example) content['application/json'].example = example;
  return { description: description ?? 'Successful response', content };
}

function binaryResponse(mediaType, description) {
  return {
    description: description ?? `Binary ${mediaType} payload.`,
    content: { [mediaType]: { schema: { type: 'string', format: 'binary' } } },
  };
}

export const endpointCatalog = {
  'POST /api/v1/auth/refresh': {
    requestBody: makeJsonRequestBody({
      description: 'Refresh a user session.',
      required: ['refreshToken'],
      properties: {
        refreshToken: stringProperty('Refresh token returned from login.'),
      },
    }),
    responses: {
      "200": {
        "description": "Login session.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/AuthSession"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "email": "jane@example.com",
                "role": "user",
                "is_verified": true,
                "access_token": "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI4d3ZoY29xY1RFWGJSazlWMVZ6Y0J2NG9vbTIifQ.signature",
                "refresh_token": "AEwRxG_LwZ4oexampleRefreshTokenValue1234567890",
                "expires_in": 3600
              },
              "message": "OK"
            }
          }
        }
      }
},},
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
            city: 'Mexico City',
            country: 'Mexico',
            password: 'Password123',
          },
        },
      },
    }),
    responses: {
      "200": {
        "description": "Login session.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/AuthSession"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "email": "jane@example.com",
                "role": "user",
                "is_verified": true,
                "access_token": "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI4d3ZoY29xY1RFWGJSazlWMVZ6Y0J2NG9vbTIifQ.signature",
                "refresh_token": "AEwRxG_LwZ4oexampleRefreshTokenValue1234567890",
                "expires_in": 3600
              },
              "message": "OK"
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Login session.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/AuthSession"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "email": "jane@example.com",
                "role": "user",
                "is_verified": true,
                "access_token": "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI4d3ZoY29xY1RFWGJSazlWMVZ6Y0J2NG9vbTIifQ.signature",
                "refresh_token": "AEwRxG_LwZ4oexampleRefreshTokenValue1234567890",
                "expires_in": 3600
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/auth/resend-verify-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Resend the registration verification OTP.',
      required: ['email'],
      properties: { email: stringProperty('User email address.') },
    }),
    responses: {
      "200": {
        "description": "Operation completed.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "OTP resent."
            }
          }
        }
      }
},},
  'POST /api/v1/auth/send-verification-email': {
    requestBody: makeJsonRequestBody({
      description: 'Send a verification email link.',
      required: ['email'],
      properties: { email: stringProperty('User email address.') },
    }),
    responses: {
      "200": {
        "description": "Operation completed.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "Verification email sent."
            }
          }
        }
      }
},},
  'POST /api/v1/auth/verify-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Verify the 4-digit registration OTP.',
      required: ['email', 'otp'],
      properties: {
        email: stringProperty('User email address.'),
        otp: stringProperty('4-digit numeric OTP.'),
      },
    }),
    responses: {
      "200": {
        "description": "Verified user.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/User"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "fullname": "Jane Doe",
                "email": "jane@example.com",
                "gender": "female",
                "age": 30,
                "dateOfBirth": "1996-05-14",
                "city": "Mexico City",
                "country": "Mexico",
                "profileImageUrl": null,
                "referralCode": "ABC12345",
                "referredByUid": null,
                "role": "user",
                "isVerified": true,
                "isBlocked": false,
                "createdAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/auth/login': {
    requestBody: makeJsonRequestBody({
      description: 'Authenticate a verified user.',
      required: ['email', 'password'],
      properties: {
        email: stringProperty('User email address.'),
        password: stringProperty('Password with minimum length 8.'),
      },
    }),
    responses: {
      "200": {
        "description": "Login session.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/AuthSession"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "email": "jane@example.com",
                "role": "user",
                "is_verified": true,
                "access_token": "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI4d3ZoY29xY1RFWGJSazlWMVZ6Y0J2NG9vbTIifQ.signature",
                "refresh_token": "AEwRxG_LwZ4oexampleRefreshTokenValue1234567890",
                "expires_in": 3600
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/auth/forgot-password': {
    requestBody: makeJsonRequestBody({
      description: 'Begin the forgot-password flow.',
      required: ['email'],
      properties: { email: stringProperty('User email address.') },
    }),
    responses: {
      "200": {
        "description": "Operation completed.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "Forgot-password email sent."
            }
          }
        }
      }
},},
  'POST /api/v1/auth/resend-forgot-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Resend the forgot-password OTP.',
      required: ['email'],
      properties: { email: stringProperty('User email address.') },
    }),
    responses: {
      "200": {
        "description": "Operation completed.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "Forgot-password OTP resent."
            }
          }
        }
      }
},},
  'POST /api/v1/auth/send-password-reset-email': {
    requestBody: makeJsonRequestBody({
      description: 'Send a password reset email link.',
      required: ['email'],
      properties: { email: stringProperty('User email address.') },
    }),
    responses: {
      "200": {
        "description": "Operation completed.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "Reset email sent."
            }
          }
        }
      }
},},
  'POST /api/v1/auth/verify-forgot-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Verify the forgot-password OTP.',
      required: ['email', 'otp'],
      properties: {
        email: stringProperty('User email address.'),
        otp: stringProperty('4-digit numeric OTP.'),
      },
    }),
    responses: {
      "200": {
        "description": "Verified user.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/User"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "fullname": "Jane Doe",
                "email": "jane@example.com",
                "gender": "female",
                "age": 30,
                "dateOfBirth": "1996-05-14",
                "city": "Mexico City",
                "country": "Mexico",
                "profileImageUrl": null,
                "referralCode": "ABC12345",
                "referredByUid": null,
                "role": "user",
                "isVerified": true,
                "isBlocked": false,
                "createdAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/auth/change-password': {
    requestBody: makeJsonRequestBody({
      description: 'Change the password for the authenticated user.',
      required: ['current_password', 'new_password'],
      properties: {
        current_password: stringProperty('Current password.'),
        new_password: stringProperty('New password.'),
      },
    }),
    responses: {
      "200": {
        "description": "Operation completed.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "Password changed."
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Updated profile.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/User"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "fullname": "Jane Doe",
                "email": "jane@example.com",
                "gender": "female",
                "age": 30,
                "dateOfBirth": "1996-05-14",
                "city": "Mexico City",
                "country": "Mexico",
                "profileImageUrl": null,
                "referralCode": "ABC12345",
                "referredByUid": null,
                "role": "user",
                "isVerified": true,
                "isBlocked": false,
                "createdAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'PATCH /api/v1/users/me/image': {
    requestBody: makeMultipartRequestBody({
      description: 'Upload a profile image.',
      required: ['image'],
      properties: {
        image: binaryProperty('Profile image upload.'),
      },
    }),
    responses: {
      "200": {
        "description": "Updated profile.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/User"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "fullname": "Jane Doe",
                "email": "jane@example.com",
                "gender": "female",
                "age": 30,
                "dateOfBirth": "1996-05-14",
                "city": "Mexico City",
                "country": "Mexico",
                "profileImageUrl": "https://cdn.foodroute.app/users/jane.jpg",
                "referralCode": "ABC12345",
                "referredByUid": null,
                "role": "user",
                "isVerified": true,
                "isBlocked": false,
                "createdAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'PATCH /api/v1/admin/profile/image': {
    requestBody: makeMultipartRequestBody({
      description: 'Upload an admin profile image.',
      required: ['image'],
      properties: {
        image: binaryProperty('Profile image upload.'),
      },
    }),
    responses: {
      "200": {
        "description": "Updated admin profile.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "uid": {
                  "type": "string"
                },
                "fullname": {
                  "type": "string"
                },
                "email": {
                  "type": "string",
                  "format": "email"
                },
                "phone": {
                  "type": "string",
                  "nullable": true
                },
                "profileImageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "role": {
                  "type": "string",
                  "enum": [
                    "admin",
                    "super_admin"
                  ]
                },
                "isVerified": {
                  "type": "boolean"
                },
                "isBlocked": {
                  "type": "boolean"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "lastLoginAt": {
                  "type": "string",
                  "format": "date-time",
                  "nullable": true
                }
              }
            },
            "example": {
              "uid": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
              "fullname": "Admin User",
              "email": "admin@foodroute.app",
              "phone": "+52 55 9876 5432",
              "profileImageUrl": "https://cdn.foodroute.app/admin/profile.jpg",
              "role": "super_admin",
              "isVerified": true,
              "isBlocked": false,
              "createdAt": "2026-07-20T12:00:00.000Z",
              "lastLoginAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
  'POST /api/v1/admin/auth/login': {
    requestBody: makeJsonRequestBody({
      description: 'Authenticate an admin user.',
      required: ['email', 'password'],
      properties: {
        email: stringProperty('Admin email address.'),
        password: stringProperty('Admin password.'),
      },
    }),
    responses: {
      "200": {
        "description": "Admin session.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/AuthSession"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "email": "admin@foodroute.app",
                "role": "super_admin",
                "is_verified": true,
                "access_token": "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI4d3ZoY29xY1RFWGJSazlWMVZ6Y0J2NG9vbTIifQ.signature",
                "refresh_token": "AEwRxG_LwZ4oexampleRefreshTokenValue1234567890",
                "expires_in": 3600
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/admin/auth/refresh': {
    requestBody: makeJsonRequestBody({
      description: 'Refresh an admin session.',
      required: ['refreshToken'],
      properties: {
        refreshToken: stringProperty('Refresh token returned from admin login.'),
      },
    }),
    responses: {
      "200": {
        "description": "Admin session.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/AuthSession"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "email": "admin@foodroute.app",
                "role": "super_admin",
                "is_verified": true,
                "access_token": "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI4d3ZoY29xY1RFWGJSazlWMVZ6Y0J2NG9vbTIifQ.signature",
                "refresh_token": "AEwRxG_LwZ4oexampleRefreshTokenValue1234567890",
                "expires_in": 3600
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/admin/auth/forgot-password': {
    requestBody: makeJsonRequestBody({
      description: 'Begin the admin forgot-password flow.',
      required: ['email'],
      properties: {
        email: stringProperty('Admin email address.'),
      },
    }),
    responses: {
      "200": {
        "description": "Operation completed.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "Admin forgot-password email sent."
            }
          }
        }
      }
},},
  'POST /api/v1/admin/auth/resend-forgot-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Resend the admin forgot-password OTP.',
      required: ['email'],
      properties: {
        email: stringProperty('Admin email address.'),
      },
    }),
    responses: {
      "200": {
        "description": "Operation completed.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "Admin forgot-password OTP resent."
            }
          }
        }
      }
},},
  'POST /api/v1/admin/auth/verify-forgot-otp': {
    requestBody: makeJsonRequestBody({
      description: 'Verify the admin forgot-password OTP.',
      required: ['email', 'otp'],
      properties: {
        email: stringProperty('Admin email address.'),
        otp: stringProperty('4-digit numeric OTP.'),
      },
    }),
    responses: {
      "200": {
        "description": "Verified admin.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/User"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "fullname": "Jane Doe",
                "email": "admin@foodroute.app",
                "gender": "female",
                "age": 30,
                "dateOfBirth": "1996-05-14",
                "city": "Mexico City",
                "country": "Mexico",
                "profileImageUrl": null,
                "referralCode": "ABC12345",
                "referredByUid": null,
                "role": "super_admin",
                "isVerified": true,
                "isBlocked": false,
                "createdAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/admin/auth/reset-password': {
    requestBody: makeJsonRequestBody({
      description: 'Reset an admin password after OTP verification.',
      required: ['email', 'new_password'],
      properties: {
        email: stringProperty('Admin email address.'),
        new_password: stringProperty('New password with minimum length 8.'),
      },
    }),
    responses: {
      "200": {
        "description": "Operation completed.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "Admin password reset."
            }
          }
        }
      }
},},
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
    responses: {
      "201": {
        "description": "Created admin.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "uid": {
                  "type": "string"
                },
                "fullname": {
                  "type": "string"
                },
                "email": {
                  "type": "string",
                  "format": "email"
                },
                "phone": {
                  "type": "string",
                  "nullable": true
                },
                "profileImageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "role": {
                  "type": "string",
                  "enum": [
                    "admin",
                    "super_admin"
                  ]
                },
                "isVerified": {
                  "type": "boolean"
                },
                "isBlocked": {
                  "type": "boolean"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "lastLoginAt": {
                  "type": "string",
                  "format": "date-time",
                  "nullable": true
                }
              }
            },
            "example": {
              "uid": "B7nP2qLmYjFvRt8sHcEgUbW",
              "fullname": "New Admin",
              "email": "newadmin@foodroute.app",
              "phone": "+52 55 9876 5432",
              "profileImageUrl": null,
              "role": "admin",
              "isVerified": true,
              "isBlocked": false,
              "createdAt": "2026-07-20T12:00:00.000Z",
              "lastLoginAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
  'PATCH /api/v1/admin/admins/{admin_id}': {
    requestBody: makeJsonRequestBody({
      description: 'Update an admin profile.',
      required: ['fullname', 'phone'],
      properties: {
        fullname: stringProperty('Admin full name.'),
        phone: stringProperty('Admin phone number.'),
      },
    }),
    responses: {
      "200": {
        "description": "Updated admin.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "uid": {
                  "type": "string"
                },
                "fullname": {
                  "type": "string"
                },
                "email": {
                  "type": "string",
                  "format": "email"
                },
                "phone": {
                  "type": "string",
                  "nullable": true
                },
                "profileImageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "role": {
                  "type": "string",
                  "enum": [
                    "admin",
                    "super_admin"
                  ]
                },
                "isVerified": {
                  "type": "boolean"
                },
                "isBlocked": {
                  "type": "boolean"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "lastLoginAt": {
                  "type": "string",
                  "format": "date-time",
                  "nullable": true
                }
              }
            },
            "example": {
              "uid": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
              "fullname": "Updated Admin",
              "email": "admin@foodroute.app",
              "phone": "+52 55 9876 5432",
              "profileImageUrl": null,
              "role": "admin",
              "isVerified": true,
              "isBlocked": false,
              "createdAt": "2026-07-20T12:00:00.000Z",
              "lastLoginAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Admin blocked.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "Admin has been blocked."
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Admin unblocked.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "Admin has been unblocked."
            }
          }
        }
      }
},},
  'PATCH /api/v1/admin/change-password': {
    requestBody: makeJsonRequestBody({
      description: 'Change the current admin password.',
      required: ['current_password', 'new_password'],
      properties: {
        current_password: stringProperty('Current password.'),
        new_password: stringProperty('New password with minimum length 8.'),
      },
    }),
    responses: {
      "200": {
        "description": "Password changed.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "Admin password updated."
            }
          }
        }
      }
},},
  'PATCH /api/v1/admin/profile': {
    requestBody: makeJsonRequestBody({
      description: 'Update the current admin profile.',
      required: ['fullname', 'phone'],
      properties: {
        fullname: stringProperty('Admin full name.'),
        phone: stringProperty('Admin phone number.'),
      },
    }),
    responses: {
      "200": {
        "description": "Updated admin profile.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "uid": {
                  "type": "string"
                },
                "fullname": {
                  "type": "string"
                },
                "email": {
                  "type": "string",
                  "format": "email"
                },
                "phone": {
                  "type": "string",
                  "nullable": true
                },
                "profileImageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "role": {
                  "type": "string",
                  "enum": [
                    "admin",
                    "super_admin"
                  ]
                },
                "isVerified": {
                  "type": "boolean"
                },
                "isBlocked": {
                  "type": "boolean"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "lastLoginAt": {
                  "type": "string",
                  "format": "date-time",
                  "nullable": true
                }
              }
            },
            "example": {
              "uid": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
              "fullname": "Updated Admin",
              "email": "admin@foodroute.app",
              "phone": "+52 55 9876 5432",
              "profileImageUrl": null,
              "role": "super_admin",
              "isVerified": true,
              "isBlocked": false,
              "createdAt": "2026-07-20T12:00:00.000Z",
              "lastLoginAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
  'GET /api/v1/admin/dashboard/summary': {
    parameters: makeQueryParameters([
      stringParam('range', 'Dashboard summary range.'),
      integerParam('year', 'Optional year for monthly range.'),
      integerParam('month', 'Optional month for monthly range.'),
    ]),
    responses: {
      "200": {
        "description": "Dashboard summary.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "totalUsers": {
                  "type": "integer"
                },
                "activeUsers": {
                  "type": "integer"
                },
                "verifiedUsers": {
                  "type": "integer"
                },
                "blockedUsers": {
                  "type": "integer"
                },
                "totalCheckIns": {
                  "type": "integer"
                },
                "totalRestaurants": {
                  "type": "integer"
                },
                "activeRestaurants": {
                  "type": "integer"
                },
                "totalReceiptUploads": {
                  "type": "integer"
                },
                "totalRewardsRedeemed": {
                  "type": "integer"
                },
                "totalPointsIssued": {
                  "type": "integer"
                },
                "rangeStart": {
                  "type": "string",
                  "format": "date-time"
                },
                "rangeEnd": {
                  "type": "string",
                  "format": "date-time"
                }
              }
            },
            "example": {
              "totalUsers": 5430,
              "activeUsers": 3120,
              "verifiedUsers": 4980,
              "blockedUsers": 12,
              "totalCheckIns": 47120,
              "totalRestaurants": 87,
              "activeRestaurants": 82,
              "totalReceiptUploads": 8810,
              "totalRewardsRedeemed": 1642,
              "totalPointsIssued": 412000,
              "rangeStart": "2026-06-01T00:00:00.000Z",
              "rangeEnd": "2026-07-01T00:00:00.000Z"
            }
          }
        }
      }
},},
  'POST /api/v1/admin/levels': {
    requestBody: makeJsonRequestBody({
      description: 'Create a level threshold.',
      required: ['name', 'minXp'],
      properties: {
        name: stringProperty('Level name.'),
        minXp: integerProperty('Minimum XP required for the level.', 0, 30_000),
      },
    }),
    responses: {
      "201": {
        "description": "Created level.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Level"
            },
            "example": {
              "success": true,
              "data": {
                "id": "lvl3",
                "name": "Comensal",
                "minXp": 1000,
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'PATCH /api/v1/admin/levels/{level_id}': {
    requestBody: makeJsonRequestBody({
      description: 'Update a level threshold.',
      properties: {
        name: stringProperty('Level name.'),
        minXp: integerProperty('Minimum XP required for the level.', 0, 30_000),
      },
    }),
    responses: {
      "200": {
        "description": "Updated level.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Level"
            },
            "example": {
              "success": true,
              "data": {
                "id": "lvl3",
                "name": "Comensal",
                "minXp": 1000,
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/admin/restaurants': {
    requestBody: makeMultipartRequestBody({
      description: 'Create a restaurant.',
      required: [
        'name',
        'address',
        'latitude',
        'longitude',
        'category',
        'openingTime',
        'closingTime',
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
        openingTime: stringProperty('Opening time in HH:mm format.'),
        closingTime: stringProperty('Closing time in HH:mm format.'),
        qrCodeName: stringProperty('QR code label.'),
        qrCodeLatitude: numberProperty('QR code latitude.', -90, 90),
        qrCodeLongitude: numberProperty('QR code longitude.', -180, 180),
        qrCodeToken: stringProperty('QR token string.'),
        pointsPerCheckIn: integerProperty('Points granted for a check-in.', 0, 10000),
        receiptUploadEnabled: booleanProperty('Whether users can upload receipts after check-in.'),
        pointsPerReceiptUpload: integerProperty(
          'Points granted when a user uploads a receipt after check-in.',
          0,
          10000,
        ),
        image: binaryProperty('Restaurant image upload.'),
      },
    }),
    responses: {
      "201": {
        "description": "Created restaurant.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Restaurant"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "name": "La Casa del Taco",
                "address": "Av. Reforma 222, CDMX",
                "city": "Mexico City",
                "country": "Mexico",
                "latitude": 19.4326,
                "longitude": -99.1332,
                "category": "Mexican",
                "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                "openingTime": "09:00",
                "closingTime": "23:00",
                "pointsPerCheckIn": 50,
                "pointsPerReceiptUpload": 100,
                "receiptUploadEnabled": true,
                "pointsPerSocialShare": 25,
                "checkinRadiusMeters": 100,
                "qrRequired": true,
                "status": "active",
                "qrCode": {
                  "name": "Main Entrance",
                  "token": "qr_tok_abc123",
                  "location": {
                    "latitude": 19.4326,
                    "longitude": -99.1332
                  }
                },
                "enabledPackages": [
                  "start",
                  "active"
                ],
                "enabledFeatures": [
                  {
                    "key": "checkin",
                    "name": "Check-in",
                    "enabled": true
                  },
                  {
                    "key": "receipt",
                    "name": "Receipt Upload",
                    "enabled": true
                  }
                ],
                "packageState": null,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "distanceKm": 1.2,
                "ratingSummary": {
                  "averageRating": 4.6,
                  "totalReviews": 138
                },
                "menuItems": [
                  {
                    "itemId": "miTacos01",
                    "name": "Tacos al pastor (3)",
                    "description": "Three corn-tortilla tacos.",
                    "price": 95.0,
                    "pointsToBuy": 200,
                    "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
                    "isAvailable": true,
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "reviews": [
                  {
                    "id": "rvAa1b2c3",
                    "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                    "userFullname": "Jane Doe",
                    "userEmail": "jane@example.com",
                    "rating": 5,
                    "comment": "Excellent service.",
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "isFavorite": false,
                "isCheckedIn": false,
                "lastCheckedInAt": null,
                "cooldownEndsAt": null,
                "userCheckinCount": 3,
                "todayCheckinCount": 0
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'PUT /api/v1/admin/restaurants/{restaurant_id}': {
    requestBody: makeMultipartRequestBody({
      description: 'Update a restaurant.',
      required: [
        'name',
        'address',
        'latitude',
        'longitude',
        'category',
        'openingTime',
        'closingTime',
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
        openingTime: stringProperty('Opening time in HH:mm format.'),
        closingTime: stringProperty('Closing time in HH:mm format.'),
        qrCodeName: stringProperty('QR code label.'),
        qrCodeLatitude: numberProperty('QR code latitude.', -90, 90),
        qrCodeLongitude: numberProperty('QR code longitude.', -180, 180),
        qrCodeToken: stringProperty('QR token string.'),
        pointsPerCheckIn: integerProperty('Points granted for a check-in.', 0, 10000),
        receiptUploadEnabled: booleanProperty('Whether users can upload receipts after check-in.'),
        pointsPerReceiptUpload: integerProperty(
          'Points granted when a user uploads a receipt after check-in.',
          0,
          10000,
        ),
        imageUrl: stringProperty('Existing image URL when no replacement image is uploaded.'),
        image: binaryProperty('Optional replacement restaurant image upload.'),
      },
    }),
    responses: {
      "200": {
        "description": "Updated restaurant.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Restaurant"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "name": "La Casa del Taco",
                "address": "Av. Reforma 222, CDMX",
                "city": "Mexico City",
                "country": "Mexico",
                "latitude": 19.4326,
                "longitude": -99.1332,
                "category": "Mexican",
                "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                "openingTime": "09:00",
                "closingTime": "23:00",
                "pointsPerCheckIn": 50,
                "pointsPerReceiptUpload": 100,
                "receiptUploadEnabled": true,
                "pointsPerSocialShare": 25,
                "checkinRadiusMeters": 100,
                "qrRequired": true,
                "status": "active",
                "qrCode": {
                  "name": "Main Entrance",
                  "token": "qr_tok_abc123",
                  "location": {
                    "latitude": 19.4326,
                    "longitude": -99.1332
                  }
                },
                "enabledPackages": [
                  "start",
                  "active"
                ],
                "enabledFeatures": [
                  {
                    "key": "checkin",
                    "name": "Check-in",
                    "enabled": true
                  },
                  {
                    "key": "receipt",
                    "name": "Receipt Upload",
                    "enabled": true
                  }
                ],
                "packageState": null,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "distanceKm": 1.2,
                "ratingSummary": {
                  "averageRating": 4.6,
                  "totalReviews": 138
                },
                "menuItems": [
                  {
                    "itemId": "miTacos01",
                    "name": "Tacos al pastor (3)",
                    "description": "Three corn-tortilla tacos.",
                    "price": 95.0,
                    "pointsToBuy": 200,
                    "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
                    "isAvailable": true,
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "reviews": [
                  {
                    "id": "rvAa1b2c3",
                    "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                    "userFullname": "Jane Doe",
                    "userEmail": "jane@example.com",
                    "rating": 5,
                    "comment": "Excellent service.",
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "isFavorite": false,
                "isCheckedIn": false,
                "lastCheckedInAt": null,
                "cooldownEndsAt": null,
                "userCheckinCount": 3,
                "todayCheckinCount": 0
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/admin/restaurants/analytics/summary': {
    description: 'List check-in based analytics summaries for restaurants.',
    parameters: makeQueryParameters([
      stringParam('range', 'Analytics range: last_7_days, last_30_days, or last_90_days.'),
    ]),
    responses: {
      "200": {
        "description": "Analytics summary.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "totalRestaurants": {
                  "type": "integer"
                },
                "range": {
                  "type": "string"
                },
                "items": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "restaurantId": {
                        "type": "string"
                      },
                      "restaurantName": {
                        "type": "string"
                      },
                      "city": {
                        "type": "string"
                      },
                      "category": {
                        "type": "string"
                      },
                      "checkInCount": {
                        "type": "integer"
                      },
                      "receiptUploadCount": {
                        "type": "integer"
                      },
                      "uniqueUserCount": {
                        "type": "integer"
                      },
                      "pointsAwarded": {
                        "type": "integer"
                      },
                      "averageRating": {
                        "type": "number",
                        "nullable": true
                      }
                    }
                  }
                }
              }
            },
            "example": {
              "totalRestaurants": 12,
              "range": "last_30_days",
              "items": [
                {
                  "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "restaurantName": "La Casa del Taco",
                  "city": "Mexico City",
                  "category": "Mexican",
                  "checkInCount": 187,
                  "receiptUploadCount": 41,
                  "uniqueUserCount": 102,
                  "pointsAwarded": 9350,
                  "averageRating": 4.6
                }
              ]
            }
          }
        }
      }
},},
  'GET /api/v1/admin/restaurants/{restaurant_id}/analytics': {
    description: 'Get chart-ready check-in based analytics for one restaurant.',
    parameters: makeQueryParameters([
      stringParam('range', 'Analytics range: last_7_days, last_30_days, or last_90_days.'),
    ]),
    responses: {
      "200": {
        "description": "Restaurant analytics.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "restaurantId": {
                  "type": "string"
                },
                "range": {
                  "type": "string"
                },
                "totalCheckIns": {
                  "type": "integer"
                },
                "uniqueUsers": {
                  "type": "integer"
                },
                "averageRating": {
                  "type": "number",
                  "nullable": true
                },
                "timeline": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "date": {
                        "type": "string"
                      },
                      "checkIns": {
                        "type": "integer"
                      },
                      "receiptUploads": {
                        "type": "integer"
                      },
                      "pointsAwarded": {
                        "type": "integer"
                      }
                    }
                  }
                }
              }
            },
            "example": {
              "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
              "range": "last_30_days",
              "totalCheckIns": 187,
              "uniqueUsers": 102,
              "averageRating": 4.6,
              "timeline": [
                {
                  "date": "2026-07-01",
                  "checkIns": 4,
                  "receiptUploads": 1,
                  "pointsAwarded": 200
                }
              ]
            }
          }
        }
      }
},},
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
    responses: {
      "201": {
        "description": "Created menu item.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "itemId": {
                  "type": "string"
                },
                "restaurantId": {
                  "type": "string"
                },
                "restaurantName": {
                  "type": "string"
                },
                "name": {
                  "type": "string"
                },
                "description": {
                  "type": "string",
                  "nullable": true
                },
                "price": {
                  "type": "number"
                },
                "pointsToBuy": {
                  "type": "integer"
                },
                "imageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "isAvailable": {
                  "type": "boolean"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time"
                }
              }
            },
            "example": {
              "itemId": "miTacos01",
              "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
              "restaurantName": "La Casa del Taco",
              "name": "Tacos al pastor (3)",
              "description": "Three corn-tortilla tacos.",
              "price": 95.0,
              "pointsToBuy": 200,
              "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
              "isAvailable": true,
              "createdAt": "2026-07-20T12:00:00.000Z",
              "updatedAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Updated menu item.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "itemId": {
                  "type": "string"
                },
                "restaurantId": {
                  "type": "string"
                },
                "restaurantName": {
                  "type": "string"
                },
                "name": {
                  "type": "string"
                },
                "description": {
                  "type": "string",
                  "nullable": true
                },
                "price": {
                  "type": "number"
                },
                "pointsToBuy": {
                  "type": "integer"
                },
                "imageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "isAvailable": {
                  "type": "boolean"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time"
                }
              }
            },
            "example": {
              "itemId": "miTacos01",
              "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
              "restaurantName": "La Casa del Taco",
              "name": "Tacos al pastor (3)",
              "description": "Three corn-tortilla tacos.",
              "price": 95.0,
              "pointsToBuy": 200,
              "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
              "isAvailable": true,
              "createdAt": "2026-07-20T12:00:00.000Z",
              "updatedAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/proximity-settings': {
    description: 'Get the current user proximity notification settings.',
    responses: {
      "200": {
        "description": "Proximity settings and triggered alerts.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "settings": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "enabled": {
                      "type": "boolean"
                    },
                    "distanceInMeter": {
                      "type": "number"
                    }
                  }
                },
                "triggeredAlerts": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "id": {
                        "type": "string"
                      },
                      "restaurantId": {
                        "type": "string"
                      },
                      "restaurantName": {
                        "type": "string"
                      },
                      "triggeredAt": {
                        "type": "string",
                        "format": "date-time"
                      }
                    }
                  }
                }
              }
            },
            "example": {
              "settings": {
                "enabled": true,
                "distanceInMeter": 500
              },
              "triggeredAlerts": []
            }
          }
        }
      }
},},
  'PATCH /api/v1/users/me/proximity-settings': {
    requestBody: makeJsonRequestBody({
      description: 'Update proximity notification settings.',
      properties: {
        distanceInMeter: numberProperty('Minimum distance in meters.', 1, 100000),
        enabled: booleanProperty('Whether proximity alerts are enabled.'),
      },
    }),
    responses: {
      "200": {
        "description": "Updated proximity settings.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "settings": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "enabled": {
                      "type": "boolean"
                    },
                    "distanceInMeter": {
                      "type": "number"
                    }
                  }
                },
                "triggeredAlerts": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "id": {
                        "type": "string"
                      },
                      "restaurantId": {
                        "type": "string"
                      },
                      "restaurantName": {
                        "type": "string"
                      },
                      "triggeredAt": {
                        "type": "string",
                        "format": "date-time"
                      }
                    }
                  }
                }
              }
            },
            "example": {
              "settings": {
                "enabled": true,
                "distanceInMeter": 750
              },
              "triggeredAlerts": []
            }
          }
        }
      }
},},
  'POST /api/v1/users/me/proximity-scan': {
    requestBody: makeJsonRequestBody({
      description: 'Trigger a proximity alert scan using the user’s current coordinates.',
      required: ['latitude', 'longitude'],
      properties: {
        latitude: numberProperty('Current user latitude.', -90, 90),
        longitude: numberProperty('Current user longitude.', -180, 180),
        accuracy: numberProperty('Optional location accuracy in meters.', 0, 1000000),
        source: stringProperty('Optional location source label, such as gps or background_geolocation.'),
      },
    }),
    responses: {
      "200": {
        "description": "Scan result.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "matchedRestaurantIds": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "triggeredAlertIds": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "notificationCount": {
                  "type": "integer"
                },
                "scannedAt": {
                  "type": "string",
                  "format": "date-time"
                }
              }
            },
            "example": {
              "matchedRestaurantIds": [
                "rAvM3yeL5nZbCqW1kT8uHsPxjDd"
              ],
              "triggeredAlertIds": [
                "ntAa1b2c3"
              ],
              "notificationCount": 1,
              "scannedAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
  'POST /api/v1/users/me/notifications/proximity/location': {
    requestBody: makeJsonRequestBody({
      description:
        'Mobile-compatible proximity location ping endpoint. Triggers the same scan flow as /users/me/proximity-scan.',
      required: ['latitude', 'longitude'],
      properties: {
        latitude: numberProperty('Current user latitude.', -90, 90),
        longitude: numberProperty('Current user longitude.', -180, 180),
        accuracy: numberProperty('Optional location accuracy in meters.', 0, 1000000),
        source: stringProperty('Optional location source label, such as gps or background_geolocation.'),
      },
    }),
    responses: {
      "200": {
        "description": "Scan result.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "matchedRestaurantIds": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "triggeredAlertIds": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "notificationCount": {
                  "type": "integer"
                },
                "scannedAt": {
                  "type": "string",
                  "format": "date-time"
                }
              }
            },
            "example": {
              "matchedRestaurantIds": [
                "rAvM3yeL5nZbCqW1kT8uHsPxjDd"
              ],
              "triggeredAlertIds": [
                "ntAa1b2c3"
              ],
              "notificationCount": 1,
              "scannedAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Scheduled scan summary.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "processedUsers": {
                  "type": "integer"
                },
                "createdAlerts": {
                  "type": "integer"
                },
                "pushedAlerts": {
                  "type": "integer"
                }
              }
            },
            "example": {
              "processedUsers": 1240,
              "createdAlerts": 8,
              "pushedAlerts": 7
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Spin result.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/SpinResponse"
            },
            "example": {
              "success": true,
              "data": {
                "spin": {
                  "id": "spnHist01",
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "rewardId": "sp1nReward01",
                  "rewardTitle": "10% Off",
                  "rewardDescription": "10% off your next check-in.",
                  "rewardCategory": "discount",
                  "pointsReward": 0,
                  "discountPercentage": 10,
                  "pointsRequired": 0,
                  "imageUrl": "https://cdn.foodroute.app/spin/discount10.png",
                  "spunAt": "2026-07-20T12:00:00.000Z",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "isSynthetic": false
                },
                "remainingQuantityAvailable": null,
                "nextSpinAt": "2026-07-21T12:00:00.000Z",
                "isInfiniteStock": true
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/check-ins/scan': {
    requestBody: makeJsonRequestBody({
      description: 'Scan a restaurant QR token or QR payload using the user current coordinates.',
      required: ['qrToken', 'latitude', 'longitude'],
      properties: {
        qrToken: stringProperty('Restaurant QR token or encoded QR payload string.'),
        latitude: numberProperty('Current user latitude.', -90, 90),
        longitude: numberProperty('Current user longitude.', -180, 180),
      },
    }),
    responses: {
      "200": {
        "description": "Check-in result.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/CheckIn"
            },
            "example": {
              "success": true,
              "data": {
                "id": "chkA1b2c3d4e5f6",
                "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "userFullname": "Jane Doe",
                "userEmail": "jane@example.com",
                "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "restaurantName": "La Casa del Taco",
                "restaurantAddress": "Av. Reforma 222, CDMX",
                "qrToken": "qr_tok_abc123",
                "awardedXp": 50,
                "awardedPoints": 50,
                "createdAt": "2026-07-20T12:00:00.000Z",
                "restaurant": {
                  "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "name": "La Casa del Taco",
                  "address": "Av. Reforma 222, CDMX",
                  "city": "Mexico City",
                  "country": "Mexico",
                  "latitude": 19.4326,
                  "longitude": -99.1332,
                  "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "category": "Mexican",
                  "cuisine": "Mexican",
                  "hours": "09:00–23:00",
                  "phone": "+52 55 1234 5678",
                  "website": "https://lacasadeltaco.mx",
                  "rating": 4.6,
                  "pointsPerCheckIn": 50,
                  "pointsPerReceiptUpload": 100,
                  "checkinRadiusMeters": 100,
                  "qrRequired": true
                },
                "userPointsAfter": 540,
                "userRankingPointsAfter": 1820
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/check-ins/history': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
    responses: {
      "200": {
        "description": "Check-in history.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/CheckIn"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "chkA1b2c3d4e5f6",
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "userFullname": "Jane Doe",
                  "userEmail": "jane@example.com",
                  "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "restaurantName": "La Casa del Taco",
                  "restaurantAddress": "Av. Reforma 222, CDMX",
                  "qrToken": "qr_tok_abc123",
                  "awardedXp": 50,
                  "awardedPoints": 50,
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "restaurant": {
                    "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "name": "La Casa del Taco",
                    "address": "Av. Reforma 222, CDMX",
                    "city": "Mexico City",
                    "country": "Mexico",
                    "latitude": 19.4326,
                    "longitude": -99.1332,
                    "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                    "category": "Mexican",
                    "cuisine": "Mexican",
                    "hours": "09:00–23:00",
                    "phone": "+52 55 1234 5678",
                    "website": "https://lacasadeltaco.mx",
                    "rating": 4.6,
                    "pointsPerCheckIn": 50,
                    "pointsPerReceiptUpload": 100,
                    "checkinRadiusMeters": 100,
                    "qrRequired": true
                  },
                  "userPointsAfter": 540,
                  "userRankingPointsAfter": 1820
                },
                {
                  "id": "chkXyZ789",
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "userFullname": "Jane Doe",
                  "userEmail": "jane@example.com",
                  "restaurantId": "rBvN4zeM6oAcDrX2lU9vItQykEe",
                  "restaurantName": "Sushi Itto",
                  "restaurantAddress": "Av. Polanco 88, CDMX",
                  "qrToken": "qr_tok_abc123",
                  "awardedXp": 40,
                  "awardedPoints": 40,
                  "createdAt": "2026-07-18T20:15:00.000Z",
                  "restaurant": {
                    "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "name": "La Casa del Taco",
                    "address": "Av. Reforma 222, CDMX",
                    "city": "Mexico City",
                    "country": "Mexico",
                    "latitude": 19.4326,
                    "longitude": -99.1332,
                    "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                    "category": "Mexican",
                    "cuisine": "Mexican",
                    "hours": "09:00–23:00",
                    "phone": "+52 55 1234 5678",
                    "website": "https://lacasadeltaco.mx",
                    "rating": 4.6,
                    "pointsPerCheckIn": 50,
                    "pointsPerReceiptUpload": 100,
                    "checkinRadiusMeters": 100,
                    "qrRequired": true
                  },
                  "userPointsAfter": 480,
                  "userRankingPointsAfter": 1780
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 28,
                "totalPages": 2
              }
            }
          }
        }
      }
},},
  'POST /api/v1/restaurants/{restaurant_id}/receipt': {
    requestBody: makeMultipartRequestBody({
      description:
        'Upload one receipt image for the latest eligible check-in at this restaurant and receive the restaurant configured reward.',
      required: ['image'],
      properties: {
        image: binaryProperty('Receipt image upload.'),
        note: stringProperty('Optional note associated with the receipt.'),
      },
    }),
    responses: {
      "201": {
        "description": "Receipt upload.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ReceiptUpload"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rcAa1b2c3d4e5",
                "checkinId": "chkA1b2c3d4e5f6",
                "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "restaurantName": "La Casa del Taco",
                "receiptImageUrl": "https://cdn.foodroute.app/receipts/abc.jpg",
                "imageUrl": "https://cdn.foodroute.app/receipts/abc.jpg",
                "note": "Dinner with friends",
                "status": "approved",
                "awardedXp": 100,
                "awardedPoints": 100,
                "createdAt": "2026-07-20T12:00:00.000Z",
                "routeProgress": [
                  {
                    "routeId": "routeCityTour",
                    "routeName": "CDMX City Tour",
                    "status": "in_progress",
                    "reason": null,
                    "visitedRestaurantIds": [
                      "rAvM3yeL5nZbCqW1kT8uHsPxjDd"
                    ],
                    "receiptUploadIds": [
                      "rcAa1b2c3d4e5"
                    ],
                    "completedAt": null,
                    "requiredVisits": 5,
                    "progressPercent": 20.0
                  }
                ]
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/admin/check-ins': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
    responses: {
      "200": {
        "description": "Admin check-in history.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/CheckIn"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "chkA1b2c3d4e5f6",
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "userFullname": "Jane Doe",
                  "userEmail": "jane@example.com",
                  "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "restaurantName": "La Casa del Taco",
                  "restaurantAddress": "Av. Reforma 222, CDMX",
                  "qrToken": "qr_tok_abc123",
                  "awardedXp": 50,
                  "awardedPoints": 50,
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "restaurant": {
                    "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "name": "La Casa del Taco",
                    "address": "Av. Reforma 222, CDMX",
                    "city": "Mexico City",
                    "country": "Mexico",
                    "latitude": 19.4326,
                    "longitude": -99.1332,
                    "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                    "category": "Mexican",
                    "cuisine": "Mexican",
                    "hours": "09:00–23:00",
                    "phone": "+52 55 1234 5678",
                    "website": "https://lacasadeltaco.mx",
                    "rating": 4.6,
                    "pointsPerCheckIn": 50,
                    "pointsPerReceiptUpload": 100,
                    "checkinRadiusMeters": 100,
                    "qrRequired": true
                  },
                  "userPointsAfter": 540,
                  "userRankingPointsAfter": 1820
                },
                {
                  "id": "chkA1b2c3d4e5f6",
                  "userId": "u2",
                  "userFullname": "Jane Doe",
                  "userEmail": "jane@example.com",
                  "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "restaurantName": "Sushi Itto",
                  "restaurantAddress": "Av. Reforma 222, CDMX",
                  "qrToken": "qr_tok_abc123",
                  "awardedXp": 50,
                  "awardedPoints": 50,
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "restaurant": {
                    "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "name": "La Casa del Taco",
                    "address": "Av. Reforma 222, CDMX",
                    "city": "Mexico City",
                    "country": "Mexico",
                    "latitude": 19.4326,
                    "longitude": -99.1332,
                    "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                    "category": "Mexican",
                    "cuisine": "Mexican",
                    "hours": "09:00–23:00",
                    "phone": "+52 55 1234 5678",
                    "website": "https://lacasadeltaco.mx",
                    "rating": 4.6,
                    "pointsPerCheckIn": 50,
                    "pointsPerReceiptUpload": 100,
                    "checkinRadiusMeters": 100,
                    "qrRequired": true
                  },
                  "userPointsAfter": 540,
                  "userRankingPointsAfter": 1820
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 312,
                "totalPages": 16
              }
            }
          }
        }
      }
},},
  'GET /api/v1/admin/users/{user_id}/points-history': {
    description: 'Get paginated points ledger history for one end user, including positive and negative deltas.',
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
    responses: {
      "200": {
        "description": "Points history.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "id": {
                        "type": "string"
                      },
                      "userId": {
                        "type": "string"
                      },
                      "deltaPoints": {
                        "type": "integer"
                      },
                      "sourceType": {
                        "type": "string"
                      },
                      "sourceId": {
                        "type": "string",
                        "nullable": true
                      },
                      "description": {
                        "type": "string"
                      },
                      "balanceAfter": {
                        "type": "integer"
                      },
                      "createdAt": {
                        "type": "string",
                        "format": "date-time"
                      }
                    }
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "phAa1b2c3",
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "deltaPoints": 50,
                  "sourceType": "check_in",
                  "sourceId": "chkA1b2c3d4e5f6",
                  "description": "Check-in reward",
                  "balanceAfter": 540,
                  "createdAt": "2026-07-20T12:00:00.000Z"
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 47,
                "totalPages": 3
              }
            }
          }
        }
      }
},},
  'GET /api/v1/admin/qr-codes': {
    responses: {
      "200": {
        "description": "QR codes.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/QrCode"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "restaurantName": "La Casa del Taco",
                  "restaurantAddress": "Av. Reforma 222, CDMX",
                  "restaurantCategory": "Mexican",
                  "qrCodeName": "Main Entrance",
                  "qrCodeToken": "qr_tok_abc123",
                  "qrCodeLatitude": 19.4326,
                  "qrCodeLongitude": -99.1332,
                  "currentPackage": "active",
                  "billingCycle": "monthly",
                  "activatedAt": "2026-07-20T12:00:00.000Z",
                  "expiresAt": "2026-07-21T12:00:00.000Z",
                  "isExpired": false
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 12,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
  'GET /api/v1/admin/qr-codes/{restaurant_id}': {
    responses: {
      "200": {
        "description": "QR code.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/QrCode"
            },
            "example": {
              "success": true,
              "data": {
                "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "restaurantName": "La Casa del Taco",
                "restaurantAddress": "Av. Reforma 222, CDMX",
                "restaurantCategory": "Mexican",
                "qrCodeName": "Main Entrance",
                "qrCodeToken": "qr_tok_abc123",
                "qrCodeLatitude": 19.4326,
                "qrCodeLongitude": -99.1332,
                "currentPackage": "active",
                "billingCycle": "monthly",
                "activatedAt": "2026-07-20T12:00:00.000Z",
                "expiresAt": "2026-07-21T12:00:00.000Z",
                "isExpired": false
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/admin/qr-codes/{restaurant_id}/image': {
    responses: {
      "200": {
        "description": "QR PNG.",
        "content": {
          "image/png": {
            "schema": {
              "type": "string",
              "format": "binary"
            }
          }
        }
      }
},},
  'GET /api/v1/admin/qr-codes/{restaurant_id}/pdf': {
    responses: {
      "200": {
        "description": "QR PDF.",
        "content": {
          "application/pdf": {
            "schema": {
              "type": "string",
              "format": "binary"
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/spins/history': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
    responses: {
      "200": {
        "description": "Spin history.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/SpinHistoryItem"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "spnHist01",
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "rewardId": "sp1nReward01",
                  "rewardTitle": "10% Off",
                  "rewardDescription": "10% off your next check-in.",
                  "rewardCategory": "discount",
                  "pointsReward": 0,
                  "discountPercentage": 10,
                  "pointsRequired": 0,
                  "imageUrl": "https://cdn.foodroute.app/spin/discount10.png",
                  "spunAt": "2026-07-20T12:00:00.000Z",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "isSynthetic": false
                },
                {
                  "id": "spnHist02",
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "rewardId": "sp1nReward02",
                  "rewardTitle": "Free Coffee",
                  "rewardDescription": "10% off your next check-in.",
                  "rewardCategory": "food",
                  "pointsReward": 100,
                  "discountPercentage": null,
                  "pointsRequired": 0,
                  "imageUrl": "https://cdn.foodroute.app/spin/discount10.png",
                  "spunAt": "2026-07-19T10:30:00.000Z",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "isSynthetic": false
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 12,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Spin wheel settings.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "resetLogic": {
                  "type": "string",
                  "enum": [
                    "daily",
                    "manual"
                  ]
                },
                "resetTimeUtc": {
                  "type": "string"
                },
                "noRewardProbability": {
                  "type": "integer"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "updatedBy": {
                  "type": "string",
                  "nullable": true
                }
              }
            },
            "example": {
              "resetLogic": "daily",
              "resetTimeUtc": "00:00",
              "noRewardProbability": 30,
              "updatedAt": "2026-07-20T12:00:00.000Z",
              "updatedBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp"
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Admin reward catalog.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Reward"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "rwDxK9pN2qLmYjFvRt8sHcEgUbW",
                  "title": "Free Tacos al pastor",
                  "description": "Redeem for a free order of Tacos al pastor.",
                  "pointsRequired": 200,
                  "quantityAvailable": 120,
                  "rewardCategory": "food",
                  "xpPoints": 50,
                  "foodItemName": "Tacos al pastor (3)",
                  "discountPercentage": null,
                  "giftCardCode": null,
                  "termsAndConditions": "Valid for dine-in only.",
                  "imageUrl": "https://cdn.foodroute.app/rewards/tacos.png",
                  "isActive": true,
                  "hasExpiry": false,
                  "expiresAt": null,
                  "status": "active",
                  "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "canRedeem": true,
                  "userPoints": 540
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 24,
                "totalPages": 2
              }
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Daily rewards.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "id": {
                        "type": "string"
                      },
                      "title": {
                        "type": "string"
                      },
                      "description": {
                        "type": "string",
                        "nullable": true
                      },
                      "rewardCategory": {
                        "type": "string"
                      },
                      "pointsReward": {
                        "type": "integer",
                        "nullable": true
                      },
                      "discountPercentage": {
                        "type": "integer"
                      },
                      "quantityAvailable": {
                        "type": "integer"
                      },
                      "probability": {
                        "type": "integer"
                      },
                      "imageUrl": {
                        "type": "string",
                        "nullable": true
                      },
                      "isActive": {
                        "type": "boolean"
                      },
                      "hasExpiry": {
                        "type": "boolean"
                      },
                      "expiresAt": {
                        "type": "string",
                        "format": "date-time",
                        "nullable": true
                      }
                    }
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "dlyAa1b2c3",
                  "title": "10% Off",
                  "description": "10% off your next order.",
                  "rewardCategory": "discount",
                  "pointsReward": 0,
                  "discountPercentage": 10,
                  "quantityAvailable": 1000,
                  "probability": 25,
                  "imageUrl": "https://cdn.foodroute.app/spin/discount10.png",
                  "isActive": true,
                  "hasExpiry": false,
                  "expiresAt": null
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 8,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Reward catalog.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Reward"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "rwDxK9pN2qLmYjFvRt8sHcEgUbW",
                  "title": "Free Tacos al pastor",
                  "description": "Redeem for a free order of Tacos al pastor.",
                  "pointsRequired": 200,
                  "quantityAvailable": 120,
                  "rewardCategory": "food",
                  "xpPoints": 50,
                  "foodItemName": "Tacos al pastor (3)",
                  "discountPercentage": null,
                  "giftCardCode": null,
                  "termsAndConditions": "Valid for dine-in only.",
                  "imageUrl": "https://cdn.foodroute.app/rewards/tacos.png",
                  "isActive": true,
                  "hasExpiry": false,
                  "expiresAt": null,
                  "status": "active",
                  "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "canRedeem": true,
                  "userPoints": 540
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 24,
                "totalPages": 2
              }
            }
          }
        }
      }
},},
  'GET /api/v1/users/leaderboard': {
    parameters: makeQueryParameters([
      { name: 'scope', required: true, description: 'Leaderboard scope.', schema: { type: 'string', enum: ['local', 'national'] } },
      { name: 'period', required: true, description: 'Leaderboard period.', schema: { type: 'string', enum: ['weekly', 'monthly'] } },
    ]),
    responses: {
      "200": {
        "description": "Leaderboard.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "scope": {
                  "type": "string",
                  "enum": [
                    "local",
                    "national"
                  ]
                },
                "period": {
                  "type": "string",
                  "enum": [
                    "weekly",
                    "monthly"
                  ]
                },
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/LeaderboardRow"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                },
                "serviceArea": {
                  "$ref": "#/components/schemas/ServiceArea"
                }
              }
            },
            "example": {
              "scope": "local",
              "period": "weekly",
              "items": [
                {
                  "rank": 1,
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "fullname": "Jane Doe",
                  "city": "Mexico City",
                  "country": "Mexico",
                  "profileImageUrl": null,
                  "currentXp": 1820,
                  "currentPoints": 540
                },
                {
                  "rank": 2,
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "fullname": "Jane Doe",
                  "city": "Mexico City",
                  "country": "Mexico",
                  "profileImageUrl": null,
                  "currentXp": 1820,
                  "currentPoints": 540
                },
                {
                  "rank": 3,
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "fullname": "Jane Doe",
                  "city": "Mexico City",
                  "country": "Mexico",
                  "profileImageUrl": null,
                  "currentXp": 1820,
                  "currentPoints": 540
                },
                {
                  "rank": 4,
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "fullname": "Jane Doe",
                  "city": "Mexico City",
                  "country": "Mexico",
                  "profileImageUrl": null,
                  "currentXp": 1820,
                  "currentPoints": 540
                },
                {
                  "rank": 5,
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "fullname": "Jane Doe",
                  "city": "Mexico City",
                  "country": "Mexico",
                  "profileImageUrl": null,
                  "currentXp": 1820,
                  "currentPoints": 540
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 187,
                "totalPages": 10
              },
              "serviceArea": {
                "activeCities": [
                  "Mexico City"
                ],
                "radiusKm": 25,
                "outOfServiceArea": false,
                "message": "Serving your area."
              }
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/reward-store': {
    description: 'List a combined reward store catalog for the authenticated user, merging rewards and restaurant dishes sorted by name.',
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
    ]),
    responses: {
      "200": {
        "description": "Reward store.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "oneOf": [
                      {
                        "$ref": "#/components/schemas/Reward"
                      },
                      {
                        "$ref": "#/components/schemas/DishItem"
                      }
                    ]
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "rwDxK9pN2qLmYjFvRt8sHcEgUbW",
                  "title": "Free Tacos al pastor",
                  "description": "Redeem for a free order of Tacos al pastor.",
                  "pointsRequired": 200,
                  "quantityAvailable": 120,
                  "rewardCategory": "food",
                  "xpPoints": 50,
                  "foodItemName": "Tacos al pastor (3)",
                  "discountPercentage": null,
                  "giftCardCode": null,
                  "termsAndConditions": "Valid for dine-in only.",
                  "imageUrl": "https://cdn.foodroute.app/rewards/tacos.png",
                  "isActive": true,
                  "hasExpiry": false,
                  "expiresAt": null,
                  "status": "active",
                  "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "canRedeem": true,
                  "userPoints": 540
                },
                {
                  "type": "restaurant_item",
                  "itemId": "miTacos01",
                  "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "restaurantName": "La Casa del Taco",
                  "restaurantAddress": "Av. Reforma 222, CDMX",
                  "name": "Tacos al pastor (3)",
                  "description": "Three corn-tortilla tacos.",
                  "price": 95.0,
                  "pointsToBuy": 200,
                  "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
                  "isAvailable": true,
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z"
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 18,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
  'GET /api/v1/restaurants': {
    description:
      'List active restaurants, optionally filtered by city, search term, or proximity (latitude/longitude/radius). Sponsored/featured placements are sorted to the top within their proximity band.',
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('city', 'Optional city filter.'),
      numberParam('latitude', 'Optional latitude.'),
      numberParam('longitude', 'Optional longitude.'),
      numberParam('radius', 'Optional proximity radius override in km (overrides the user-configured radius).'),
    ]),
    responses: {
      "200": {
        "description": "Restaurants.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/RestaurantListEnvelope"
            },
            "example": {
              "items": [
                {
                  "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "name": "La Casa del Taco",
                  "address": "Av. Reforma 222, CDMX",
                  "city": "Mexico City",
                  "latitude": 19.4326,
                  "longitude": -99.1332,
                  "category": "Mexican",
                  "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "pointsPerCheckIn": 50,
                  "distanceKm": 1.2,
                  "ratingSummary": {
                    "averageRating": 4.6,
                    "totalReviews": 138
                  },
                  "isFavorite": false,
                  "isCheckedIn": false,
                  "lastCheckedInAt": null,
                  "cooldownEndsAt": null,
                  "userCheckinCount": 3,
                  "todayCheckinCount": 0
                },
                {
                  "id": "rBvN4zeM6oAcDrX2lU9vItQykEe",
                  "name": "Sushi Itto",
                  "address": "Av. Reforma 222, CDMX",
                  "city": "Mexico City",
                  "latitude": 19.4326,
                  "longitude": -99.1332,
                  "category": "Japanese",
                  "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "pointsPerCheckIn": 50,
                  "distanceKm": 3.4,
                  "ratingSummary": {
                    "averageRating": 4.6,
                    "totalReviews": 138
                  },
                  "isFavorite": true,
                  "isCheckedIn": false,
                  "lastCheckedInAt": null,
                  "cooldownEndsAt": null,
                  "userCheckinCount": 7,
                  "todayCheckinCount": 0
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 47,
                "totalPages": 3
              },
              "serviceArea": {
                "activeCities": [
                  "Mexico City",
                  "Guadalajara"
                ],
                "radiusKm": 25,
                "outOfServiceArea": false,
                "message": "Serving your area."
              }
            }
          }
        }
      }
},},
  'GET /api/v1/restaurants/featured': {
    description:
      'List active restaurants that opt into the featured listing package. Sponsored placements sort to the top within their proximity band.',
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('city', 'Optional city filter.'),
      numberParam('latitude', 'Optional latitude.'),
      numberParam('longitude', 'Optional longitude.'),
      numberParam('radius', 'Optional proximity radius override in km.'),
    ]),
    responses: {
      "200": {
        "description": "Featured restaurants.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/RestaurantListEnvelope"
            },
            "example": {
              "items": [
                {
                  "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "name": "Tacos Don Pepe",
                  "address": "Av. Reforma 222, CDMX",
                  "city": "Mexico City",
                  "latitude": 19.4326,
                  "longitude": -99.1332,
                  "category": "Mexican",
                  "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "pointsPerCheckIn": 50,
                  "distanceKm": 1.2,
                  "ratingSummary": {
                    "averageRating": 4.6,
                    "totalReviews": 138
                  },
                  "isFavorite": false,
                  "isCheckedIn": false,
                  "lastCheckedInAt": null,
                  "cooldownEndsAt": null,
                  "userCheckinCount": 3,
                  "todayCheckinCount": 0
                },
                {
                  "id": "rBvN4zeM6oAcDrX2lU9vItQykEe",
                  "name": "Sushi Itto",
                  "address": "Av. Reforma 222, CDMX",
                  "city": "Mexico City",
                  "latitude": 19.4326,
                  "longitude": -99.1332,
                  "category": "Japanese",
                  "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "pointsPerCheckIn": 50,
                  "distanceKm": 1.2,
                  "ratingSummary": {
                    "averageRating": 4.6,
                    "totalReviews": 138
                  },
                  "isFavorite": false,
                  "isCheckedIn": false,
                  "lastCheckedInAt": null,
                  "cooldownEndsAt": null,
                  "userCheckinCount": 3,
                  "todayCheckinCount": 0
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 24,
                "totalPages": 2
              },
              "serviceArea": {
                "activeCities": [
                  "Mexico City",
                  "Guadalajara"
                ],
                "radiusKm": 25,
                "outOfServiceArea": false,
                "message": "Serving your area."
              }
            }
          }
        }
      }
},},
  'GET /api/v1/restaurants/nearby': {
    description:
      'List nearby restaurants sorted by distance when latitude and longitude are supplied. Without coordinates, results fall back to the requested city or the authenticated user city. Sponsored/featured/trending placements sort to the top within the proximity band.',
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('city', 'Optional city override used for filtering or location fallback.'),
      numberParam('latitude', 'Optional current user latitude.'),
      numberParam('longitude', 'Optional current user longitude.'),
      numberParam('radius', 'Optional proximity radius override in km.'),
    ]),
    responses: {
      "200": {
        "description": "Nearby restaurants.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/RestaurantListEnvelope"
            },
            "example": {
              "items": [
                {
                  "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "name": "La Casa del Taco",
                  "address": "Av. Reforma 222, CDMX",
                  "city": "Mexico City",
                  "latitude": 19.4326,
                  "longitude": -99.1332,
                  "category": "Mexican",
                  "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "pointsPerCheckIn": 50,
                  "distanceKm": 1.2,
                  "ratingSummary": {
                    "averageRating": 4.6,
                    "totalReviews": 138
                  },
                  "isFavorite": false,
                  "isCheckedIn": false,
                  "lastCheckedInAt": null,
                  "cooldownEndsAt": null,
                  "userCheckinCount": 3,
                  "todayCheckinCount": 0
                },
                {
                  "id": "rBvN4zeM6oAcDrX2lU9vItQykEe",
                  "name": "Sushi Itto",
                  "address": "Av. Reforma 222, CDMX",
                  "city": "Mexico City",
                  "latitude": 19.4326,
                  "longitude": -99.1332,
                  "category": "Japanese",
                  "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "pointsPerCheckIn": 50,
                  "distanceKm": 3.4,
                  "ratingSummary": {
                    "averageRating": 4.6,
                    "totalReviews": 138
                  },
                  "isFavorite": true,
                  "isCheckedIn": false,
                  "lastCheckedInAt": null,
                  "cooldownEndsAt": null,
                  "userCheckinCount": 7,
                  "todayCheckinCount": 0
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 47,
                "totalPages": 3
              },
              "serviceArea": {
                "activeCities": [
                  "Mexico City",
                  "Guadalajara"
                ],
                "radiusKm": 25,
                "outOfServiceArea": false,
                "message": "Serving your area."
              }
            }
          }
        }
      }
},},
  'GET /api/v1/restaurants/{restaurant_id}': {
    parameters: makeQueryParameters([
      numberParam('latitude', 'Optional latitude.'),
      numberParam('longitude', 'Optional longitude.'),
    ]),
    responses: {
      "200": {
        "description": "Restaurant detail.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/RestaurantDetail"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "name": "La Casa del Taco",
                "address": "Av. Reforma 222, CDMX",
                "city": "Mexico City",
                "country": "Mexico",
                "latitude": 19.4326,
                "longitude": -99.1332,
                "category": "Mexican",
                "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                "openingTime": "09:00",
                "closingTime": "23:00",
                "pointsPerCheckIn": 50,
                "pointsPerReceiptUpload": 100,
                "receiptUploadEnabled": true,
                "pointsPerSocialShare": 25,
                "checkinRadiusMeters": 100,
                "qrRequired": true,
                "status": "active",
                "qrCode": {
                  "name": "Main Entrance",
                  "token": "qr_tok_abc123",
                  "location": {
                    "latitude": 19.4326,
                    "longitude": -99.1332
                  }
                },
                "enabledPackages": [
                  "start",
                  "active"
                ],
                "enabledFeatures": [
                  {
                    "key": "checkin",
                    "name": "Check-in",
                    "enabled": true
                  },
                  {
                    "key": "receipt",
                    "name": "Receipt Upload",
                    "enabled": true
                  }
                ],
                "packageState": null,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "distanceKm": 1.2,
                "ratingSummary": {
                  "averageRating": 4.6,
                  "totalReviews": 138
                },
                "menuItems": [
                  {
                    "itemId": "miTacos01",
                    "name": "Tacos al pastor (3)",
                    "description": "Three corn-tortilla tacos.",
                    "price": 95.0,
                    "pointsToBuy": 200,
                    "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
                    "isAvailable": true,
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "reviews": [
                  {
                    "id": "rvAa1b2c3",
                    "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                    "userFullname": "Jane Doe",
                    "userEmail": "jane@example.com",
                    "rating": 5,
                    "comment": "Excellent service.",
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "isFavorite": false,
                "isCheckedIn": false,
                "lastCheckedInAt": null,
                "cooldownEndsAt": null,
                "userCheckinCount": 3,
                "todayCheckinCount": 0
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/restaurants/{restaurant_id}/menu': {
    description:
      'Return the menu for a restaurant. The response includes latitude and longitude so the menu screen can hand off to navigation without an extra round-trip.',
    parameters: makeQueryParameters([
      numberParam('latitude', 'Optional latitude.'),
      numberParam('longitude', 'Optional longitude.'),
    ]),
    responses: {
      "200": {
        "description": "Restaurant menu.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/RestaurantMenu"
            },
            "example": {
              "success": true,
              "data": {
                "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "restaurantName": "La Casa del Taco",
                "restaurantAddress": "Av. Reforma 222, CDMX",
                "city": "Mexico City",
                "latitude": 19.4326,
                "longitude": -99.1332,
                "category": "Mexican",
                "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                "pointsPerCheckIn": 50,
                "distanceKm": 1.2,
                "ratingSummary": {
                  "averageRating": 4.6,
                  "totalReviews": 138
                },
                "menuId": "menuLacasa01",
                "menuName": "Main Menu",
                "menuItems": [
                  {
                    "itemId": "miTacos01",
                    "name": "Tacos al pastor (3)",
                    "description": "Three corn-tortilla tacos.",
                    "price": 95.0,
                    "pointsToBuy": 200,
                    "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
                    "isAvailable": true,
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "isFavorite": false
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/restaurants/{restaurant_id}/directions': {
    description:
      'Return navigation URLs for Google Maps, Apple Maps, and Waze. The `platform` query param selects the deep-link vs web fallback strategy. Each provider carries a `fallbackReason` so clients know when a URL is only a web fallback (`no_native_app`).',
    parameters: makeQueryParameters([
      numberParam('latitude', 'Optional origin latitude.'),
      numberParam('longitude', 'Optional origin longitude.'),
      stringEnumParam('platform', 'Optional client platform.', ['ios', 'android', 'web']),
    ]),
    responses: {
      "200": {
        "description": "Navigation payloads.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Directions"
            },
            "example": {
              "success": true,
              "data": {
                "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "restaurantName": "La Casa del Taco",
                "address": "Av. Reforma 222, CDMX",
                "latitude": 19.4326,
                "longitude": -99.1332,
                "userLatitude": 19.435,
                "userLongitude": -99.134,
                "distanceKm": 0.6,
                "platform": "ios",
                "mapsUrl": "https://maps.google.com/?q=La+Casa+del+Taco",
                "providers": {
                  "ios": {
                    "appleMaps": "https://maps.apple.com/?daddr=19.4326,-99.1332",
                    "googleMaps": "comgooglemaps://?daddr=19.4326,-99.1332",
                    "waze": "waze://?ll=19.4326,-99.1332&navigate=yes"
                  },
                  "android": {
                    "googleMaps": "google.navigation:q=19.4326,-99.1332",
                    "waze": "waze://?ll=19.4326,-99.1332&navigate=yes"
                  }
                }
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/restaurants/{restaurant_id}/reviews': {
    requestBody: makeJsonRequestBody({
      description: 'Create a restaurant review.',
      required: ['rating'],
      properties: {
        rating: integerProperty('Rating from 1 to 5.', 1, 5),
        comment: stringProperty('Optional review comment.'),
      },
    }),
    responses: {
      "201": {
        "description": "Created review.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Review"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rvAa1b2c3",
                "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "userFullname": "Jane Doe",
                "userEmail": "jane@example.com",
                "rating": 5,
                "comment": "Excellent service.",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/restaurants/{restaurant_id}/reviews': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
    responses: {
      "200": {
        "description": "Restaurant reviews.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Review"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "rvAa1b2c3",
                  "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "userFullname": "Jane Doe",
                  "userEmail": "jane@example.com",
                  "rating": 5,
                  "comment": "Excellent service.",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z"
                },
                {
                  "id": "rvBb2c3d4",
                  "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "userFullname": "Carlos R",
                  "userEmail": "carlos@example.com",
                  "rating": 4,
                  "comment": "Great tacos!",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z"
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 138,
                "totalPages": 7
              }
            }
          }
        }
      }
},},
  'PATCH /api/v1/restaurants/{restaurant_id}/reviews/{review_id}': {
    requestBody: makeJsonRequestBody({
      description: 'Update a restaurant review.',
      properties: {
        rating: integerProperty('Rating from 1 to 5.', 1, 5),
        comment: stringProperty('Optional review comment.'),
      },
    }),
    responses: {
      "200": {
        "description": "Updated review.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Review"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rvAa1b2c3",
                "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "userFullname": "Jane Doe",
                "userEmail": "jane@example.com",
                "rating": 5,
                "comment": "Excellent service.",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/favorites/restaurants': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('city', 'Optional city filter.'),
      numberParam('latitude', 'Optional latitude.'),
      numberParam('longitude', 'Optional longitude.'),
    ]),
    responses: {
      "200": {
        "description": "Favorite restaurants.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/RestaurantListItem"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "name": "La Casa del Taco",
                  "address": "Av. Reforma 222, CDMX",
                  "city": "Mexico City",
                  "latitude": 19.4326,
                  "longitude": -99.1332,
                  "category": "Mexican",
                  "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "pointsPerCheckIn": 50,
                  "distanceKm": 1.2,
                  "ratingSummary": {
                    "averageRating": 4.6,
                    "totalReviews": 138
                  },
                  "isFavorite": true,
                  "isCheckedIn": false,
                  "lastCheckedInAt": null,
                  "cooldownEndsAt": null,
                  "userCheckinCount": 3,
                  "todayCheckinCount": 0
                },
                {
                  "id": "rBvN4zeM6oAcDrX2lU9vItQykEe",
                  "name": "Sushi Itto",
                  "address": "Av. Reforma 222, CDMX",
                  "city": "Mexico City",
                  "latitude": 19.4326,
                  "longitude": -99.1332,
                  "category": "Japanese",
                  "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "pointsPerCheckIn": 50,
                  "distanceKm": 1.2,
                  "ratingSummary": {
                    "averageRating": 4.6,
                    "totalReviews": 138
                  },
                  "isFavorite": true,
                  "isCheckedIn": false,
                  "lastCheckedInAt": null,
                  "cooldownEndsAt": null,
                  "userCheckinCount": 3,
                  "todayCheckinCount": 0
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 4,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
  'POST /api/v1/support-requests': {
    requestBody: makeJsonRequestBody({
      description: 'Create a support request.',
      required: ['title', 'message'],
      properties: {
        title: stringProperty('Support request title.'),
        message: stringProperty('Support request message.'),
      },
    }),
    responses: {
      "201": {
        "description": "Created support request.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/SupportRequest"
            },
            "example": {
              "success": true,
              "data": {
                "id": "srA1b2c3",
                "title": "Issue with redemption",
                "message": "I redeemed a reward but did not get the code.",
                "status": "open",
                "createdByUid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "createdByEmail": "jane@example.com",
                "createdByName": "Jane Doe",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/admin/support-requests': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
    responses: {
      "200": {
        "description": "Support requests.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/SupportRequest"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "srA1b2c3",
                  "title": "Issue with redemption",
                  "message": "I redeemed a reward but did not get the code.",
                  "status": "open",
                  "createdByUid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "createdByEmail": "jane@example.com",
                  "createdByName": "Jane Doe",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z"
                },
                {
                  "id": "srBb2c3d4",
                  "title": "Cannot see review",
                  "message": "I redeemed a reward but did not get the code.",
                  "status": "in_progress",
                  "createdByUid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "createdByEmail": "jane@example.com",
                  "createdByName": "Jane Doe",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z"
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 18,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Notification campaigns.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/NotificationCampaign"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "ncAa1b2c3",
                  "campaignTitle": "Summer Tacos",
                  "campaignBody": "Earn 2x points at any taqueria this summer!",
                  "campaignCategory": "promotions",
                  "targetAudience": "all",
                  "cityName": null,
                  "ageGroup": null,
                  "deliveryType": "immediate",
                  "scheduledAt": null,
                  "status": "sent",
                  "deliveryRate": 92.5,
                  "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                  "sentAt": "2026-07-20T12:00:00.000Z",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z"
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 12,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
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
    responses: {
      "201": {
        "description": "Created challenge.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Challenge"
            },
            "example": {
              "success": true,
              "data": {
                "id": "chAa1b2c3",
                "title": "Visit 5 taquerías",
                "description": "Check in at 5 different taco restaurants this month.",
                "rewardPoints": 500,
                "rewardId": null,
                "startAt": "2026-07-20T12:00:00.000Z",
                "endAt": "2026-07-21T12:00:00.000Z",
                "status": "active",
                "criteria": [
                  {
                    "id": "crt1",
                    "type": "check_in_count",
                    "requiredCount": 5
                  }
                ],
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "criteriaCount": 1
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/admin/challenges': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('status', 'Optional challenge status filter.'),
    ]),
    responses: {
      "200": {
        "description": "Challenges.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Challenge"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "chAa1b2c3",
                  "title": "Visit 5 taquerías",
                  "description": "Check in at 5 different taco restaurants this month.",
                  "rewardPoints": 500,
                  "rewardId": null,
                  "startAt": "2026-07-20T12:00:00.000Z",
                  "endAt": "2026-07-21T12:00:00.000Z",
                  "status": "active",
                  "criteria": [
                    {
                      "id": "crt1",
                      "type": "check_in_count",
                      "requiredCount": 5
                    }
                  ],
                  "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "criteriaCount": 1
                },
                {
                  "id": "chBb2c3d4",
                  "title": "Upload 3 receipts",
                  "description": "Check in at 5 different taco restaurants this month.",
                  "rewardPoints": 200,
                  "rewardId": null,
                  "startAt": "2026-07-20T12:00:00.000Z",
                  "endAt": "2026-07-21T12:00:00.000Z",
                  "status": "completed",
                  "criteria": [
                    {
                      "id": "crt2",
                      "type": "receipt_upload",
                      "requiredCount": 3
                    }
                  ],
                  "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "criteriaCount": 1
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 8,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Updated challenge.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Challenge"
            },
            "example": {
              "success": true,
              "data": {
                "id": "chAa1b2c3",
                "title": "Visit 5 taquerías",
                "description": "Check in at 5 different taco restaurants this month.",
                "rewardPoints": 500,
                "rewardId": null,
                "startAt": "2026-07-20T12:00:00.000Z",
                "endAt": "2026-07-21T12:00:00.000Z",
                "status": "active",
                "criteria": [
                  {
                    "id": "crt1",
                    "type": "check_in_count",
                    "requiredCount": 5
                  }
                ],
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "criteriaCount": 1
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/challenges': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
    ]),
    responses: {
      "200": {
        "description": "My challenge participations.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/ChallengeParticipation"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "cpAa1b2c3",
                  "challengeId": "chAa1b2c3",
                  "challengeTitle": "Visit 5 taquerías",
                  "challengeDescription": "Check in at 5 different taco restaurants this month.",
                  "rewardPoints": 500,
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "userFullname": "Jane Doe",
                  "userEmail": "jane@example.com",
                  "status": "in_progress",
                  "totalCheckIns": 3,
                  "progressPercent": 60.0,
                  "criteria": [
                    {
                      "id": "crt1",
                      "type": "check_in_count",
                      "requiredCount": 5,
                      "currentCount": 3,
                      "completed": false
                    }
                  ],
                  "startedAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "completedAt": null
                },
                {
                  "id": "cpBb2c3d4",
                  "challengeId": "chBb2c3d4",
                  "challengeTitle": "Upload 3 receipts",
                  "challengeDescription": "Check in at 5 different taco restaurants this month.",
                  "rewardPoints": 500,
                  "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                  "userFullname": "Jane Doe",
                  "userEmail": "jane@example.com",
                  "status": "completed",
                  "totalCheckIns": 0,
                  "progressPercent": 100.0,
                  "criteria": [
                    {
                      "id": "crt2",
                      "type": "receipt_upload",
                      "requiredCount": 3,
                      "currentCount": 3,
                      "completed": true
                    }
                  ],
                  "startedAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "completedAt": "2026-07-20T12:00:00.000Z"
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 4,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/challenges/available': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
    ]),
    responses: {
      "200": {
        "description": "Available challenges.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Challenge"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "chAa1b2c3",
                  "title": "Visit 5 taquerías",
                  "description": "Check in at 5 different taco restaurants this month.",
                  "rewardPoints": 500,
                  "rewardId": null,
                  "startAt": "2026-07-20T12:00:00.000Z",
                  "endAt": "2026-07-21T12:00:00.000Z",
                  "status": "active",
                  "criteria": [
                    {
                      "id": "crt1",
                      "type": "check_in_count",
                      "requiredCount": 5
                    }
                  ],
                  "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "criteriaCount": 1
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 6,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
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
    responses: {
      "201": {
        "description": "Seeded super admin.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/User"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "fullname": "Jane Doe",
                "email": "admin@foodroute.app",
                "gender": "female",
                "age": 30,
                "dateOfBirth": "1996-05-14",
                "city": "Mexico City",
                "country": "Mexico",
                "profileImageUrl": null,
                "referralCode": "ABC12345",
                "referredByUid": null,
                "role": "super_admin",
                "isVerified": true,
                "isBlocked": false,
                "createdAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "User blocked.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "User has been blocked."
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "User unblocked.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/MessageResponse"
            },
            "example": {
              "success": true,
              "message": "User has been unblocked."
            }
          }
        }
      }
},},
  'PATCH /api/v1/admin/users/{user_id}/points': {
    requestBody: makeJsonRequestBody({
      description: 'Adjust a user points balance.',
      required: ['pointsDelta'],
      properties: {
        pointsDelta: integerProperty('Points delta to add or subtract.', -1_000_000, 1_000_000),
      },
    }),
    responses: {
      "200": {
        "description": "Updated user.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/User"
            },
            "example": {
              "success": true,
              "data": {
                "uid": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                "fullname": "Jane Doe",
                "email": "jane@example.com",
                "gender": "female",
                "age": 30,
                "dateOfBirth": "1996-05-14",
                "city": "Mexico City",
                "country": "Mexico",
                "profileImageUrl": null,
                "referralCode": "ABC12345",
                "referredByUid": null,
                "role": "user",
                "isVerified": true,
                "isBlocked": false,
                "createdAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/admin/restaurants': {
    requestBody: makeMultipartRequestBody({
      description: 'Create a restaurant.',
      required: [
        'name',
        'address',
        'latitude',
        'longitude',
        'category',
        'openingTime',
        'closingTime',
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
        openingTime: stringProperty('Opening time in HH:mm format.'),
        closingTime: stringProperty('Closing time in HH:mm format.'),
        qrCodeName: stringProperty('QR code label.'),
        qrCodeLatitude: numberProperty('QR code latitude.', -90, 90),
        qrCodeLongitude: numberProperty('QR code longitude.', -180, 180),
        qrCodeToken: stringProperty('QR token string.'),
        pointsPerCheckIn: integerProperty('Points granted for a check-in.', 0, 10000),
        receiptUploadEnabled: booleanProperty('Whether users can upload receipts after check-in.'),
        pointsPerReceiptUpload: integerProperty(
          'Points granted when a user uploads a receipt after check-in.',
          0,
          10000,
        ),
        image: binaryProperty('Restaurant image upload.'),
      },
    }),
    responses: {
      "201": {
        "description": "Created restaurant.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Restaurant"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "name": "La Casa del Taco",
                "address": "Av. Reforma 222, CDMX",
                "city": "Mexico City",
                "country": "Mexico",
                "latitude": 19.4326,
                "longitude": -99.1332,
                "category": "Mexican",
                "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                "openingTime": "09:00",
                "closingTime": "23:00",
                "pointsPerCheckIn": 50,
                "pointsPerReceiptUpload": 100,
                "receiptUploadEnabled": true,
                "pointsPerSocialShare": 25,
                "checkinRadiusMeters": 100,
                "qrRequired": true,
                "status": "active",
                "qrCode": {
                  "name": "Main Entrance",
                  "token": "qr_tok_abc123",
                  "location": {
                    "latitude": 19.4326,
                    "longitude": -99.1332
                  }
                },
                "enabledPackages": [
                  "start",
                  "active"
                ],
                "enabledFeatures": [
                  {
                    "key": "checkin",
                    "name": "Check-in",
                    "enabled": true
                  },
                  {
                    "key": "receipt",
                    "name": "Receipt Upload",
                    "enabled": true
                  }
                ],
                "packageState": null,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "distanceKm": 1.2,
                "ratingSummary": {
                  "averageRating": 4.6,
                  "totalReviews": 138
                },
                "menuItems": [
                  {
                    "itemId": "miTacos01",
                    "name": "Tacos al pastor (3)",
                    "description": "Three corn-tortilla tacos.",
                    "price": 95.0,
                    "pointsToBuy": 200,
                    "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
                    "isAvailable": true,
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "reviews": [
                  {
                    "id": "rvAa1b2c3",
                    "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                    "userFullname": "Jane Doe",
                    "userEmail": "jane@example.com",
                    "rating": 5,
                    "comment": "Excellent service.",
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "isFavorite": false,
                "isCheckedIn": false,
                "lastCheckedInAt": null,
                "cooldownEndsAt": null,
                "userCheckinCount": 3,
                "todayCheckinCount": 0
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'PUT /api/v1/admin/restaurants/{restaurant_id}': {
    requestBody: makeMultipartRequestBody({
      description: 'Update a restaurant.',
      properties: {
        name: stringProperty('Restaurant name.'),
        address: stringProperty('Restaurant address.'),
        city: stringProperty('Optional restaurant city.'),
        latitude: numberProperty('Restaurant latitude.', -90, 90),
        longitude: numberProperty('Restaurant longitude.', -180, 180),
        category: stringProperty('Restaurant category.'),
        openingTime: stringProperty('Opening time in HH:mm format.'),
        closingTime: stringProperty('Closing time in HH:mm format.'),
        qrCodeName: stringProperty('QR code label.'),
        qrCodeLatitude: numberProperty('QR code latitude.', -90, 90),
        qrCodeLongitude: numberProperty('QR code longitude.', -180, 180),
        qrCodeToken: stringProperty('QR token string.'),
        pointsPerCheckIn: integerProperty('Points granted for a check-in.', 0, 10000),
        receiptUploadEnabled: booleanProperty('Whether users can upload receipts after check-in.'),
        pointsPerReceiptUpload: integerProperty(
          'Points granted when a user uploads a receipt after check-in.',
          0,
          10000,
        ),
        imageUrl: stringProperty('Existing image URL when no replacement image is uploaded.'),
        image: binaryProperty('Optional replacement restaurant image upload.'),
      },
    }),
    responses: {
      "200": {
        "description": "Updated restaurant.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Restaurant"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "name": "La Casa del Taco",
                "address": "Av. Reforma 222, CDMX",
                "city": "Mexico City",
                "country": "Mexico",
                "latitude": 19.4326,
                "longitude": -99.1332,
                "category": "Mexican",
                "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                "openingTime": "09:00",
                "closingTime": "23:00",
                "pointsPerCheckIn": 50,
                "pointsPerReceiptUpload": 100,
                "receiptUploadEnabled": true,
                "pointsPerSocialShare": 25,
                "checkinRadiusMeters": 100,
                "qrRequired": true,
                "status": "active",
                "qrCode": {
                  "name": "Main Entrance",
                  "token": "qr_tok_abc123",
                  "location": {
                    "latitude": 19.4326,
                    "longitude": -99.1332
                  }
                },
                "enabledPackages": [
                  "start",
                  "active"
                ],
                "enabledFeatures": [
                  {
                    "key": "checkin",
                    "name": "Check-in",
                    "enabled": true
                  },
                  {
                    "key": "receipt",
                    "name": "Receipt Upload",
                    "enabled": true
                  }
                ],
                "packageState": null,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "distanceKm": 1.2,
                "ratingSummary": {
                  "averageRating": 4.6,
                  "totalReviews": 138
                },
                "menuItems": [
                  {
                    "itemId": "miTacos01",
                    "name": "Tacos al pastor (3)",
                    "description": "Three corn-tortilla tacos.",
                    "price": 95.0,
                    "pointsToBuy": 200,
                    "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
                    "isAvailable": true,
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "reviews": [
                  {
                    "id": "rvAa1b2c3",
                    "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                    "userFullname": "Jane Doe",
                    "userEmail": "jane@example.com",
                    "rating": 5,
                    "comment": "Excellent service.",
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "isFavorite": false,
                "isCheckedIn": false,
                "lastCheckedInAt": null,
                "cooldownEndsAt": null,
                "userCheckinCount": 3,
                "todayCheckinCount": 0
              },
              "message": "OK"
            }
          }
        }
      }
},},
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
    responses: {
      "201": {
        "description": "Created menu item.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "itemId": {
                  "type": "string"
                },
                "restaurantId": {
                  "type": "string"
                },
                "restaurantName": {
                  "type": "string"
                },
                "name": {
                  "type": "string"
                },
                "description": {
                  "type": "string",
                  "nullable": true
                },
                "price": {
                  "type": "number"
                },
                "pointsToBuy": {
                  "type": "integer"
                },
                "imageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "isAvailable": {
                  "type": "boolean"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time"
                }
              }
            },
            "example": {
              "itemId": "miTacos01",
              "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
              "restaurantName": "La Casa del Taco",
              "name": "Tacos al pastor (3)",
              "description": "Three corn-tortilla tacos.",
              "price": 95.0,
              "pointsToBuy": 200,
              "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
              "isAvailable": true,
              "createdAt": "2026-07-20T12:00:00.000Z",
              "updatedAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Updated menu item.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "itemId": {
                  "type": "string"
                },
                "restaurantId": {
                  "type": "string"
                },
                "restaurantName": {
                  "type": "string"
                },
                "name": {
                  "type": "string"
                },
                "description": {
                  "type": "string",
                  "nullable": true
                },
                "price": {
                  "type": "number"
                },
                "pointsToBuy": {
                  "type": "integer"
                },
                "imageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "isAvailable": {
                  "type": "boolean"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time"
                }
              }
            },
            "example": {
              "itemId": "miTacos01",
              "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
              "restaurantName": "La Casa del Taco",
              "name": "Tacos al pastor (3)",
              "description": "Three corn-tortilla tacos.",
              "price": 95.0,
              "pointsToBuy": 200,
              "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
              "isAvailable": true,
              "createdAt": "2026-07-20T12:00:00.000Z",
              "updatedAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
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
    responses: {
      "201": {
        "description": "Created daily reward.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "id": {
                  "type": "string"
                },
                "title": {
                  "type": "string"
                },
                "description": {
                  "type": "string",
                  "nullable": true
                },
                "rewardCategory": {
                  "type": "string"
                },
                "pointsReward": {
                  "type": "integer",
                  "nullable": true
                },
                "discountPercentage": {
                  "type": "integer"
                },
                "quantityAvailable": {
                  "type": "integer"
                },
                "probability": {
                  "type": "integer"
                },
                "imageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "isActive": {
                  "type": "boolean"
                },
                "hasExpiry": {
                  "type": "boolean"
                },
                "expiresAt": {
                  "type": "string",
                  "format": "date-time",
                  "nullable": true
                }
              }
            },
            "example": {
              "id": "dlyAa1b2c3",
              "title": "10% Off",
              "description": "10% off your next order.",
              "rewardCategory": "discount",
              "pointsReward": 0,
              "discountPercentage": 10,
              "quantityAvailable": 1000,
              "probability": 25,
              "imageUrl": null,
              "isActive": true,
              "hasExpiry": false,
              "expiresAt": null
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Updated daily reward.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "id": {
                  "type": "string"
                },
                "title": {
                  "type": "string"
                },
                "description": {
                  "type": "string",
                  "nullable": true
                },
                "rewardCategory": {
                  "type": "string"
                },
                "pointsReward": {
                  "type": "integer",
                  "nullable": true
                },
                "discountPercentage": {
                  "type": "integer"
                },
                "quantityAvailable": {
                  "type": "integer"
                },
                "probability": {
                  "type": "integer"
                },
                "imageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "isActive": {
                  "type": "boolean"
                },
                "hasExpiry": {
                  "type": "boolean"
                },
                "expiresAt": {
                  "type": "string",
                  "format": "date-time",
                  "nullable": true
                }
              }
            },
            "example": {
              "id": "dlyAa1b2c3",
              "title": "10% Off",
              "description": "10% off your next order.",
              "rewardCategory": "discount",
              "pointsReward": 0,
              "discountPercentage": 10,
              "quantityAvailable": 1000,
              "probability": 25,
              "imageUrl": null,
              "isActive": true,
              "hasExpiry": false,
              "expiresAt": null
            }
          }
        }
      }
},},
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
    responses: {
      "201": {
        "description": "Created reward.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Reward"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rwDxK9pN2qLmYjFvRt8sHcEgUbW",
                "title": "Free Tacos al pastor",
                "description": "Redeem for a free order of Tacos al pastor.",
                "pointsRequired": 200,
                "quantityAvailable": 120,
                "rewardCategory": "food",
                "xpPoints": 50,
                "foodItemName": "Tacos al pastor (3)",
                "discountPercentage": null,
                "giftCardCode": null,
                "termsAndConditions": "Valid for dine-in only.",
                "imageUrl": "https://cdn.foodroute.app/rewards/tacos.png",
                "isActive": true,
                "hasExpiry": false,
                "expiresAt": null,
                "status": "active",
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "canRedeem": true,
                "userPoints": 540
              },
              "message": "OK"
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Updated reward.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Reward"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rwDxK9pN2qLmYjFvRt8sHcEgUbW",
                "title": "Free Tacos al pastor",
                "description": "Redeem for a free order of Tacos al pastor.",
                "pointsRequired": 200,
                "quantityAvailable": 120,
                "rewardCategory": "food",
                "xpPoints": 50,
                "foodItemName": "Tacos al pastor (3)",
                "discountPercentage": null,
                "giftCardCode": null,
                "termsAndConditions": "Valid for dine-in only.",
                "imageUrl": "https://cdn.foodroute.app/rewards/tacos.png",
                "isActive": true,
                "hasExpiry": false,
                "expiresAt": null,
                "status": "active",
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "canRedeem": true,
                "userPoints": 540
              },
              "message": "OK"
            }
          }
        }
      }
},},
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
    responses: {
      "201": {
        "description": "Created campaign.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/NotificationCampaign"
            },
            "example": {
              "success": true,
              "data": {
                "id": "ncAa1b2c3",
                "campaignTitle": "Summer Tacos",
                "campaignBody": "Earn 2x points at any taqueria this summer!",
                "campaignCategory": "promotions",
                "targetAudience": "all",
                "cityName": null,
                "ageGroup": null,
                "deliveryType": "immediate",
                "scheduledAt": null,
                "status": "sent",
                "deliveryRate": 92.5,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "sentAt": "2026-07-20T12:00:00.000Z",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Updated campaign.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/NotificationCampaign"
            },
            "example": {
              "success": true,
              "data": {
                "id": "ncAa1b2c3",
                "campaignTitle": "Summer Tacos",
                "campaignBody": "Earn 2x points at any taqueria this summer!",
                "campaignCategory": "promotions",
                "targetAudience": "all",
                "cityName": null,
                "ageGroup": null,
                "deliveryType": "immediate",
                "scheduledAt": null,
                "status": "sent",
                "deliveryRate": 92.5,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "sentAt": "2026-07-20T12:00:00.000Z",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/notifications': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('category', 'Optional notification category filter.'),
    ]),
    responses: {
      "200": {
        "description": "Notifications.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/NotificationListEnvelope"
            },
            "example": {
              "success": true,
              "data": {
                "items": [
                  {
                    "id": "ntAa1b2c3",
                    "type": "promotion",
                    "category": "challenges",
                    "title": "Visit 5 taquerías",
                    "body": "Earn 500 points!",
                    "sourceId": "chAa1b2c3",
                    "targetType": "challenge",
                    "targetId": "chAa1b2c3",
                    "targetUrl": "foodroute://challenge/chAa1b2c3",
                    "pointsDelta": null,
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "isRead": false
                  },
                  {
                    "id": "ntBb2c3d4",
                    "type": "promotion",
                    "category": "rewards",
                    "title": "Reward redeemed",
                    "body": "Earn 500 points!",
                    "sourceId": "chAa1b2c3",
                    "targetType": "challenge",
                    "targetId": "chAa1b2c3",
                    "targetUrl": "foodroute://challenge/chAa1b2c3",
                    "pointsDelta": null,
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "isRead": true
                  }
                ],
                "pagination": {
                  "page": 1,
                  "pageSize": 20,
                  "totalItems": 8,
                  "totalPages": 1
                },
                "unreadCount": 1
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/notifications/preview': {
    parameters: makeQueryParameters([
      integerParam('limit', 'Preview item limit.'),
    ]),
    responses: {
      "200": {
        "description": "Notification preview.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Notification"
                  }
                },
                "unreadCount": {
                  "type": "integer"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "ntAa1b2c3",
                  "type": "promotion",
                  "category": "challenges",
                  "title": "Visit 5 taquerías",
                  "body": "Earn 500 points!",
                  "sourceId": "chAa1b2c3",
                  "targetType": "challenge",
                  "targetId": "chAa1b2c3",
                  "targetUrl": "foodroute://challenge/chAa1b2c3",
                  "pointsDelta": null,
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "isRead": false
                }
              ],
              "unreadCount": 1
            }
          }
        }
      }
},},
  'PUT /api/v1/cms/admin/about-us': {
    requestBody: makeJsonRequestBody({
      description: 'Upsert the About Us CMS page.',
      properties: {
        title: stringProperty('Optional page title.'),
        content: stringProperty('HTML or rich-text page content.'),
      },
    }),
    responses: {
      "200": {
        "description": "About Us page.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/CmsPage"
            },
            "example": {
              "success": true,
              "data": {
                "slug": "about-us",
                "title": "About Food Route",
                "content": "<h1>About Food Route</h1><p>Welcome...</p>",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'PUT /api/v1/cms/admin/privacy-policy': {
    requestBody: makeJsonRequestBody({
      description: 'Upsert the Privacy Policy CMS page.',
      properties: {
        title: stringProperty('Optional page title.'),
        content: stringProperty('HTML or rich-text page content.'),
      },
    }),
    responses: {
      "200": {
        "description": "Privacy Policy page.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/CmsPage"
            },
            "example": {
              "success": true,
              "data": {
                "slug": "privacy-policy",
                "title": "Privacy Policy",
                "content": "<h1>About Food Route</h1><p>Welcome...</p>",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'PUT /api/v1/cms/admin/terms-and-conditions': {
    requestBody: makeJsonRequestBody({
      description: 'Upsert the Terms and Conditions CMS page.',
      properties: {
        title: stringProperty('Optional page title.'),
        content: stringProperty('HTML or rich-text page content.'),
      },
    }),
    responses: {
      "200": {
        "description": "Terms page.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/CmsPage"
            },
            "example": {
              "success": true,
              "data": {
                "slug": "terms-and-conditions",
                "title": "Terms and Conditions",
                "content": "<h1>About Food Route</h1><p>Welcome...</p>",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
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
    responses: {
      "201": {
        "description": "Created CMS page.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/CmsPage"
            },
            "example": {
              "success": true,
              "data": {
                "slug": "about-us",
                "title": "About Food Route",
                "content": "<h1>About Food Route</h1><p>Welcome...</p>",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'PATCH /api/v1/cms/admin/pages/{slug}': {
    requestBody: makeJsonRequestBody({
      description: 'Update a CMS page.',
      properties: {
        title: stringProperty('Page title.'),
        content: stringProperty('HTML or rich-text page content.'),
      },
    }),
    responses: {
      "200": {
        "description": "Updated CMS page.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/CmsPage"
            },
            "example": {
              "success": true,
              "data": {
                "slug": "about-us",
                "title": "About Food Route",
                "content": "<h1>About Food Route</h1><p>Welcome...</p>",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/users/me/push-token': {
    requestBody: makeJsonRequestBody({
      description:
        'Register the current user push token. When using OneSignal, backend delivery can target external_id after the app calls OneSignal.login(userId).',
      required: ['pushToken'],
      properties: {
        pushToken: stringProperty(
          'Push notification token or optional OneSignal subscription id for diagnostics or fallback delivery.',
        ),
        subscriptionId: stringProperty(
          'Optional alias for pushToken when sending a OneSignal subscription id.',
        ),
        platform: stringProperty('Optional platform, such as ios or android.'),
        provider: stringProperty('Optional provider label, such as onesignal or firebase.'),
      },
    }),
    responses: {
      "200": {
        "description": "Push token registration.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "pushTokenRegistered"
              ],
              "properties": {
                "pushTokenRegistered": {
                  "type": "boolean"
                },
                "subscriptionId": {
                  "type": "string",
                  "nullable": true
                },
                "platform": {
                  "type": "string",
                  "nullable": true
                },
                "provider": {
                  "type": "string",
                  "nullable": true
                }
              }
            },
            "example": {
              "pushTokenRegistered": true,
              "subscriptionId": null,
              "platform": "ios",
              "provider": "onesignal"
            }
          }
        }
      }
},},
  'POST /api/v1/users/me/social-share-reward': {
    requestBody: makeJsonRequestBody({
      description: 'Claim a social-share reward for one owned check-in or reward redemption.',
      required: ['shareType'],
      properties: {
        shareType: stringProperty("Share type. Supported values: 'checkin' or 'reward'."),
        entityId: stringProperty('Owned check-in id or reward redemption id being shared.'),
        platform: stringProperty('Optional social platform name.'),
        shareUrl: stringProperty('Optional shared URL.'),
      },
    }),
    responses: {
      "200": {
        "description": "Social share reward result.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "awarded",
                "shareType",
                "entityId",
                "pointsDelta",
                "currentPoints"
              ],
              "properties": {
                "awarded": {
                  "type": "boolean"
                },
                "shareType": {
                  "type": "string"
                },
                "entityId": {
                  "type": "string"
                },
                "pointsDelta": {
                  "type": "integer"
                },
                "currentPoints": {
                  "type": "integer"
                }
              }
            },
            "example": {
              "awarded": true,
              "shareType": "checkin",
              "entityId": "chkA1b2c3d4e5f6",
              "pointsDelta": 25,
              "currentPoints": 565
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/share/check-ins/{checkin_id}/preview': {
    description:
      'Get share preview content for one owned check-in, including title, text, image, and the available social-share reward points.',
    responses: {
      "200": {
        "description": "Share preview.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/SharePreview"
            },
            "example": {
              "success": true,
              "data": {
                "shareType": "checkin",
                "entityId": "chkA1b2c3d4e5f6",
                "title": "I just checked in at La Casa del Taco",
                "text": "Earn points every time you check in!",
                "imageUrl": "https://cdn.foodroute.app/preview/checkin.png",
                "pointsReward": 50,
                "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "restaurantName": "La Casa del Taco",
                "rewardId": null,
                "rewardTitle": null,
                "rewardCategory": null,
                "awardedPoints": null,
                "redeemedAt": null,
                "createdAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/share/rewards/{redemption_id}/preview': {
    description:
      'Get share preview content for one owned reward redemption, including title, text, image, and the available social-share reward points.',
    responses: {
      "200": {
        "description": "Share preview.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/SharePreview"
            },
            "example": {
              "success": true,
              "data": {
                "shareType": "checkin",
                "entityId": "chkA1b2c3d4e5f6",
                "title": "I just checked in at La Casa del Taco",
                "text": "Earn points every time you check in!",
                "imageUrl": "https://cdn.foodroute.app/preview/checkin.png",
                "pointsReward": 50,
                "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "restaurantName": "La Casa del Taco",
                "rewardId": null,
                "rewardTitle": null,
                "rewardCategory": null,
                "awardedPoints": null,
                "redeemedAt": null,
                "createdAt": "2026-07-20T12:00:00.000Z"
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/admin/packages/restaurants/{restaurant_id}/activate': {
    requestBody: makeJsonRequestBody({
      description: 'Activate a restaurant package.',
      required: ['package'],
      properties: {
        package: stringProperty('Package key such as start, active, pro, prime, or dominio.'),
      },
    }),
    responses: {
      "200": {
        "description": "Activated restaurant.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Restaurant"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "name": "La Casa del Taco",
                "address": "Av. Reforma 222, CDMX",
                "city": "Mexico City",
                "country": "Mexico",
                "latitude": 19.4326,
                "longitude": -99.1332,
                "category": "Mexican",
                "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                "openingTime": "09:00",
                "closingTime": "23:00",
                "pointsPerCheckIn": 50,
                "pointsPerReceiptUpload": 100,
                "receiptUploadEnabled": true,
                "pointsPerSocialShare": 25,
                "checkinRadiusMeters": 100,
                "qrRequired": true,
                "status": "active",
                "qrCode": {
                  "name": "Main Entrance",
                  "token": "qr_tok_abc123",
                  "location": {
                    "latitude": 19.4326,
                    "longitude": -99.1332
                  }
                },
                "enabledPackages": [
                  "start",
                  "active"
                ],
                "enabledFeatures": [
                  {
                    "key": "checkin",
                    "name": "Check-in",
                    "enabled": true
                  },
                  {
                    "key": "receipt",
                    "name": "Receipt Upload",
                    "enabled": true
                  }
                ],
                "packageState": null,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "distanceKm": 1.2,
                "ratingSummary": {
                  "averageRating": 4.6,
                  "totalReviews": 138
                },
                "menuItems": [
                  {
                    "itemId": "miTacos01",
                    "name": "Tacos al pastor (3)",
                    "description": "Three corn-tortilla tacos.",
                    "price": 95.0,
                    "pointsToBuy": 200,
                    "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
                    "isAvailable": true,
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "reviews": [
                  {
                    "id": "rvAa1b2c3",
                    "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                    "userFullname": "Jane Doe",
                    "userEmail": "jane@example.com",
                    "rating": 5,
                    "comment": "Excellent service.",
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "isFavorite": false,
                "isCheckedIn": false,
                "lastCheckedInAt": null,
                "cooldownEndsAt": null,
                "userCheckinCount": 3,
                "todayCheckinCount": 0
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'POST /api/v1/admin/packages/restaurants/{restaurant_id}/upgrade': {
    requestBody: makeJsonRequestBody({
      description: 'Upgrade a restaurant package.',
      required: ['package'],
      properties: {
        package: stringProperty('Target package key such as start, active, pro, prime, or dominio.'),
      },
    }),
    responses: {
      "200": {
        "description": "Upgraded restaurant.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Restaurant"
            },
            "example": {
              "success": true,
              "data": {
                "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                "name": "La Casa del Taco",
                "address": "Av. Reforma 222, CDMX",
                "city": "Mexico City",
                "country": "Mexico",
                "latitude": 19.4326,
                "longitude": -99.1332,
                "category": "Mexican",
                "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                "openingTime": "09:00",
                "closingTime": "23:00",
                "pointsPerCheckIn": 50,
                "pointsPerReceiptUpload": 100,
                "receiptUploadEnabled": true,
                "pointsPerSocialShare": 25,
                "checkinRadiusMeters": 100,
                "qrRequired": true,
                "status": "active",
                "qrCode": {
                  "name": "Main Entrance",
                  "token": "qr_tok_abc123",
                  "location": {
                    "latitude": 19.4326,
                    "longitude": -99.1332
                  }
                },
                "enabledPackages": [
                  "start",
                  "active"
                ],
                "enabledFeatures": [
                  {
                    "key": "checkin",
                    "name": "Check-in",
                    "enabled": true
                  },
                  {
                    "key": "receipt",
                    "name": "Receipt Upload",
                    "enabled": true
                  }
                ],
                "packageState": null,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "distanceKm": 1.2,
                "ratingSummary": {
                  "averageRating": 4.6,
                  "totalReviews": 138
                },
                "menuItems": [
                  {
                    "itemId": "miTacos01",
                    "name": "Tacos al pastor (3)",
                    "description": "Three corn-tortilla tacos.",
                    "price": 95.0,
                    "pointsToBuy": 200,
                    "imageUrl": "https://cdn.foodroute.app/menu/tacos.png",
                    "isAvailable": true,
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "reviews": [
                  {
                    "id": "rvAa1b2c3",
                    "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "userId": "8wvhcoqcTEXbRk9V1VzcBv4oom2",
                    "userFullname": "Jane Doe",
                    "userEmail": "jane@example.com",
                    "rating": 5,
                    "comment": "Excellent service.",
                    "createdAt": "2026-07-20T12:00:00.000Z",
                    "updatedAt": "2026-07-20T12:00:00.000Z"
                  }
                ],
                "isFavorite": false,
                "isCheckedIn": false,
                "lastCheckedInAt": null,
                "cooldownEndsAt": null,
                "userCheckinCount": 3,
                "todayCheckinCount": 0
              },
              "message": "OK"
            }
          }
        }
      }
},},
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
    responses: {
      "201": {
        "description": "Created route.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Route"
            },
            "example": {
              "success": true,
              "data": {
                "id": "routeCityTour",
                "routeName": "CDMX City Tour",
                "description": "A curated taco crawl.",
                "city": "Mexico City",
                "zone": "Centro",
                "neighborhood": "Reforma",
                "restaurantIds": [
                  "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "rBvN4zeM6oAcDrX2lU9vItQykEe"
                ],
                "restaurants": [
                  {
                    "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "name": "La Casa del Taco",
                    "address": "Av. Reforma 222, CDMX",
                    "city": "Mexico City",
                    "latitude": 19.4326,
                    "longitude": -99.1332,
                    "category": "Mexican",
                    "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                    "currentPackage": "active",
                    "billingCycle": "monthly",
                    "routeFeatureEnabled": true
                  }
                ],
                "restaurantCount": 2,
                "status": "active",
                "startDate": "2026-07-20T12:00:00.000Z",
                "endDate": "2026-07-21T12:00:00.000Z",
                "requiredVisits": 2,
                "mandatoryOrder": false,
                "pointsPerReceiptUpload": 100,
                "completionBonus": 200,
                "limitPerUser": 1,
                "repeatable": false,
                "cooldownMinutes": 60,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "userProgress": null
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/admin/routes/analytics': {
    description: 'List route analytics derived from check-ins at route restaurants. Route visit events are not tracked yet.',
    parameters: makeQueryParameters([
      stringParam('range', 'Analytics range: last_7_days, last_30_days, or last_90_days.'),
    ]),
    responses: {
      "200": {
        "description": "Route analytics.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "range": {
                  "type": "string"
                },
                "items": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "routeId": {
                        "type": "string"
                      },
                      "routeName": {
                        "type": "string"
                      },
                      "city": {
                        "type": "string"
                      },
                      "restaurantCount": {
                        "type": "integer"
                      },
                      "participants": {
                        "type": "integer"
                      },
                      "completions": {
                        "type": "integer"
                      },
                      "completionRate": {
                        "type": "number"
                      }
                    }
                  }
                }
              }
            },
            "example": {
              "range": "last_30_days",
              "items": [
                {
                  "routeId": "routeCityTour",
                  "routeName": "CDMX City Tour",
                  "city": "Mexico City",
                  "restaurantCount": 2,
                  "participants": 84,
                  "completions": 28,
                  "completionRate": 33.3
                }
              ]
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Updated route.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Route"
            },
            "example": {
              "success": true,
              "data": {
                "id": "routeCityTour",
                "routeName": "CDMX City Tour",
                "description": "A curated taco crawl.",
                "city": "Mexico City",
                "zone": "Centro",
                "neighborhood": "Reforma",
                "restaurantIds": [
                  "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "rBvN4zeM6oAcDrX2lU9vItQykEe"
                ],
                "restaurants": [
                  {
                    "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "name": "La Casa del Taco",
                    "address": "Av. Reforma 222, CDMX",
                    "city": "Mexico City",
                    "latitude": 19.4326,
                    "longitude": -99.1332,
                    "category": "Mexican",
                    "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                    "currentPackage": "active",
                    "billingCycle": "monthly",
                    "routeFeatureEnabled": true
                  }
                ],
                "restaurantCount": 2,
                "status": "active",
                "startDate": "2026-07-20T12:00:00.000Z",
                "endDate": "2026-07-21T12:00:00.000Z",
                "requiredVisits": 2,
                "mandatoryOrder": false,
                "pointsPerReceiptUpload": 100,
                "completionBonus": 200,
                "limitPerUser": 1,
                "repeatable": false,
                "cooldownMinutes": 60,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "userProgress": null
              },
              "message": "OK"
            }
          }
        }
      }
},},
  'GET /api/v1/admin/routes': {
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
      stringParam('city', 'Optional city filter.'),
      stringParam('status', 'Optional route status filter.'),
    ]),
    responses: {
      "200": {
        "description": "Routes.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Route"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "routeCityTour",
                  "routeName": "CDMX City Tour",
                  "description": "A curated taco crawl.",
                  "city": "Mexico City",
                  "zone": "Centro",
                  "neighborhood": "Reforma",
                  "restaurantIds": [
                    "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "rBvN4zeM6oAcDrX2lU9vItQykEe"
                  ],
                  "restaurants": [
                    {
                      "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                      "name": "La Casa del Taco",
                      "address": "Av. Reforma 222, CDMX",
                      "city": "Mexico City",
                      "latitude": 19.4326,
                      "longitude": -99.1332,
                      "category": "Mexican",
                      "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                      "currentPackage": "active",
                      "billingCycle": "monthly",
                      "routeFeatureEnabled": true
                    }
                  ],
                  "restaurantCount": 2,
                  "status": "active",
                  "startDate": "2026-07-20T12:00:00.000Z",
                  "endDate": "2026-07-21T12:00:00.000Z",
                  "requiredVisits": 2,
                  "mandatoryOrder": false,
                  "pointsPerReceiptUpload": 100,
                  "completionBonus": 200,
                  "limitPerUser": 1,
                  "repeatable": false,
                  "cooldownMinutes": 60,
                  "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "userProgress": null
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 12,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
  'GET /api/v1/admin/routes/restaurants/search': {
    parameters: makeQueryParameters([
      stringParam('city', 'Optional city filter.'),
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
    ]),
    responses: {
      "200": {
        "description": "Route restaurants search.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/RestaurantListItem"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "name": "La Casa del Taco",
                  "address": "Av. Reforma 222, CDMX",
                  "city": "Mexico City",
                  "latitude": 19.4326,
                  "longitude": -99.1332,
                  "category": "Mexican",
                  "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "pointsPerCheckIn": 50,
                  "distanceKm": 1.2,
                  "ratingSummary": {
                    "averageRating": 4.6,
                    "totalReviews": 138
                  },
                  "isFavorite": false,
                  "isCheckedIn": false,
                  "lastCheckedInAt": null,
                  "cooldownEndsAt": null,
                  "userCheckinCount": 3,
                  "todayCheckinCount": 0
                },
                {
                  "id": "rBvN4zeM6oAcDrX2lU9vItQykEe",
                  "name": "Sushi Itto",
                  "address": "Av. Reforma 222, CDMX",
                  "city": "Mexico City",
                  "latitude": 19.4326,
                  "longitude": -99.1332,
                  "category": "Mexican",
                  "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "pointsPerCheckIn": 50,
                  "distanceKm": 1.2,
                  "ratingSummary": {
                    "averageRating": 4.6,
                    "totalReviews": 138
                  },
                  "isFavorite": false,
                  "isCheckedIn": false,
                  "lastCheckedInAt": null,
                  "cooldownEndsAt": null,
                  "userCheckinCount": 3,
                  "todayCheckinCount": 0
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 24,
                "totalPages": 2
              }
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/routes': {
    description: 'List routes available for the authenticated user. No request body.',
    parameters: makeQueryParameters([
      integerParam('page', 'Page number.', true),
      integerParam('pageSize', 'Page size.', true),
      stringParam('search', 'Optional search term.'),
    ]),
    responses: {
      "200": {
        "description": "Routes available.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items",
                "pagination"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Route"
                  }
                },
                "pagination": {
                  "$ref": "#/components/schemas/Pagination"
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "routeCityTour",
                  "routeName": "CDMX City Tour",
                  "description": "A curated taco crawl.",
                  "city": "Mexico City",
                  "zone": "Centro",
                  "neighborhood": "Reforma",
                  "restaurantIds": [
                    "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "rBvN4zeM6oAcDrX2lU9vItQykEe"
                  ],
                  "restaurants": [
                    {
                      "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                      "name": "La Casa del Taco",
                      "address": "Av. Reforma 222, CDMX",
                      "city": "Mexico City",
                      "latitude": 19.4326,
                      "longitude": -99.1332,
                      "category": "Mexican",
                      "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                      "currentPackage": "active",
                      "billingCycle": "monthly",
                      "routeFeatureEnabled": true
                    }
                  ],
                  "restaurantCount": 2,
                  "status": "active",
                  "startDate": "2026-07-20T12:00:00.000Z",
                  "endDate": "2026-07-21T12:00:00.000Z",
                  "requiredVisits": 2,
                  "mandatoryOrder": false,
                  "pointsPerReceiptUpload": 100,
                  "completionBonus": 200,
                  "limitPerUser": 1,
                  "repeatable": false,
                  "cooldownMinutes": 60,
                  "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z",
                  "userProgress": null
                }
              ],
              "pagination": {
                "page": 1,
                "pageSize": 20,
                "totalItems": 8,
                "totalPages": 1
              }
            }
          }
        }
      }
},},
  'GET /api/v1/users/me/routes/{routeId}': {
    description: 'Get one route available for the authenticated user. No request body.',
    responses: {
      "200": {
        "description": "Route.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Route"
            },
            "example": {
              "success": true,
              "data": {
                "id": "routeCityTour",
                "routeName": "CDMX City Tour",
                "description": "A curated taco crawl.",
                "city": "Mexico City",
                "zone": "Centro",
                "neighborhood": "Reforma",
                "restaurantIds": [
                  "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "rBvN4zeM6oAcDrX2lU9vItQykEe"
                ],
                "restaurants": [
                  {
                    "id": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                    "name": "La Casa del Taco",
                    "address": "Av. Reforma 222, CDMX",
                    "city": "Mexico City",
                    "latitude": 19.4326,
                    "longitude": -99.1332,
                    "category": "Mexican",
                    "imageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                    "currentPackage": "active",
                    "billingCycle": "monthly",
                    "routeFeatureEnabled": true
                  }
                ],
                "restaurantCount": 2,
                "status": "active",
                "startDate": "2026-07-20T12:00:00.000Z",
                "endDate": "2026-07-21T12:00:00.000Z",
                "requiredVisits": 2,
                "mandatoryOrder": false,
                "pointsPerReceiptUpload": 100,
                "completionBonus": 200,
                "limitPerUser": 1,
                "repeatable": false,
                "cooldownMinutes": 60,
                "createdBy": "A9Pq3YskTQeBnMvLz2cDwfH7xKp",
                "createdAt": "2026-07-20T12:00:00.000Z",
                "updatedAt": "2026-07-20T12:00:00.000Z",
                "userProgress": null
              },
              "message": "OK"
            }
          }
        }
      }
},},
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
    responses: {
      "201": {
        "description": "Created placement.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "id": {
                  "type": "string"
                },
                "feature": {
                  "type": "string"
                },
                "active": {
                  "type": "boolean"
                },
                "sortOrder": {
                  "type": "integer"
                },
                "restaurantId": {
                  "type": "string"
                },
                "restaurantName": {
                  "type": "string"
                },
                "restaurantCategory": {
                  "type": "string"
                },
                "restaurantAddress": {
                  "type": "string"
                },
                "restaurantImageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time"
                }
              }
            },
            "example": {
              "id": "plAa1b2c3",
              "feature": "sponsored",
              "active": true,
              "sortOrder": 1,
              "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
              "restaurantName": "La Casa del Taco",
              "restaurantCategory": "Mexican",
              "restaurantAddress": "Av. Reforma 222, CDMX",
              "restaurantImageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
              "createdAt": "2026-07-20T12:00:00.000Z",
              "updatedAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
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
    responses: {
      "200": {
        "description": "Toggled placement.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "id": {
                  "type": "string"
                },
                "feature": {
                  "type": "string"
                },
                "active": {
                  "type": "boolean"
                },
                "sortOrder": {
                  "type": "integer"
                },
                "restaurantId": {
                  "type": "string"
                },
                "restaurantName": {
                  "type": "string"
                },
                "restaurantCategory": {
                  "type": "string"
                },
                "restaurantAddress": {
                  "type": "string"
                },
                "restaurantImageUrl": {
                  "type": "string",
                  "nullable": true
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time"
                }
              }
            },
            "example": {
              "id": "plAa1b2c3",
              "feature": "sponsored",
              "active": false,
              "sortOrder": 1,
              "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
              "restaurantName": "La Casa del Taco",
              "restaurantCategory": "Mexican",
              "restaurantAddress": "Av. Reforma 222, CDMX",
              "restaurantImageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
              "createdAt": "2026-07-20T12:00:00.000Z",
              "updatedAt": "2026-07-20T12:00:00.000Z"
            }
          }
        }
      }
},},
  'GET /api/v1/admin/placements/feature/{feature}': {
    responses: {
      "200": {
        "description": "Placements by feature.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "items"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Placement"
                  }
                }
              }
            },
            "example": {
              "items": [
                {
                  "id": "plAa1b2c3",
                  "feature": "sponsored",
                  "active": true,
                  "sortOrder": 1,
                  "restaurantId": "rAvM3yeL5nZbCqW1kT8uHsPxjDd",
                  "restaurantName": "La Casa del Taco",
                  "restaurantCategory": "Mexican",
                  "restaurantAddress": "Av. Reforma 222, CDMX",
                  "restaurantImageUrl": "https://cdn.foodroute.app/restaurants/lacasa.png",
                  "createdAt": "2026-07-20T12:00:00.000Z",
                  "updatedAt": "2026-07-20T12:00:00.000Z"
                }
              ]
            }
          }
        }
      }
},},
  'GET /api/v1/admin/placements/features': {
    responses: {
      "200": {
        "description": "Available placement features.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "features": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              }
            },
            "example": {
              "features": [
                "sponsored",
                "featured",
                "trending"
              ]
            }
          }
        }
      }
},},
  'POST /api/v1/rewards/{reward_id}/redeem': {
    description:
      'Redeem a reward from the catalog. Idempotent via Idempotency-Key. BR-006 atomic: 1/reward/user, 3/day max, 7-day code expiry.',
    responses: {
      '201': successEnvelope(
        'RedemptionResponse',
        'Redemption created with wallet deduction and unique code.',
        {
          success: true,
          data: {
            redemption: {
              id: 'rrAa1b2c3d4e5f6',
              rewardId: 'rAvM3yeL5nZbCqW1kT8uHsPxjDd',
              userId: '8wvhcoqcTEXbRk9V1VzcBv4oom2',
              sourceType: 'reward_redemption',
              sourceId: 'rrAa1b2c3d4e5f6',
              rewardTitle: 'Bluetooth Headphones',
              rewardDescription: 'Premium wireless headphones',
              rewardImageUrl: 'https://cdn.example.com/headphones.png',
              rewardCategory: 'general_rewards',
              pointsRequired: 100,
              xpPoints: null,
              foodItemName: null,
              discountPercentage: null,
              giftCardCode: null,
              redemptionCode: 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D',
              termsAndConditions: null,
              status: 'pending',
              redeemedAt: '2026-07-20T12:00:00.000Z',
              usedAt: null,
              expiresAt: '2026-07-27T12:00:00.000Z',
              createdAt: '2026-07-20T12:00:00.000Z',
              updatedAt: '2026-07-20T12:00:00.000Z',
            },
            userXpAfter: 350,
            userPointsAfter: 440,
            remainingQuantityAvailable: 4,
          },
          message: 'Reward redeemed successfully.',
        },
      ),
      '400': {
        description: 'reward_inactive, reward_expired, reward_out_of_stock, insufficient_reward_points',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'reward_out_of_stock',
                message: 'This reward is currently out of stock.',
                requestId: 'req-abc-123',
              },
            },
          },
        },
      },
      '409': {
        description: 'reward_already_redeemed or daily_reward_redemption_limit_reached',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },
  'POST /api/v1/users/me/rewards/{redemption_id}/redeem': {
    description: 'Mark a pending user redemption as used.',
    responses: {
      '200': successEnvelope(
        'RedemptionResponse',
        'Redemption updated to status=used.',
        {
          success: true,
          data: {
            redemption: {
              id: 'rrAa1b2c3d4e5f6',
              status: 'used',
              usedAt: '2026-07-20T13:00:00.000Z',
              expiresAt: '2026-07-27T12:00:00.000Z',
              redemptionCode: 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D',
            },
            userXpAfter: 350,
            userPointsAfter: 440,
          },
          message: 'Reward used.',
        },
      ),
      '400': {
        description: 'redemption_already_used or redemption_expired',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },
  'POST /api/v1/users/me/reward-store/items/{item_id}/redeem': {
    description:
      'Redeem a restaurant menu item using wallet points. BR-006 atomic via runTransaction (post-fix).',
    responses: {
      '201': successEnvelope(
        'DishRedemptionResponse',
        'Dish redemption created with wallet deduction.',
        {
          success: true,
          data: {
            redemption: {
              id: 'riAa1b2c3',
              userId: '8wvhcoqcTEXbRk9V1VzcBv4oom2',
              itemId: 'miAa1b2c3',
              restaurantId: 'rAvM3yeL5nZbCqW1kT8uHsPxjDd',
              restaurantName: 'Tacos El Paisa',
              restaurantAddress: 'Av. Reforma 222, CDMX',
              itemName: 'Tacos al pastor (4 pzas)',
              itemDescription: 'Con piña, cebolla y cilantro',
              itemImageUrl: 'https://cdn.example.com/tacos.jpg',
              pointsSpent: 50,
              redeemedAt: '2026-07-20T12:00:00.000Z',
              createdAt: '2026-07-20T12:00:00.000Z',
              updatedAt: '2026-07-20T12:00:00.000Z',
            },
            userXpAfter: 350,
            userPointsAfter: 490,
          },
          message: 'Item redeemed.',
        },
      ),
    },
  },
  'POST /api/v1/restaurants/dishes/{itemId}/buy': {
    description: 'Alias of /users/me/reward-store/items/{itemId}/redeem. Returns the same DishRedemptionResponse.',
    responses: {
      '201': successEnvelope(
        'DishRedemptionResponse',
        'Dish redemption created with wallet deduction.',
      ),
    },
  },
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
