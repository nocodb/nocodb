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
export const LICENSE_SERVER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu+z805wqIFHZpiFUME+33G4IHmQm2UYKku43PoyH8oBrk66OJdAsc9w932RNzK2WftVl2SQI6W5VK//jIUEM4cSPsEl6fohIE7kFC5wR68N+fan0vEpiqY6GGwHJDhbFvF44uec2GP3MHbb0Qsvp2tw9v4jSlLe4yS3piTmnVAGgvBQ6xnixSQ43q1LIePWQHnOrumDZQViDSsin4MWRtjzB21xejh8dvhDKleHLcBvImWeA3O7j9IJ0C7ofmrD1/kV4lDxNBRGDRzvnb5UcrmhSv/UFPBuz35RnBIpjT9C+KrN0ufS53pSxUYsy7XVXDa+X9ibh292185vBg8amqQIDAQAB\n-----END PUBLIC KEY-----`;

export const LICENSE_SERVER_OLD_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmvm9e3qSr4r4fgXdbJE6
9Wkk7LQk/QVvpyCT8/kAWtSPRepeeih+CDlS3szWl2EahctBDPcuWjICIfPnaYXs
G/KKTNV2Q5orzzYtIAxa7xqyK7/nGHQMHGsVdbAdlLH53DInzcI6oeRijRhMdTNn
n/Hq1bLjqUQOuL6g8DvY7SV9UolzGtynbURnKpImMZ/N+HCbXX6fCIOxW8rGrTbv
g51Rsk5P27TppQH0oYnyJDfOwvwlvCPN/SO0l7WbnqZTSRlPx3UsLls5RUIx91RL
wgB8qNPFuz/58jGESPXWbWNE/uT34px+QDgoew0nk5ZlCc2Uy90u3UM9SFk9ctE2
fwIDAQAB
-----END PUBLIC KEY-----`;
