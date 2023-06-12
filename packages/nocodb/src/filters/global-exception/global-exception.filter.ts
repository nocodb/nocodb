import { Catch, Logger } from '@nestjs/common';
import {
  AjvError,
  BadRequest,
  extractDBError,
  Forbidden,
  InternalServerError,
  NotFound,
  NotImplemented,
  Unauthorized,
} from '../../helpers/catchError';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private logger = new Logger(GlobalExceptionFilter.name);
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error(exception.message, exception.stack);

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
    }

    // handle different types of exceptions
    // todo: temporary hack, need to fix
    if (exception.getStatus?.()) {
      response.status(exception.getStatus()).json(exception.getResponse());
    } else {
      // todo: change the response code
      response.status(400).json({
        msg: exception.message,
      });
    }
  }
}
