import type { CorsOptions } from 'cors';

/**
 * Get CORS configuration based on NC_ALLOWED_ORIGINS environment variable
 *
 * Environment Variable:
 *   NC_ALLOWED_ORIGINS - Comma-separated list of allowed origins
 *
 * Examples:
 *   NC_ALLOWED_ORIGINS=https://app.example.com
 *   NC_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
 *   NC_ALLOWED_ORIGINS=* (explicitly allow all origins)
 *
 * Security Notes:
 *   - If NC_ALLOWED_ORIGINS is not set, defaults to permissive CORS (backwards compatible)
 *   - When specific origins are configured, credentials are enabled
 *   - For self-hosted deployments, users can intentionally set "*" for permissive CORS
 *   - For production/cloud deployments, configure specific allowed origins
 *
 * @returns CorsOptions for cors middleware
 */
export function getCorsOptions(): CorsOptions {
  const allowedOrigins = process.env.NC_ALLOWED_ORIGINS;

  const corsOptions: CorsOptions = {
    exposedHeaders: 'xc-db-response',
  };

  if (allowedOrigins) {
    // Parse comma-separated origins
    const origins = allowedOrigins.split(',').map((origin) => origin.trim());

    if (origins.length === 1 && origins[0] === '*') {
      // Explicit wildcard - allow all origins
      corsOptions.origin = true;
    } else {
      // Whitelist specific origins
      corsOptions.origin = origins;
      // Enable credentials for whitelisted origins
      corsOptions.credentials = true;
    }
  }
  // If NC_ALLOWED_ORIGINS is not set, default to permissive CORS (backwards compatible)
  // This allows all origins (origin is undefined, which cors middleware treats as *)

  return corsOptions;
}
