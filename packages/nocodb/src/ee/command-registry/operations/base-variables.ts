import type { OperationContract } from '~/command-registry/types';
import type { BaseVariablesService } from '~/services/base-variables.service';
import { OperationName } from '~/command-registry/op-names';
import { registerForward } from '~/command-registry/replay-context';
import { MetaTable } from '~/utils/globals';
import { BaseVariable } from '~/models';
import { baseVariableActions } from '~/decorators/trace-command-descriptions';
import {
  baseVariableCreateSchema,
  baseVariableDeleteSchema,
  baseVariableUpdateSchema,
} from '~/command-registry/operations/_schemas/base-variables';

export const BaseVariableCreateContract: OperationContract<
  typeof baseVariableCreateSchema
> = {
  name: OperationName.baseVariableCreate,
  entity: MetaTable.BASE_VARIABLES,
  schema: baseVariableCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: 'key',
    description: baseVariableActions.add,
  },
  sandbox: { id_field: 'variable' },
};

export const BaseVariableUpdateContract: OperationContract<
  typeof baseVariableUpdateSchema
> = {
  name: OperationName.baseVariableUpdate,
  entity: MetaTable.BASE_VARIABLES,
  schema: baseVariableUpdateSchema,
  entry: {
    entity_id: (params) => params.variableId,
    description: baseVariableActions.edit,
    // Inherited rows can't be updated locally — local writes are silently
    // ignored by the service, so don't pollute the changelog with them either.
    skip_if: async (context, params) => {
      const v = await BaseVariable.get(context, params.variableId);
      return v?.is_inherited === true;
    },
  },
};

interface BaseVariableDeleteExtra {
  is_inherited?: boolean;
}

export const BaseVariableDeleteContract: OperationContract<
  typeof baseVariableDeleteSchema,
  BaseVariableDeleteExtra
> = {
  name: OperationName.baseVariableDelete,
  entity: MetaTable.BASE_VARIABLES,
  schema: baseVariableDeleteSchema,
  entry: {
    entity_id: (params) => params.variableId,
    description: baseVariableActions.delete,
    before: async (context, params) => {
      const variable = await BaseVariable.get(context, params.variableId);
      return {
        entityTitle: variable?.key,
        extra: { is_inherited: !!variable?.is_inherited },
      };
    },
    skip_if: (_context, _params, _result, resolved) =>
      resolved?.extra?.is_inherited === true,
  },
};

export function registerBaseVariableHandlers(svc: BaseVariablesService): void {
  registerForward(BaseVariableCreateContract, (context, params) =>
    svc.create(context, params),
  );
  registerForward(BaseVariableUpdateContract, (context, params) =>
    svc.update(context, params),
  );
  registerForward(BaseVariableDeleteContract, (context, params) =>
    svc.delete(context, params),
  );
}
