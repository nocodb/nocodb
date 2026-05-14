import { z } from 'zod';
import { BaseVariableInheritance, BaseVariableValueType } from 'nocodb-sdk';

const variableBodySchema = z
  .object({
    id: z.string().optional(),
    key: z.string(),
    value: z.string().optional(),
    description: z.string().optional(),
    inheritance: z.nativeEnum(BaseVariableInheritance).optional(),
    type: z.nativeEnum(BaseVariableValueType).optional(),
  })
  .strict();

export const baseVariableCreateSchema = z
  .object({
    baseId: z.string(),
    variable: variableBodySchema,
  })
  .strict();

export const baseVariableUpdateSchema = z
  .object({
    variableId: z.string(),
    /** Partial body; service applies only provided fields. */
    variable: variableBodySchema.partial().optional(),
  })
  .strict();

export const baseVariableDeleteSchema = z
  .object({
    variableId: z.string(),
  })
  .strict();
