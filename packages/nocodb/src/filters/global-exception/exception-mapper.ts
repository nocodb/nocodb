import { NotFoundException } from '@nestjs/common';
import {
  NcApiVersion,
  NcSDKError,
  NcSDKErrorV2,
  BadRequest as SdkBadRequest,
} from 'nocodb-sdk';
import {
  AjvError,
  BadRequest,
  extractDBError,
  Forbidden,
  NcBaseError,
  NcBaseErrorv2,
  NotFound,
  OptionsNotExistsError,
  TestConnectionError,
  Unauthorized,
  UniqueConstraintViolationError,
  UnprocessableEntity,
} from '~/helpers/catchError';

export interface MappedExceptionResponse {
  status: number;
  body: Record<string, any>;
  /**
   * True when no specific exception type matched and the default 500 path
   * fired. Callers that surface the response back to clients (HTTP filter,
   * batch envelope) can use this to attach Sentry capture / dev innerError
   * without re-running the type chain.
   */
  unhandled?: boolean;
}

/**
 * Pure mapping from any thrown exception to `{ status, body }`. Single
 * source of truth for status/body shape used by both:
 *
 *   - `GlobalExceptionFilter.catch()`     — the HTTP-level filter
 *   - `InternalController.handleBatch()`  — the batch envelope which
 *     collects per-sub-op rejections via `Promise.allSettled` and can't
 *     route them through the filter (the filter writes to the Response
 *     and would short-circuit sibling sub-ops).
 *
 * Side effects (logging, Sentry capture, SSO redirect, ThrottlerException
 * recording, body-parser JSON fixup) stay in the filter. This helper is
 * deliberately pure so the batch handler can call it N times per request
 * without producing N redirects, N log lines, or N Sentry events.
 *
 * Lives in its own file (rather than inside `global-exception.filter.ts`)
 * because the EE build overlays the filter file via tsconfig path
 * aliasing — callers importing through `~/filters/...` would otherwise
 * hit the EE filter, which doesn't re-export this helper.
 */
export function mapExceptionToResponse(
  exception: any,
  apiVersion?: NcApiVersion,
): MappedExceptionResponse {
  // try to extract db error for unknown errors
  const dbError =
    exception instanceof NcBaseError ? null : extractDBError(exception);
  if (dbError) {
    const { httpStatus, ...responsePayload } = dbError;
    return {
      status: apiVersion === NcApiVersion.V3 ? httpStatus : 400,
      body: responsePayload,
    };
  }

  if (exception instanceof NotFoundException) {
    return { status: 404, body: { msg: exception.message } };
  }

  if (
    exception instanceof OptionsNotExistsError &&
    apiVersion === NcApiVersion.V3
  ) {
    return {
      status: 422,
      body: {
        message: `Invalid option(s) "${exception.options.join(
          ', ',
        )}" provided for column "${exception.columnTitle}"`,
        error: 'ERR_INVALID_VALUE_FOR_FIELD',
      },
    };
  }

  if (
    UniqueConstraintViolationError &&
    typeof UniqueConstraintViolationError === 'function' &&
    exception instanceof UniqueConstraintViolationError
  ) {
    return {
      status: apiVersion === NcApiVersion.V3 ? 409 : 400,
      body: {
        error: 'FIELD_UNIQUE_CONSTRAINT_VIOLATION',
        message: exception.message,
        fieldName: exception.fieldName,
        value: exception.value,
      },
    };
  }
  if (
    exception &&
    typeof exception === 'object' &&
    'fieldName' in exception &&
    'value' in exception &&
    exception.constructor?.name === 'UniqueConstraintViolationError'
  ) {
    // Fallback check in case the class is not properly imported
    return {
      status: apiVersion === NcApiVersion.V3 ? 409 : 400,
      body: {
        error: 'FIELD_UNIQUE_CONSTRAINT_VIOLATION',
        message: exception.message,
        fieldName: (exception as any).fieldName,
        value: (exception as any).value,
      },
    };
  }

  if (exception instanceof BadRequest || exception.getStatus?.() === 400) {
    return { status: 400, body: { msg: exception.message } };
  }

  if (
    exception instanceof Unauthorized ||
    (exception.getStatus?.() === 401 && !(exception instanceof NcBaseErrorv2))
  ) {
    return { status: 401, body: { msg: exception.message } };
  }

  if (
    exception instanceof Forbidden ||
    (exception.getStatus?.() === 403 && !(exception instanceof NcBaseErrorv2))
  ) {
    return { status: 403, body: { msg: exception.message } };
  }

  if (
    exception instanceof NotFound ||
    (exception.getStatus?.() === 404 && !(exception instanceof NcBaseErrorv2))
  ) {
    return { status: 404, body: { msg: exception.message } };
  }

  if (exception instanceof AjvError) {
    return {
      status: 400,
      body: { msg: exception.message, errors: exception.errors },
    };
  }

  if (
    exception instanceof UnprocessableEntity ||
    exception instanceof SdkBadRequest ||
    exception instanceof NcSDKError
  ) {
    return { status: 422, body: { msg: exception.message } };
  }

  if (exception instanceof NcSDKErrorV2) {
    return {
      status: exception.getStatus?.() ?? 422,
      body: {
        error: exception.errorType,
        message: exception.message,
      },
    };
  }

  if (exception instanceof TestConnectionError) {
    return {
      status: 422,
      body: { msg: exception.message, sql_code: exception.sql_code },
    };
  }

  if (exception instanceof NcBaseErrorv2) {
    return {
      status: exception.code,
      body: {
        error: exception.error,
        message: exception.message,
        details: exception.details,
      },
    };
  }

  // Generic NestJS HttpException / ThrottlerException etc. carrying their
  // own status. Trust the underlying class to have a sane response shape.
  if (exception.getStatus?.()) {
    return { status: exception.getStatus(), body: exception.getResponse() };
  }

  // Default 500 — sanitized message. Caller decides on Sentry capture and
  // whether to attach dev innerError.
  const msgProp = apiVersion === NcApiVersion.V3 ? 'message' : 'msg';
  return {
    status: 500,
    body: {
      [msgProp]: `Something didn't work as expected. Please try again. If the problem persists, contact support.`,
    },
    unhandled: true,
  };
}
