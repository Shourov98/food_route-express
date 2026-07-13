import crypto from 'node:crypto';

import { getFirebaseClients } from '../infra/firebase.js';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

function normalizeJsonBody(body) {
  if (body === undefined) {
    return null;
  }
  return body;
}

export function createIdempotencyKeyMiddleware(config, { ttlMs = DEFAULT_TTL_MS } = {}) {
  return async (req, res, next) => {
    const key = String(req.get('Idempotency-Key') ?? '').trim();
    if (!key || !MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    try {
      const authScope = stableHash(req.get('authorization') ?? 'anonymous');
      const routeScope = stableHash(`${req.method}:${req.originalUrl}`);
      const id = stableHash(`${authScope}:${routeScope}:${key}`);
      const { firestore } = await getFirebaseClients(config);
      const ref = firestore.collection('idempotency_keys').doc(id);
      const snapshot = await ref.get();
      const now = new Date();

      if (snapshot.exists) {
        const record = snapshot.data();
        const expiresAt = record.expiresAt?.toDate?.() ?? new Date(record.expiresAt);
        if (!Number.isNaN(expiresAt.getTime()) && expiresAt > now && record.statusCode && record.body) {
          res.status(record.statusCode).json(record.body);
          return;
        }
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        const statusCode = res.statusCode;
        if (statusCode >= 200 && statusCode < 500) {
          ref
            .set({
              id,
              key,
              authScope,
              routeScope,
              method: req.method,
              originalUrl: req.originalUrl,
              statusCode,
              body: normalizeJsonBody(body),
              createdAt: now,
              expiresAt: new Date(now.getTime() + ttlMs),
            })
            .catch(() => {
              // Idempotency cache failure must not fail the business request.
            });
        }
        return originalJson(body);
      };

      next();
    } catch {
      next();
    }
  };
}
