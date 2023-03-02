import { NextFunction, Request, Response } from 'express';
import Ajv, { ErrorObject } from 'ajv';
// @ts-ignore
import swagger from '../../../../schema/swagger.json';

export function parseHrtimeToSeconds(hrtime) {
  const seconds = (hrtime[0] + hrtime[1] / 1e6).toFixed(3);
  return seconds;
}

const ajv = new Ajv({ strictSchema: false, strict: false }); // Initialize AJV

ajv.addSchema(swagger, 'swagger.json');

// A middleware generator to validate the request body
export const getAjvValidatorMw = (schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Validate the request body against the schema
    const valid = ajv.validate(
      typeof schema === 'string' ? { $ref: schema } : schema,
      req.body
    );

    // If the request body is valid, call the next middleware
    if (valid) {
      next();
    } else {
      const errors: ErrorObject[] | null | undefined = ajv.errors;

      // If the request body is invalid, send a response with an error message
      res.status(400).json({
        status: 'error',
        message: 'Invalid request body',
        errors,
      });
    }
  };
};
