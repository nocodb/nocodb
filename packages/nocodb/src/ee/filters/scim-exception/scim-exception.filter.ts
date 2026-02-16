import { Catch, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

/**
 * SCIM 2.0 compliant error response filter (RFC 7644 §3.12).
 * Applied to SCIM User/Group controllers so IdPs (Okta, Azure AD, OneLogin)
 * receive properly formatted error payloads.
 */
@Catch()
export class ScimExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ScimExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception?.getStatus?.() || exception?.status || 500;
    const message =
      exception?.message || 'An unexpected error occurred';

    if (status >= 500) {
      this.logger.error(message, exception?.stack);
    }

    response
      .status(status)
      .header('Content-Type', 'application/scim+json')
      .json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: message,
        status: String(status),
      });
  }
}
