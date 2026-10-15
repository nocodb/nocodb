import { Catch, Logger, NotFoundException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

import { ThrottlerException } from '@nestjs/throttler';
import {
  NcApiVersion,
  NcErrorType,
  NcSDKError,
  BadRequest as SdkBadRequest,
} from 'nocodb-sdk';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { MappedExceptionResponse } from '~/filters/global-exception/exception-mapper';
import { throttlerLogger } from '~/helpers/throttlerLogger';
import { isMcpEndpoint, JSON_RPC_PARSE_ERROR } from '~/mcp/mcp-http';
import { DBErrorKind } from '~/helpers/db-error/utils';
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

// NcBaseErrorv2 types that stand for a server-side failure, not caller error.
// The mapper marks them handled (they carry a safe user message), but there's a
// real bug underneath — so they must both log AND reach Sentry.
const SERVER_SIDE_NC_ERROR_TYPES = [
  NcErrorType.ERR_INTERNAL_SERVER,
  NcErrorType.ERR_DATABASE_OP_FAILED,
  NcErrorType.ERR_UNKNOWN,
];

// Nest rethrows body-parser's SyntaxError as a BadRequestException carrying
// V8's JSON.parse message, whose wording changes across Node versions.
const JSON_PARSE_ERROR_RE =
  /\bJSON at position \d+|is not valid JSON|^Unexpected end of JSON input/;

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
      JSON_PARSE_ERROR_RE.test(exception.message)
    ) {
      exception = NcError._.errorCodex.generateError(
        NcErrorType.ERR_INVALID_JSON,
      );

      // the MCP transport answers malformed bodies in JSON-RPC, not the platform shape
      if (isMcpEndpoint(request.path)) {
        response.status(400).json(JSON_RPC_PARSE_ERROR);
        return;
      }
    }

    // try to extract db error for unknown errors — kept here (in addition
    // to the mapper) so logging / SSO branches below can branch on it.
    const dbError =
      exception instanceof NcBaseError ? null : extractDBError(exception);

    // Only a user-caused db error is quiet. Infra errors (connection loss,
    // pool exhaustion) are logged so operators see an outage, and unknown
    // ones — any failure carrying a `code` that no dialect matched — are
    // logged and reported.
    const quietDbError =
      (dbError?.kind ?? DBErrorKind.EXPECTED) === DBErrorKind.EXPECTED
        ? dbError
        : null;

    // skip unnecessary error logging
    if (
      process.env.NC_ENABLE_ALL_API_ERROR_LOGGING === 'true' ||
      !(
        quietDbError ||
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
          !SERVER_SIDE_NC_ERROR_TYPES.includes(exception.error))
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

    // A raw throw maps unhandled; a server-side NcBaseErrorv2 (e.g.
    // internalServerError) maps handled but is still a real bug. Both must page
    // Sentry — mirrors the log gate above so logging and capture never diverge.
    if (
      mapped.unhandled ||
      (exception instanceof NcBaseErrorv2 &&
        SERVER_SIDE_NC_ERROR_TYPES.includes(exception.error))
    ) {
      this.captureException(exception, request);
    }

    // Include actual error message only in development
    if (mapped.unhandled && process.env.NODE_ENV !== 'production') {
      const msgProp = apiVersion === NcApiVersion.V3 ? 'message' : 'msg';
      mapped.body.innerError = {
        [msgProp]: exception?.message || 'An unexpected error occurred',
        stack: exception?.stack,
      };
    }

    // Decoration is best-effort metadata; a throw here must not escape the filter.
    try {
      this.decorateErrorResponse(mapped, request, response, apiVersion);
    } catch (e) {
      this.logger.error(
        `Failed to decorate error response: ${e?.message}`,
        e?.stack,
      );
    }

    return response.status(mapped.status).json(mapped.body);
  }

  protected decorateErrorResponse(
    _mapped: MappedExceptionResponse,
    _request: Request,
    _response: Response,
    _apiVersion?: NcApiVersion,
  ) {}

  protected captureException(exception: any, _request: any) {
    Sentry.captureException(exception);
  }

  protected logError(exception: any, _request: any) {
    this.logger.error(exception.message, exception.stack);
  }
}
