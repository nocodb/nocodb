import { Catch, Logger, NotFoundException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

import { ThrottlerException } from '@nestjs/throttler';
import hash from 'object-hash';
import {
  NcApiVersion,
  NcErrorType,
  NcSDKError,
  NcSDKErrorV2,
  BadRequest as SdkBadRequest,
} from 'nocodb-sdk';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';
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
  OptionsNotExistsError,
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
      exception = NcError._.errorCodex.generateError(NcErrorType.BAD_JSON);
    }

    // try to extract db error for unknown errors
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
            NcErrorType.INTERNAL_SERVER_ERROR,
            NcErrorType.DATABASE_ERROR,
            NcErrorType.UNKNOWN_ERROR,
          ].includes(exception.error))
      )
    )
      this.logError(exception, request);

    if (exception instanceof ThrottlerException) {
      const key = hash({
        ip: request.ip,
        baseId: (request as any).ncBaseId,
        workspaceId: (request as any).ncWorkspaceId,
        path: request.path,
      });

      const cacheKey = `throttler:${key}`;

      NocoCache.get(cacheKey, CacheGetType.TYPE_OBJECT)
        .then((data) => {
          if (!data) {
            this.logger.warn(
              `ThrottlerException: ${exception.message}, Path: ${
                request.path
              }, Workspace ID: ${(request as any).ncWorkspaceId}, Base ID: ${
                (request as any).ncBaseId
              }`,
            );

            NocoCache.setExpiring(
              cacheKey,
              { value: true, count: 1, timestamp: Date.now() },
              300,
            ).catch((err) => {
              this.logger.error(err);
            });
          } else {
            data.count += 1;

            const ttlInSeconds = Math.floor(
              (data.timestamp + 300000 - Date.now()) / 1000,
            );

            if (ttlInSeconds > 0) {
              NocoCache.setExpiring(cacheKey, data, ttlInSeconds).catch(
                (err) => {
                  this.logger.error(err);
                },
              );
            }

            // log every 50th request in last 5 minutes after first
            if (data.count % 50 === 0) {
              this.logger.warn(
                `ThrottlerException: ${exception.message}, Path: ${
                  request.path
                }, Workspace ID: ${(request as any).ncWorkspaceId}, Base ID: ${
                  (request as any).ncBaseId
                }, Requests in last 5 minutes: ${data.count}`,
              );
            }
          }
        })
        .catch((err) => {
          this.logger.error(err);
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

    // API not found
    if (exception instanceof NotFoundException) {
      this.logger.debug(exception.message, exception.stack);

      return response.status(404).json({ msg: exception.message });
    }

    if (dbError) {
      const { httpStatus: httpStatus, ...responsePayload } = dbError;
      if (apiVersion === NcApiVersion.V3) {
        return response.status(httpStatus).json(responsePayload);
      } else {
        return response.status(400).json(responsePayload);
      }
    }

    if (
      exception instanceof OptionsNotExistsError &&
      apiVersion === NcApiVersion.V3
    ) {
      return response.status(422).json({
        message: `Invalid option(s) "${exception.options.join(
          ', ',
        )}" provided for column "${exception.columnTitle}"`,
        error: 'INVALID_VALUE_FOR_FIELD',
      });
    } else if (
      exception instanceof BadRequest ||
      exception.getStatus?.() === 400
    ) {
      return response.status(400).json({ msg: exception.message });
    } else if (
      exception instanceof Unauthorized ||
      (exception.getStatus?.() === 401 && !(exception instanceof NcBaseErrorv2))
    ) {
      return response.status(401).json({ msg: exception.message });
    } else if (
      exception instanceof Forbidden ||
      (exception.getStatus?.() === 403 && !(exception instanceof NcBaseErrorv2))
    ) {
      return response.status(403).json({ msg: exception.message });
    } else if (
      exception instanceof NotFound ||
      (exception.getStatus?.() === 404 && !(exception instanceof NcBaseErrorv2))
    ) {
      return response.status(404).json({ msg: exception.message });
    } else if (exception instanceof AjvError) {
      if (exception.humanReadableError) {
        return response
          .status(400)
          .json({ msg: exception.message, errors: exception.errors });
      }

      return response
        .status(400)
        .json({ msg: exception.message, errors: exception.errors });
    } else if (
      exception instanceof UnprocessableEntity ||
      exception instanceof SdkBadRequest ||
      exception instanceof NcSDKError
    ) {
      return response.status(422).json({ msg: exception.message });
    } else if (exception instanceof NcSDKErrorV2) {
      return response.status(exception.getStatus?.() ?? 422).json({
        error: exception.errorType,
        message: exception.message,
      });
    } else if (exception instanceof TestConnectionError) {
      return response
        .status(422)
        .json({ msg: exception.message, sql_code: exception.sql_code });
    } else if (exception instanceof NcBaseErrorv2) {
      return response.status(exception.code).json({
        error: exception.error,
        message: exception.message,
        details: exception.details,
      });
    }

    // handle different types of exceptions
    // todo: temporary hack, need to fix
    if (exception.getStatus?.()) {
      response.status(exception.getStatus()).json(exception.getResponse());
    } else {
      this.captureException(exception, request);

      // todo: change the response code
      response.status(400).json({
        msg: exception.message,
      });
    }
  }

  protected captureException(exception: any, _request: any) {
    Sentry.captureException(exception);
  }

  protected logError(exception: any, _request: any) {
    this.logger.error(exception.message, exception.stack);
  }
}
