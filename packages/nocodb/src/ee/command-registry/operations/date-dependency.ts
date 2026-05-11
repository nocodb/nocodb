import type { OperationContract } from '~/command-registry/types';
import type { DateDependencyService } from '~/services/date-dependency.service';
import { OperationName } from '~/command-registry/op-names';
import { registerForward } from '~/command-registry/replay-context';
import { scopeBase } from '~/command-registry/scope';
import { MetaTable } from '~/utils/globals';
import { DateDependency, Model } from '~/models';
import { pickFields } from '~/utils/tsUtils';
import { dateDependencyActions } from '~/decorators/trace-command-descriptions';
import {
  dateDependencyDeleteSchema,
  dateDependencyUpdateSchema,
} from '~/command-registry/operations/_schemas/date-dependency';

const DATE_DEPENDENCY_PREV_FIELDS = [
  'fk_start_date_field_id',
  'fk_end_date_field_id',
  'fk_duration_field_id',
  'fk_dependency_linkrow_field_id',
  'dependency_linkrow_role',
  'dependency_connection_type',
  'dependency_buffer_type',
  'dependency_buffer_days',
  'include_weekends',
  'is_active',
] as const satisfies readonly (keyof DateDependency)[];

type DateDependencySnapshot = Pick<
  DateDependency,
  (typeof DATE_DEPENDENCY_PREV_FIELDS)[number]
>;

interface DateDependencyExtra {
  prev?: DateDependencySnapshot;
}

export const DateDependencyUpdateContract: OperationContract<
  typeof dateDependencyUpdateSchema,
  DateDependencyExtra,
  DateDependency | undefined
> = {
  name: OperationName.dateDependencyUpdate,
  entity: MetaTable.DATE_DEPENDENCY,
  schema: dateDependencyUpdateSchema,
  entry: {
    entity_id: (params) => params?.modelId,
    description: dateDependencyActions.edit,
    before: async (context, params) => {
      const table = params?.modelId
        ? await Model.get(context, params.modelId)
        : undefined;
      const existing = params?.modelId
        ? await DateDependency.getByModelId(context, params.modelId)
        : undefined;
      const prev = existing
        ? pickFields(existing, DATE_DEPENDENCY_PREV_FIELDS)
        : undefined;
      return {
        parentEntityTitle: table?.title,
        ...(prev ? { extra: { prev } } : {}),
      };
    },
  },
  undo: {
    // Was an update if `prev` exists — restore prior body. Otherwise the
    // forward was an insert; undo by deleting.
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (prev) {
        return {
          name: OperationName.dateDependencyUpdate,
          params: { modelId: params.modelId, body: prev },
        };
      }
      return {
        name: OperationName.dateDependencyDelete,
        params: { modelId: params.modelId },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export const DateDependencyDeleteContract: OperationContract<
  typeof dateDependencyDeleteSchema,
  DateDependencyExtra,
  void
> = {
  name: OperationName.dateDependencyDelete,
  entity: MetaTable.DATE_DEPENDENCY,
  schema: dateDependencyDeleteSchema,
  entry: {
    entity_id: (params) => params?.modelId,
    description: dateDependencyActions.delete,
    before: async (context, params) => {
      const table = params?.modelId
        ? await Model.get(context, params.modelId)
        : undefined;
      const existing = params?.modelId
        ? await DateDependency.getByModelId(context, params.modelId)
        : undefined;
      const prev = existing
        ? pickFields(existing, DATE_DEPENDENCY_PREV_FIELDS)
        : undefined;
      return {
        parentEntityTitle: table?.title,
        ...(prev ? { extra: { prev } } : {}),
      };
    },
    // Delete with no existing rule is a no-op — keep the undo stack clean.
    skip_if: (_context, _params, _result, resolved) => !resolved?.extra?.prev,
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      return {
        name: OperationName.dateDependencyUpdate,
        params: { modelId: params.modelId, body: prev },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export function registerDateDependencyHandlers(
  svc: DateDependencyService,
): void {
  registerForward(DateDependencyUpdateContract, (context, params) =>
    svc.update(context, params),
  );
  registerForward(DateDependencyDeleteContract, (context, params) =>
    svc.delete(context, params),
  );
}
