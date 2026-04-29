import { z } from 'zod';
import { BaseVariableInheritance, BaseVariableValueType } from 'nocodb-sdk';
import type { OperationContract } from 'src/command-registry/_types';
import { MetaTable } from '~/utils/globals';
import { BaseVariable } from '~/models';
import { baseVariableActions } from '~/decorators/trace-command-descriptions';

const variableBodySchema = z.object({
  key: z.string(),
  value: z.string().optional(),
  description: z.string().optional(),
  inheritance: z.nativeEnum(BaseVariableInheritance).optional(),
  type: z.nativeEnum(BaseVariableValueType).optional(),
});

const createSchema = z.object({
  baseId: z.string(),
  variable: variableBodySchema,
});

export const BaseVariableCreateContract: OperationContract<
  typeof createSchema
> = {
  name: 'baseVariableCreate',
  version: 1,
  entity: MetaTable.BASE_VARIABLES,
  schema: createSchema,
  idField: 'variable',
  entityId: 'id',
  entityTitle: 'key',
  description: baseVariableActions.add,
};

const updateSchema = z.object({
  variableId: z.string(),
  variable: variableBodySchema.partial().optional(),
});

export const BaseVariableUpdateContract: OperationContract<
  typeof updateSchema
> = {
  name: 'baseVariableUpdate',
  version: 1,
  entity: MetaTable.BASE_VARIABLES,
  schema: updateSchema,
  entityId: (p) => p.variableId,
  description: baseVariableActions.edit,
  skipIf: async (context, param) => {
    const v = await BaseVariable.get(context, param.variableId);
    return v?.is_inherited === true;
  },
};

const deleteSchema = z.object({
  variableId: z.string(),
});

export const BaseVariableDeleteContract: OperationContract<
  typeof deleteSchema
> = {
  name: 'baseVariableDelete',
  version: 1,
  entity: MetaTable.BASE_VARIABLES,
  schema: deleteSchema,
  entityId: (p) => p.variableId,
  description: baseVariableActions.delete,
  resolveCtx: async (context, param) => {
    const variable = await BaseVariable.get(context, param.variableId);
    return {
      entityTitle: variable?.key,
      extra: { is_inherited: !!variable?.is_inherited },
    };
  },
  skipIf: (_c, _p, _r, ctx) => ctx?.extra?.is_inherited === true,
};
