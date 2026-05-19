import { ApplicationError } from '../core/ApplicationError.js';

function mapFirebaseAdminError(error, fallbackMessage) {
  const code = String(error?.code ?? '');

  if (code === 'auth/email-already-exists') {
    return new ApplicationError({
      code: 'admin_already_exists',
      message: 'An account with this email already exists.',
      statusCode: 409,
    });
  }

  if (code === 'auth/invalid-email') {
    return new ApplicationError({
      code: 'invalid_email',
      message: 'The provided email address is invalid.',
      statusCode: 400,
    });
  }

  if (code === 'auth/invalid-password') {
    return new ApplicationError({
      code: 'invalid_password',
      message: 'The provided password does not meet Firebase Auth requirements.',
      statusCode: 400,
    });
  }

  if (
    code === 'auth/insufficient-permission' ||
    code === 'auth/invalid-credential' ||
    code === 'app/invalid-credential'
  ) {
    return new ApplicationError({
      code: 'firebase_admin_misconfigured',
      message: 'Firebase Admin credentials are misconfigured for this environment.',
      statusCode: 500,
    });
  }

  return new ApplicationError({
    code: 'firebase_auth_error',
    message: error?.message || fallbackMessage,
    statusCode: 500,
  });
}

export class FirebaseIdentityProvider {
  constructor({ auth, config }) {
    this.auth = auth;
    this.config = config;
  }

  async createUser({ email, password, displayName }) {
    try {
      const user = await this.auth.createUser({
        email,
        password,
        displayName,
        emailVerified: false,
      });

      return { uid: user.uid, email: user.email ?? email };
    } catch (error) {
      throw mapFirebaseAdminError(error, 'Failed to create the Firebase Auth user.');
    }
  }

  async getUserByEmail(email) {
    try {
      const user = await this.auth.getUserByEmail(email);
      return { uid: user.uid, email: user.email ?? email };
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        return null;
      }
      throw mapFirebaseAdminError(error, 'Failed to look up the Firebase Auth user.');
    }
  }

  async markEmailVerified(uid) {
    try {
      await this.auth.updateUser(uid, { emailVerified: true });
    } catch (error) {
      throw mapFirebaseAdminError(error, 'Failed to mark the Firebase Auth user as verified.');
    }
  }

  async signIn({ email, password }) {
    const baseUrl = this.config.firebaseUseEmulators
      ? `http://${this.config.firebaseAuthEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`
      : 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';

    const response = await fetch(`${baseUrl}?key=${encodeURIComponent(this.config.firebaseWebApiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    if (!response.ok) {
      throw new ApplicationError({
        code: 'invalid_credentials',
        message: 'The provided email or password is incorrect.',
        statusCode: 401,
      });
    }

    const data = await response.json();
    return {
      uid: data.localId,
      email: data.email,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: Number(data.expiresIn),
    };
  }

  async refreshSession(refreshToken) {
    const baseUrl = this.config.firebaseUseEmulators
      ? `http://${this.config.firebaseAuthEmulatorHost}/securetoken.googleapis.com/v1/token`
      : 'https://securetoken.googleapis.com/v1/token';

    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(`${baseUrl}?key=${encodeURIComponent(this.config.firebaseWebApiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    if (!response.ok) {
      throw new ApplicationError({
        code: 'invalid_refresh_token',
        message: 'The refresh token is invalid or expired.',
        statusCode: 401,
      });
    }

    const data = await response.json();
    return {
      uid: data.user_id,
      email: data.email ?? '',
      idToken: data.id_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: Number(data.expires_in),
    };
  }

  async verifyIdToken(idToken) {
    try {
      const claims = await this.auth.verifyIdToken(idToken);
      return { uid: claims.uid, email: claims.email ?? '' };
    } catch (error) {
      throw new ApplicationError({
        code: 'invalid_token',
        message: 'The access token is invalid or expired.',
        statusCode: 401,
      });
    }
  }

  async updatePassword({ uid, password }) {
    try {
      await this.auth.updateUser(uid, { password });
    } catch (error) {
      throw mapFirebaseAdminError(error, 'Failed to update the Firebase Auth password.');
    }
  }

  async setDisabled({ uid, disabled }) {
    try {
      await this.auth.updateUser(uid, { disabled });
    } catch (error) {
      throw mapFirebaseAdminError(error, 'Failed to update the Firebase Auth account status.');
    }
  }

  async generateEmailVerificationLink(email) {
    return this.auth.generateEmailVerificationLink(email);
  }

  async generatePasswordResetLink(email) {
    return this.auth.generatePasswordResetLink(email);
  }
}
