import { Catch, HttpException } from '@nestjs/common';
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
  catch(exception: any, host: ArgumentsHost) {
    console.log(exception)

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // todo: error log

    const dbError = extractDBError(exception);

    if (dbError) {
      return response.status(400).json(dbError);
    }

    if (exception instanceof BadRequest) {
      return response.status(400).json({ msg: exception.message });
    } else if (exception instanceof Unauthorized) {
      return response.status(401).json({ msg: exception.message });
    } else if (exception instanceof Forbidden) {
      return response.status(403).json({ msg: exception.message });
    } else if (exception instanceof NotFound) {
      return response.status(404).json({ msg: exception.message });
    } else if (exception instanceof InternalServerError) {
      return response.status(500).json({ msg: exception.message });
    } else if (exception instanceof NotImplemented) {
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
      response.status(500).json({
        statusCode: 500,
        message: 'Internal server error',
      });
    }
  }
}
