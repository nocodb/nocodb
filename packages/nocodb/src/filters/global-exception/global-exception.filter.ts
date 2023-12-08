import { Catch, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectSentry, SentryService } from '@ntegral/nestjs-sentry';
import { ThrottlerException } from '@nestjs/throttler';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AjvError,
  BadRequest,
  extractDBError,
  Forbidden,
  InternalServerError,
  NotFound,
  NotImplemented,
  Unauthorized,
  UnprocessableEntity,
} from '~/helpers/catchError';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Optional() @InjectSentry() protected readonly sentryClient: SentryService,
  ) {}

  protected logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // skip unnecessary error logging
    if (
      process.env.NC_ENABLE_ALL_API_ERROR_LOGGING === 'true' ||
      !(
        exception instanceof BadRequest ||
        exception instanceof AjvError ||
        exception instanceof Unauthorized ||
        exception instanceof Forbidden ||
        exception instanceof NotFound ||
        exception instanceof NotImplemented ||
        exception instanceof UnprocessableEntity ||
        exception instanceof NotFoundException ||
        exception instanceof ThrottlerException
      )
    )
      this.logError(exception, request);

    if (exception instanceof ThrottlerException) {
      this.logger.warn(
        `${exception.message}, Path : ${request.path}, Workspace ID : ${
          (request as any).ncWorkspaceId
        }, Project ID : ${(request as any).ncProjectId}`,
      );
    }

    // API not found
    if (exception instanceof NotFoundException) {
      this.logger.debug(exception.message, exception.stack);

      return response.status(404).json({ msg: exception.message });
    }

    const dbError = extractDBError(exception);

    if (dbError) {
      return response.status(400).json(dbError);
    }

    if (exception instanceof BadRequest || exception.getStatus?.() === 400) {
      return response.status(400).json({ msg: exception.message });
    } else if (
      exception instanceof Unauthorized ||
      exception.getStatus?.() === 401
    ) {
      return response.status(401).json({ msg: exception.message });
    } else if (
      exception instanceof Forbidden ||
      exception.getStatus?.() === 403
    ) {
      return response.status(403).json({ msg: exception.message });
    } else if (
      exception instanceof NotFound ||
      exception.getStatus?.() === 404
    ) {
      return response.status(404).json({ msg: exception.message });
    } else if (
      exception instanceof InternalServerError ||
      exception.getStatus?.() === 500
    ) {
      return response.status(500).json({ msg: exception.message });
    } else if (
      exception instanceof NotImplemented ||
      exception.getStatus?.() === 501
    ) {
      return response.status(501).json({ msg: exception.message });
    } else if (exception instanceof AjvError) {
      return response
        .status(400)
        .json({ msg: exception.message, errors: exception.errors });
    } else if (exception instanceof UnprocessableEntity) {
      return response.status(422).json({ msg: exception.message });
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
    this.sentryClient?.instance().captureException(exception);
  }

  protected logError(exception: any, _request: any) {
    this.logger.error(exception.message, exception.stack);
  }
}
