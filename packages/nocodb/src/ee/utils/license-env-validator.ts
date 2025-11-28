import { LICENSE_ENV_VARS } from '~/constants/license.constants';

/**
 * Error thrown when required environment variables are missing
 */
export class LicenseEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LicenseEnvironmentError';
  }
}

/**
 * Validate required environment variables for on-premise license client
 * @throws {LicenseEnvironmentError} If required environment variables are missing
 */
export function validateClientLicenseEnvironment(): void {
  const required = [LICENSE_ENV_VARS.LICENSE_KEY];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new LicenseEnvironmentError(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

/**
 * Validate required environment variables for license server
 * @throws {LicenseEnvironmentError} If required environment variables are missing
 */
export function validateServerLicenseEnvironment(): void {
  const required = [
    LICENSE_ENV_VARS.LICENSE_SERVER_PRIVATE_KEY,
    LICENSE_ENV_VARS.LICENSE_SERVER_PUBLIC_KEY,
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new LicenseEnvironmentError(
      `Missing required environment variables for license server: ${missing.join(
        ', ',
      )}`,
    );
  }
}

/**
 * Check if license server environment is configured
 * @returns true if NC_LICENSE_SERVER_PRIVATE_KEY is set
 */
export function isLicenseServerEnabled(): boolean {
  return !!process.env[LICENSE_ENV_VARS.LICENSE_SERVER_PRIVATE_KEY];
}

/**
 * Check if license client environment is configured
 * @returns true if NC_LICENSE_KEY is set
 */
export function isLicenseClientEnabled(): boolean {
  return !!process.env[LICENSE_ENV_VARS.LICENSE_KEY];
}
