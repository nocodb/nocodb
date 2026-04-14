/**
 * License server configuration constants
 * Shared between client and server components
 */
export const LICENSE_CONFIG = {
  // Heartbeat intervals
  HEARTBEAT_INTERVAL_NORMAL_MS: 6 * 60 * 60 * 1000, // 6 hours
  HEARTBEAT_INTERVAL_FAILURE_MS: 60 * 60 * 1000, // 1 hour

  // Security
  TIMESTAMP_WINDOW_MS: 5 * 60 * 1000, // 5 minutes (for replay attack prevention)

  // JWT configuration
  JWT_EXPIRY: '2d', // 2 days grace period
  JWT_ALGORITHM: 'RS256' as const,

  // Request envelope version
  AGENT_REQUEST_VERSION: 0,

  // Grace period for network failures (2 days)
  HEARTBEAT_GRACE_PERIOD_MS: 2 * 24 * 60 * 60 * 1000,

  // License key prefixes
  LICENSE_KEY_PREFIX: 'nc_',
  AIRGAPPED_KEY_PREFIX: 'nc_ag_',

  // Prefix on installation_secret signals instance-bound installation
  INSTANCE_BOUND_SECRET_PREFIX: 'fp:',

  // Clock tolerance for iat (issued-at) check
  CLOCK_TOLERANCE_MS: 5 * 60 * 1000, // 5 minutes
} as const;

/**
 * Environment variable names for license configuration
 */
export const LICENSE_ENV_VARS = {
  // Client-side (on-premise installation)
  LICENSE_KEY: 'NC_LICENSE_KEY',
  LICENSE_SERVER_URL: 'NC_LICENSE_SERVER_URL',

  // Server-side (license server)
  LICENSE_SERVER_PRIVATE_KEY: 'NC_LICENSE_SERVER_PRIVATE_KEY',
  ON_PREMISE_SECRET: 'NC_ON_PREMISE_SECRET',
} as const;

/**
 * RSA public keys for JWT verification (on-premise installations).
 *
 * This is an array to support key rotation. When rotating:
 *   1. Generate a new key pair
 *   2. Prepend the new public key to this array
 *   3. Deploy the new private key to the license server
 *   4. Keep old keys in the array until all JWTs signed with them have expired
 *      (2 days for standard licenses, up to license expiry for airgapped)
 *   5. Remove the old key once safe
 *
 * For staging/testing, embed the staging public key in this array alongside
 * production keys. All keys are compiled into the binary — no env var override.
 *
 * In production on-prem builds, __NC_DERIVED_KEYS__ is injected by the build
 * system with XOR-encoded key data. Both LICENSE_SERVER_PUBLIC_KEYS and
 * getLicenseServerPublicKeys() resolve through the same derivation path,
 * so no plain keys exist in the production bundle.
 */
declare const __NC_DERIVED_KEYS__: Array<{ d: string; m: string }> | undefined;

function _resolveKeys(): string[] {
  if (typeof __NC_DERIVED_KEYS__ !== 'undefined') {
    return __NC_DERIVED_KEYS__.map((k) => {
      const a = Buffer.from(k.d, 'base64');
      const b = Buffer.from(k.m, 'base64');
      return Buffer.from(a.map((v, i) => v ^ b[i])).toString('utf-8');
    });
  }
  // Dev only — plain keys (dead-code eliminated in production builds)
  return [
    // Production
    `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoJmGmnm0jzZ0PsXd/8Lb
FmII2KreX1hDoC3dOGdOrpvkGx/RMgkDb3XOhjOXRhJconVutzbnwvbSVemXCVHn
5hav08+STDqvGveu0zrvB5+E+zKTyb2yqdBbjPUr6l3IZuRsozHeNYWpohZAsTM+
eaPwgqhKnyemzX7kpftcbdqBm7rmmU9IKHxei9Qv5Jd7yVs3IqO5HkBUOn+hSfGU
7QN5f7qPGOUUEUpCI72+sMI/1J3YoUMWmThrFrc9u95feVvQh4kF9UEeI5AuZn8d
whonhMeWGMHt00hfs5xjdrXm92HBQGsHbbsHczvlmvnYFQGp0O8UZniTFvNDuG/g
/QIDAQAB
-----END PUBLIC KEY-----`,
    // Added 2026-03-26 - Staging
    `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzyjQz/hecDaVINX3OW95
dpz39CJ5GgX7UDekOMUk+xo9Qu66V/5hZoGSOQEPwNfoMuQM1YspyNTr/CvD2C/j
Yhy+TdljsNo47SYdsuPIIvy48BlXmvOg/pgXMyxbPRSAD6ZrtlGlb88cSsBXLIA8
rK8dsQAChlpR/3aXOjR5ZHlO9xNmJOQ/HCMaSDxwnn7XuQmTEOlaxMznRgGaLS5u
LxzlJNQaHAcjzs1bzcLqwETXh/GjgLvK+j9gZgjsLt9Z05W5UnVWUtTIslZo2Kv+
movc8CBf+p2KX/usUEiBf2jtBHWmBuGFUp4kaFopnSsFq0KhGja5uo9Oi3ppdDOD
aQIDAQAB
-----END PUBLIC KEY-----`,
  ];
}

// Resolved once at module load — in production, goes through XOR derivation.
// No plain keys survive in the production bundle.
export const LICENSE_SERVER_PUBLIC_KEYS: string[] = _resolveKeys();

/** Returns the embedded public keys array. */
export function getLicenseServerPublicKeys(): string[] {
  return LICENSE_SERVER_PUBLIC_KEYS;
}

/**
 * IMPORTANT: The old/legacy key below must always be the LAST PEM key in this file.
 * The build system (rspack.ee-on-prem.config.js → deriveLicenseKeys()) regex-matches
 * all PEM keys sequentially — everything except the last becomes the rotation array
 * (__NC_DERIVED_KEYS__), and the last one becomes __NC_DERIVED_OLD_KEY__.
 */
declare const __NC_DERIVED_OLD_KEY__: { d: string; m: string } | undefined;

function _resolveOldKey(): string {
  if (typeof __NC_DERIVED_OLD_KEY__ !== 'undefined') {
    const a = Buffer.from(__NC_DERIVED_OLD_KEY__.d, 'base64');
    const b = Buffer.from(__NC_DERIVED_OLD_KEY__.m, 'base64');
    return Buffer.from(a.map((v, i) => v ^ b[i])).toString('utf-8');
  }
  // Dev only — dead-code eliminated in production builds
  return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmvm9e3qSr4r4fgXdbJE6
9Wkk7LQk/QVvpyCT8/kAWtSPRepeeih+CDlS3szWl2EahctBDPcuWjICIfPnaYXs
G/KKTNV2Q5orzzYtIAxa7xqyK7/nGHQMHGsVdbAdlLH53DInzcI6oeRijRhMdTNn
n/Hq1bLjqUQOuL6g8DvY7SV9UolzGtynbURnKpImMZ/N+HCbXX6fCIOxW8rGrTbv
g51Rsk5P27TppQH0oYnyJDfOwvwlvCPN/SO0l7WbnqZTSRlPx3UsLls5RUIx91RL
wgB8qNPFuz/58jGESPXWbWNE/uT34px+QDgoew0nk5ZlCc2Uy90u3UM9SFk9ctE2
fwIDAQAB
-----END PUBLIC KEY-----`;
}

export const LICENSE_SERVER_OLD_PUBLIC_KEY: string = _resolveOldKey();
