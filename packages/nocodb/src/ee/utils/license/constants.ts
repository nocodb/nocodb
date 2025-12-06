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

  // Grace period for network failures (7 days)
  HEARTBEAT_GRACE_PERIOD_MS: 7 * 24 * 60 * 60 * 1000,
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
  LICENSE_SERVER_PUBLIC_KEY: 'NC_LICENSE_SERVER_PUBLIC_KEY',
  ON_PREMISE_SECRET: 'NC_ON_PREMISE_SECRET',
} as const;

/**
 * RSA public key for JWT verification (on-premise installations)
 */
export const LICENSE_SERVER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoJmGmnm0jzZ0PsXd/8Lb
FmII2KreX1hDoC3dOGdOrpvkGx/RMgkDb3XOhjOXRhJconVutzbnwvbSVemXCVHn
5hav08+STDqvGveu0zrvB5+E+zKTyb2yqdBbjPUr6l3IZuRsozHeNYWpohZAsTM+
eaPwgqhKnyemzX7kpftcbdqBm7rmmU9IKHxei9Qv5Jd7yVs3IqO5HkBUOn+hSfGU
7QN5f7qPGOUUEUpCI72+sMI/1J3YoUMWmThrFrc9u95feVvQh4kF9UEeI5AuZn8d
whonhMeWGMHt00hfs5xjdrXm92HBQGsHbbsHczvlmvnYFQGp0O8UZniTFvNDuG/g
/QIDAQAB
-----END PUBLIC KEY-----`;

export const LICENSE_SERVER_OLD_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmvm9e3qSr4r4fgXdbJE6
9Wkk7LQk/QVvpyCT8/kAWtSPRepeeih+CDlS3szWl2EahctBDPcuWjICIfPnaYXs
G/KKTNV2Q5orzzYtIAxa7xqyK7/nGHQMHGsVdbAdlLH53DInzcI6oeRijRhMdTNn
n/Hq1bLjqUQOuL6g8DvY7SV9UolzGtynbURnKpImMZ/N+HCbXX6fCIOxW8rGrTbv
g51Rsk5P27TppQH0oYnyJDfOwvwlvCPN/SO0l7WbnqZTSRlPx3UsLls5RUIx91RL
wgB8qNPFuz/58jGESPXWbWNE/uT34px+QDgoew0nk5ZlCc2Uy90u3UM9SFk9ctE2
fwIDAQAB
-----END PUBLIC KEY-----`;
