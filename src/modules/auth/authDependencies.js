import process from 'node:process';

import { LoggingEmailService, SmtpEmailService } from '../../infra/emailService.js';
import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import {
  FirestoreLoginEventRepository,
  FirestoreOtpRepository,
  FirestoreUserRepository,
} from './authRepository.js';
import { FirestorePointsLedgerRepository, FirestoreXpLedgerRepository } from '../xp/xpRepository.js';
import { XpService } from '../xp/xpService.js';
import { AuthService } from './authService.js';

let cachedServicePromise;

async function buildEmailService(config) {
  if (config.emailDeliveryMode !== 'smtp') {
    return new LoggingEmailService();
  }

  if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword) {
    process.stderr.write(
      '[email] SMTP mode selected but SMTP_HOST, SMTP_USERNAME, or SMTP_PASSWORD is missing. Falling back to logging.\n',
    );
    return new LoggingEmailService();
  }

  const nodemailer = await import('nodemailer');
  return new SmtpEmailService({ nodemailer: nodemailer.default ?? nodemailer, config });
}

export function getAuthService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(async ({ auth, firestore }) => {
      const xpRepository = new FirestoreXpLedgerRepository(firestore);
      const pointsRepository = new FirestorePointsLedgerRepository(firestore);
      return new AuthService({
        userRepository: new FirestoreUserRepository(firestore),
        otpRepository: new FirestoreOtpRepository(firestore),
        loginEventRepository: new FirestoreLoginEventRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
        emailService: await buildEmailService(config),
        xpService: new XpService({ xpRepository, pointsRepository }),
        config,
      });
    });
  }

  return cachedServicePromise;
}
