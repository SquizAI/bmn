// server/src/lib/hmac-tokens.js

import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config/index.js';

const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create an HMAC-SHA256 signature for the given data.
 *
 * @param {string} data
 * @returns {string} Hex-encoded signature
 */
function sign(data) {
  return createHmac('sha256', config.RESUME_TOKEN_SECRET)
    .update(data)
    .digest('hex');
}

/**
 * Create an HMAC-signed wizard resume token.
 *
 * Token format: base64url(JSON payload).hmac_signature
 *
 * @param {string} brandId - The brand being built
 * @param {string} userId - The user who owns the wizard session
 * @param {number} step - The wizard step to resume at
 * @param {number} [expiryMs] - Token lifetime in milliseconds (default: 24h)
 * @returns {string} Signed resume token
 */
export function signResumeToken(brandId, userId, step, expiryMs = DEFAULT_EXPIRY_MS) {
  const payload = JSON.stringify({
    brandId,
    userId,
    step,
    exp: Date.now() + expiryMs,
  });

  const encoded = Buffer.from(payload).toString('base64url');
  const signature = sign(encoded);

  return `${encoded}.${signature}`;
}

/**
 * Verify an HMAC-signed wizard resume token.
 *
 * Checks both the signature integrity and the expiry timestamp.
 * Also verifies that the token belongs to the given user.
 *
 * @param {string} token - The resume token to verify
 * @param {string} userId - The user attempting to resume
 * @returns {{ brandId: string, userId: string, step: number } | null}
 *   The decoded payload if valid, or null if invalid/expired.
 */
export function verifyResumeToken(token, userId) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) {
    return null;
  }

  const encoded = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  // Verify HMAC signature using timing-safe comparison
  const expectedSignature = sign(encoded);

  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  // Decode and parse payload
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
  } catch {
    return null;
  }

  // Check expiry
  if (!payload.exp || Date.now() > payload.exp) {
    return null;
  }

  // Verify the token belongs to this user
  if (payload.userId !== userId) {
    return null;
  }

  return {
    brandId: payload.brandId,
    userId: payload.userId,
    step: payload.step,
  };
}
