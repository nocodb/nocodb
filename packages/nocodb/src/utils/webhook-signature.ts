import crypto from 'crypto';

/**
 * Generate HMAC-SHA256 signature for webhook payload
 * Follows industry standard similar to GitHub, Stripe webhooks
 *
 * @param payload - The webhook payload (object or string)
 * @param secret - The signing secret
 * @param timestamp - Unix timestamp in seconds
 * @returns Hex string signature, or null if secret is missing
 */
export function generateWebhookSignature(
  payload: string | object,
  secret: string,
  timestamp: number,
): string | null {
  if (!secret) {
    return null;
  }

  try {
    // Convert payload to string if it's an object
    const payloadString =
      typeof payload === 'string' ? payload : JSON.stringify(payload);

    // Create signed payload: timestamp.payload
    const signedPayload = `${timestamp}.${payloadString}`;

    // Generate HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    return signature;
  } catch (e) {
    // If signature generation fails, return null to allow webhook delivery
    return null;
  }
}

/**
 * Verify webhook signature (for testing/validation)
 *
 * @param payload - The webhook payload (object or string)
 * @param signature - The signature to verify
 * @param secret - The signing secret
 * @param timestamp - Unix timestamp in seconds
 * @param toleranceSeconds - Time tolerance for replay attack prevention (default: 5 minutes)
 * @returns True if signature is valid and timestamp is fresh
 */
export function verifyWebhookSignature(
  payload: string | object,
  signature: string,
  secret: string,
  timestamp: number,
  toleranceSeconds: number = 300, // 5 minutes
): boolean {
  if (!secret || !signature) {
    return false;
  }

  try {
    // Check timestamp freshness to prevent replay attacks
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > toleranceSeconds) {
      return false;
    }

    // Compute expected signature
    const expectedSignature = generateWebhookSignature(
      payload,
      secret,
      timestamp,
    );

    // Constant-time comparison to prevent timing attacks
    if (
      !expectedSignature ||
      signature.length !== expectedSignature.length ||
      signature.length === 0
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch (e) {
    return false;
  }
}
