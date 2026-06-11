import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import ajvErrors from 'ajv-errors';
import type { ErrorObject } from 'ajv';
import type { NextFunction, Request, Response } from 'express';
import type { NcApiVersion, NcRequest } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import {
  formatAjvErrorMessage,
  formatAjvErrors,
} from '~/helpers/ajvErrorFormatter';
import swagger, { swaggerV3Validation } from '~/schema';

export function parseHrtimeToMilliSeconds(hrtime) {
  const milliseconds = (hrtime[0] * 1000 + hrtime[1] / 1e6).toFixed(3);
  return milliseconds;
}

const ajv = new Ajv({ strictSchema: false, strict: false, allErrors: true }); // Initialize AJV
ajv.addSchema(swagger, 'swagger.json');
ajv.addSchema(swaggerV3Validation, 'swagger-v3.json');
addFormats(ajv);
ajvErrors(ajv);

// A middleware generator to validate the request body
export const getAjvValidatorMw = (schema: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validate = ajv.getSchema(schema);
    // Validate the request body against the schema
    const valid = validate(req.body);

    // If the request body is valid, call the next middleware
    if (valid) {
      next();
    } else {
      const errors: ErrorObject[] = ajv.errors || [];
      const formatted = formatAjvErrors(errors);

      res.status(400).json({
        message: formatAjvErrorMessage(errors),
        errors: formatted,
      });
    }
  };
};

// a function to validate the payload against the schema
export const validatePayload = (
  schema: string,
  payload: any,
  humanReadableError = false,
  context: { api_version?: NcApiVersion } = undefined,
) => {
  const validate = ajv.getSchema(schema);
  if (!validate) {
    NcError.get(context).genericNotFound('Validation schema', schema);
  }

  const valid = validate(payload);

  if (!valid) {
    const errors: ErrorObject[] = ajv.errors || validate.errors || [];
    const formatted = formatAjvErrors(errors);

    NcError.get(context).ajvValidationError({
      message: formatAjvErrorMessage(errors),
      errors: formatted,
      humanReadableError,
    });
  }
};

/**
 * Extracts API token from request headers.
 * - Prefers `xc-token` header
 * - Falls back to `Authorization: Bearer <token>`
 */
export function getApiTokenFromHeader(
  req?:
    | NcRequest
    | {
        headers?: Record<string, unknown>;
      },
): string | undefined {
  const headers = req?.headers;
  if (!headers) return;

  // 1) Prefer explicit xc-token header
  const token = headers['xc-token'];
  if (typeof token === 'string' && token.trim()) {
    return token.trim();
  }

  // 2) Fallback to Authorization: Bearer <token>
  const auth = headers['authorization'];
  if (typeof auth !== 'string') return;

  const value = auth.trim();
  if (value.toLowerCase().startsWith('bearer ')) {
    return value.slice(7).trim();
  }
}
