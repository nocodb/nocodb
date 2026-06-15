import { Catch, Logger, NotFoundException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

import { ThrottlerException } from '@nestjs/throttler';
import {
  NcApiVersion,
  NcErrorType,
  NcSDKError,
  NcSDKErrorV2,
  BadRequest as SdkBadRequest,
} from 'nocodb-sdk';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { throttlerLogger } from '~/helpers/throttlerLogger';
import { mapExceptionToResponse } from '~/filters/global-exception/exception-mapper';
import {
  AjvError,
  BadRequest,
  ExternalError,
  extractDBError,
  Forbidden,
  NcBaseError,
  NcBaseErrorv2,
  NcError,
  NotFound,
  SsoError,
  TestConnectionError,
  Unauthorized,
  UnprocessableEntity,
} from '~/helpers/catchError';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor() {}

  protected logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const apiVersion = (request as any).ncApiVersion;

    // catch body-parser error and replace with NcBaseErrorv2
    if (
      exception.name === 'BadRequestException' &&
      exception.status === 400 &&
      /^Unexpected token .*? (?:in JSON|is not valid JSON)/.test(
        exception.message,
      )
    ) {
      exception = NcError._.errorCodex.generateError(
        NcErrorType.ERR_INVALID_JSON,
      );
    }

    // try to extract db error for unknown errors — kept here (in addition
    // to the mapper) so logging / SSO branches below can branch on it.
    const dbError =
      exception instanceof NcBaseError ? null : extractDBError(exception);

    // skip unnecessary error logging
    if (
      process.env.NC_ENABLE_ALL_API_ERROR_LOGGING === 'true' ||
      !(
        dbError ||
        exception instanceof BadRequest ||
        exception instanceof AjvError ||
        exception instanceof Unauthorized ||
        exception instanceof Forbidden ||
        exception instanceof NotFound ||
        exception instanceof UnprocessableEntity ||
        exception instanceof TestConnectionError ||
        exception instanceof SsoError ||
        exception instanceof NotFoundException ||
        exception instanceof ThrottlerException ||
        exception instanceof ExternalError ||
        exception instanceof SdkBadRequest ||
        exception instanceof NcSDKError ||
        (exception instanceof NcBaseErrorv2 &&
          ![
            NcErrorType.ERR_INTERNAL_SERVER,
            NcErrorType.ERR_DATABASE_OP_FAILED,
            NcErrorType.ERR_UNKNOWN,
          ].includes(exception.error))
      )
    )
      this.logError(exception, request);

    if (exception instanceof ThrottlerException) {
      throttlerLogger.record({
        workspaceId: (request as any).ncWorkspaceId,
        baseId: (request as any).ncBaseId,
      });
    }

    // if sso error then redirect to ui with error in query parameter
    if (
      exception instanceof SsoError ||
      request.route?.path === '/sso/:clientId/redirect'
    ) {
      if (!(exception instanceof SsoError)) {
        this.logger.warn(exception.message, exception.stack);
      }

      // encode the query parameter
      const redirectUrl = `${
        request.dashboardUrl
      }?ui-redirect=${encodeURIComponent(
        `/sso?error=${encodeURIComponent(exception.message)}`,
      )}`;

      return response.redirect(redirectUrl);
    }

    if (exception instanceof NotFoundException) {
      // debug-level log instead of error-level (a 404 from a wrong URL
      // isn't a server bug). The mapper still returns the 404 body below.
      this.logger.debug(exception.message, exception.stack);
    }

    const mapped = mapExceptionToResponse(exception, apiVersion);

    if (mapped.unhandled) {
      this.captureException(exception, request);

      // Include actual error message only in development
      if (process.env.NODE_ENV !== 'production') {
        const msgProp = apiVersion === NcApiVersion.V3 ? 'message' : 'msg';
        mapped.body.innerError = {
          [msgProp]: exception?.message || 'An unexpected error occurred',
          stack: exception?.stack,
        };
      }
    }

    return response.status(mapped.status).json(mapped.body);
  }

  protected captureException(exception: any, _request: any) {
    Sentry.captureException(exception);
  }

  protected logError(exception: any, _request: any) {
    this.logger.error(exception.message, exception.stack);
  }
}
