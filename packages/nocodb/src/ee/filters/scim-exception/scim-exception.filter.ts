import { Catch, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  BadRequest,
  Forbidden,
  NotFound,
  Unauthorized,
  UnprocessableEntity,
} from '~/helpers/catchError';

/**
 * SCIM 2.0 compliant error response filter (RFC 7644 §3.12).
 * Applied to SCIM User/Group controllers so IdPs (Okta, Azure AD, OneLogin)
 * receive properly formatted error payloads.
 */
@Catch()
export class ScimExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ScimExceptionFilter.name);

  private resolveStatus(exception: any): number {
    // NestJS HttpException (e.g. from guards or 409 Conflict)
    if (typeof exception?.getStatus === 'function') {
      return exception.getStatus();
    }

    // NcBaseError subclasses (no getStatus method)
    if (exception instanceof BadRequest) return 400;
    if (exception instanceof Unauthorized) return 401;
    if (exception instanceof Forbidden) return 403;
    if (exception instanceof NotFound) return 404;
    if (exception instanceof UnprocessableEntity) return 422;

    // NcBaseErrorv2 (from NcError.*() methods) stores HTTP status in .code
    // Fallback: check .status, .code property, or default to 500
    return exception?.status || exception?.code || 500;
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = this.resolveStatus(exception);

    // If this is an HttpException with a SCIM-formatted body,
    // pass it through directly (e.g. 409 Conflict from services)
    if (typeof exception?.getResponse === 'function') {
      const exceptionResponse = exception.getResponse();
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse?.schemas
      ) {
        if (status >= 500) {
          this.logger.error(exceptionResponse.detail, exception?.stack);
        }
        response
          .status(status)
          .header('Content-Type', 'application/scim+json')
          .json(exceptionResponse);
        return;
      }
    }

    const message = exception?.message || 'An unexpected error occurred';

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
