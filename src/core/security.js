import crypto from 'node:crypto';

export function generateNumericOtp(length = 4) {
  const upperBound = 10 ** length;
  return String(crypto.randomInt(0, upperBound)).padStart(length, '0');
}

export function hashOtp(otp, signingSecret) {
  return crypto.createHmac('sha256', signingSecret).update(otp).digest('hex');
}

export function generateReferralCode(existingCodeLookup) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  for (;;) {
    const code = Array.from({ length: 8 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
    if (!existingCodeLookup(code)) {
      return code;
    }
  }
}

export function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}
