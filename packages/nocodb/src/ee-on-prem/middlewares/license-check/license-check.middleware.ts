import { Injectable, Logger } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import NocoLicense from '~/ee-on-prem/NocoLicense';

/**
 * Middleware to enforce license validity checks
 * Blocks access to API endpoints when license is invalid
 */
@Injectable()
export class LicenseCheckMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LicenseCheckMiddleware.name);

  // Endpoints that should bypass license checks
  private readonly BYPASS_PATHS = [
    '/api/v1/health',
    '/api/v1/auth/user/signin',
    '/api/v1/auth/user/signup',
    '/api/v1/auth/token/refresh',
    '/api/v1/db/meta/nocodb/info',
    '/api/v1/auth/user/me',
    '/api/v1/workspaces',
    '/api/v1/notifications/poll',
    '/api/v1/notifications',
    '/api/v1/tele',
    '/api/v1/db/meta/projects',
    '/api/v2/integrations',
  ];

  use(req: any, res: any, next: () => void) {
    // Use originalUrl or url instead of path for proper route matching
    const requestPath = req.originalUrl || req.url || req.path;

    // Check if path should bypass license checks
    if (this.shouldBypass(requestPath)) {
      return next();
    }

    // Check if license blocks access
    if (NocoLicense.shouldBlockAccess()) {
      const status = NocoLicense.getStatus();
      const graceDays = NocoLicense.getDaysInGracePeriod();

      return res.status(403).json({
        message: this.getBlockMessage(status, graceDays),
        code: 'LICENSE_INVALID',
      });
    }

    next();
  }

  private shouldBypass(path: string): boolean {
    // If no path or non-API path, allow
    if (!path && !path.startsWith('/api/')) {
      return true;
    }

    if (this.BYPASS_PATHS.some((bypassPath) => path.startsWith(bypassPath))) {
      return true;
    }

    return false;
  }

  private getBlockMessage(status: string, graceDays: number | null): string {
    switch (status) {
      case 'revoked':
        return 'Your license has been revoked. Please contact your administrator or support.';
      case 'suspended':
        return 'Your license has been suspended. Please contact your administrator or support.';
      case 'expired':
        return graceDays !== null && graceDays <= 0
          ? 'Your license has expired and the grace period has ended. Please renew your license.'
          : 'Your license has expired. Please renew your license.';
      default:
        return 'Unable to verify license. Please check your network connection and license server availability.';
    }
  }
}
