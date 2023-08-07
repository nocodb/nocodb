import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { ErrorObject } from 'ajv';
import type { NextFunction, Request, Response } from 'express';
import swagger from '~/schema';
import { NcError } from '~/helpers/catchError';

export function parseHrtimeToMilliSeconds(hrtime) {
  const milliseconds = (hrtime[0] * 1000 + hrtime[1] / 1e6).toFixed(3);
  return milliseconds;
}

const ajv = new Ajv({ strictSchema: false, strict: false }); // Initialize AJV

ajv.addSchema(swagger, 'swagger.json');
addFormats(ajv);

// A middleware generator to validate the request body
export const getAjvValidatorMw = (schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Validate the request body against the schema
    const valid = ajv.validate(
      typeof schema === 'string' ? { $ref: schema } : schema,
      req.body,
    );

    // If the request body is valid, call the next middleware
    if (valid) {
      next();
    } else {
      const errors: ErrorObject[] | null | undefined = ajv.errors;

      // If the request body is invalid, send a response with an error message
      res.status(400).json({
        message: 'Invalid request body',
        errors,
      });
    }
  };
};

// a function to validate the payload against the schema
export const validatePayload = (schema, payload) => {
  // Validate the request body against the schema
  const valid = ajv.validate(
    typeof schema === 'string' ? { $ref: schema } : schema,
    payload,
  );

  // If the request body is not valid, throw error
  if (!valid) {
    const errors: ErrorObject[] | null | undefined = ajv.errors;

    // If the request body is invalid, throw error with error message  and errors
    NcError.ajvValidationError({
      message: 'Invalid request body',
      errors,
    });
  }
};
