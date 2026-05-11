import type { Filter as FilterModel } from '~/models';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from '~/command-registry/types';
import type { FiltersService } from '~/services/filters.service';
import type { RlsService } from '~/services/rls.service';
import type { RlsPolicySubjectType } from 'nocodb-sdk';
import { OperationName } from '~/command-registry/op-names';
import { registerForward } from '~/command-registry/replay-context';
import { scopeBase } from '~/command-registry/scope';
import { MetaTable } from '~/utils/globals';
import { Filter, Model } from '~/models';
import RlsPolicy from '~/ee/models/RlsPolicy';
import { rlsPolicyActions } from '~/decorators/trace-command-descriptions';
import {
  rlsPolicyCreateSchema,
  rlsPolicyDeleteSchema,
  rlsPolicyFilterCreateSchema,
  rlsPolicySetSubjectsSchema,
  rlsPolicyUpdateSchema,
} from '~/command-registry/operations/_schemas/rls-policy';
import { pickFilterTreeFields } from '~/command-registry/operations/shared/filter-snapshot';
import { pickFields } from '~/utils/tsUtils';

const POLICY_PREV_FIELDS = [
  'title',
  'enabled',
  'is_default',
  'default_behavior',
  'order',
] as const satisfies readonly (keyof RlsPolicy)[];

const POLICY_DELETE_FIELDS = [
  'id',
  'fk_model_id',
  'title',
  'is_default',
  'default_behavior',
  'order',
  'enabled',
] as const satisfies readonly (keyof RlsPolicy)[];

type PolicyPrev = Pick<RlsPolicy, (typeof POLICY_PREV_FIELDS)[number]>;

function snapshotPolicyFields(
  policy: RlsPolicy | null | undefined,
): PolicyPrev | undefined {
  if (!policy) return undefined;
  return pickFields(policy, POLICY_PREV_FIELDS);
}

async function snapshotPolicyFilterTree(
  context: NcContext,
  rlsPolicyId: string,
): Promise<Array<Record<string, unknown>>> {
  const roots = await Filter.rootFilterListByRlsPolicy(context, {
    rlsPolicyId,
  });
  const walk = async (f: FilterModel): Promise<Record<string, unknown>> => {
    const children = f.is_group ? (await f.getChildren(context)) ?? [] : [];
    const childNodes = await Promise.all(
      children.map((c) => walk(c as FilterModel)),
    );
    return pickFilterTreeFields(f, childNodes);
  };
  return Promise.all(roots.map((result) => walk(result as FilterModel)));
}

export const RlsPolicyCreateContract: OperationContract<
  typeof rlsPolicyCreateSchema,
  Record<string, any>,
  RlsPolicy | undefined
> = {
  name: OperationName.rlsPolicyCreate,
  entity: MetaTable.RLS_POLICIES,
  schema: rlsPolicyCreateSchema,
  entry: {
    entity_id: (_params, result) => result?.id,
    entity_title: (params) => params.body?.title,
    description: rlsPolicyActions.add,
    before: async (context, params) => {
      const table = params.body?.fk_model_id
        ? await Model.get(context, params.body.fk_model_id)
        : undefined;
      return { parentEntityTitle: table?.title };
    },
  },
  sandbox: { id_field: 'body' },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.rlsPolicyDelete,
        params: { policyId: result.id },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

interface RlsPolicyUpdateExtra {
  oldTitle?: string;
  prev?: PolicyPrev;
}

export const RlsPolicyUpdateContract: OperationContract<
  typeof rlsPolicyUpdateSchema,
  RlsPolicyUpdateExtra,
  RlsPolicy | undefined
> = {
  name: OperationName.rlsPolicyUpdate,
  entity: MetaTable.RLS_POLICIES,
  schema: rlsPolicyUpdateSchema,
  entry: {
    entity_id: (params) => params.body?.id,
    entity_title: (params, result) => params.body?.title ?? result?.title,
    description: ({ extra, ...rest }) =>
      extra?.oldTitle && extra.oldTitle !== rest.entityTitle
        ? rlsPolicyActions.rename({ extra, ...rest })
        : rlsPolicyActions.edit({ extra, ...rest }),
    before: async (context, params) => {
      const policy = params.body?.id
        ? await RlsPolicy.get(context, params.body.id)
        : undefined;
      const table = policy?.fk_model_id
        ? await Model.get(context, policy.fk_model_id)
        : undefined;
      return {
        parentEntityTitle: table?.title,
        extra: {
          oldTitle: policy?.title,
          ...(policy ? { prev: snapshotPolicyFields(policy) } : {}),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      return {
        name: OperationName.rlsPolicyUpdate,
        params: { body: { id: params.body.id, ...prev } },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

type PolicyDeleteSnapshot = Pick<
  RlsPolicy,
  (typeof POLICY_DELETE_FIELDS)[number]
>;

interface RlsPolicyDeleteExtra {
  policy?: PolicyDeleteSnapshot;
  filters?: Array<Record<string, unknown>>;
  subjects?: RlsPolicySubjectType[];
}

export const RlsPolicyDeleteContract: OperationContract<
  typeof rlsPolicyDeleteSchema,
  RlsPolicyDeleteExtra,
  { success: true } | undefined
> = {
  name: OperationName.rlsPolicyDelete,
  entity: MetaTable.RLS_POLICIES,
  schema: rlsPolicyDeleteSchema,
  entry: {
    entity_id: (params) => params.policyId,
    description: rlsPolicyActions.delete,
    before: async (context, params) => {
      const policy = await RlsPolicy.get(context, params.policyId);
      if (!policy) return {};
      const table = policy.fk_model_id
        ? await Model.get(context, policy.fk_model_id)
        : undefined;
      const filters = await snapshotPolicyFilterTree(context, policy.id);
      return {
        entityTitle: policy.title,
        parentEntityTitle: table?.title,
        extra: {
          policy: pickFields(policy, POLICY_DELETE_FIELDS),
          filters,
          // `RlsPolicy.get` populates `subjects` via the same join as
          // `setSubjects` reads — snapshot whatever is currently attached.
          subjects: policy.subjects ?? [],
        },
      };
    },
    // Nothing to undo when no row existed.
    skip_if: (_context, _params, _result, resolved) => !resolved?.extra?.policy,
  },
  undo: {
    inverse: (_context, _params, _result, resolved) => {
      const snap = resolved?.extra;
      if (!snap?.policy) return null;
      return {
        name: OperationName.rlsPolicyCreate,
        // `createPolicy` honors `body.id` only under replay; the undo-redo
        // dispatcher opens a replay scope (`isReplay()` returns true), so
        // the original PK is preserved across undo→redo cycles.
        params: {
          body: {
            ...snap.policy,
            subjects: snap.subjects ?? [],
            filters: snap.filters ?? [],
          },
        },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

interface RlsPolicySetSubjectsExtra {
  prevSubjects?: RlsPolicySubjectType[];
}

export const RlsPolicySetSubjectsContract: OperationContract<
  typeof rlsPolicySetSubjectsSchema,
  RlsPolicySetSubjectsExtra,
  RlsPolicy | undefined
> = {
  name: OperationName.rlsPolicySetSubjects,
  entity: MetaTable.RLS_POLICIES,
  schema: rlsPolicySetSubjectsSchema,
  entry: {
    entity_id: (params) => params.policyId,
    description: rlsPolicyActions.setSubjects,
    before: async (context, params) => {
      const policy = await RlsPolicy.get(context, params.policyId);
      if (!policy) return {};
      const table = policy.fk_model_id
        ? await Model.get(context, policy.fk_model_id)
        : undefined;
      return {
        entityTitle: policy.title,
        parentEntityTitle: table?.title,
        extra: {
          prevSubjects: policy.subjects ?? [],
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevSubjects;
      if (!prev) return null;
      return {
        name: OperationName.rlsPolicySetSubjects,
        params: { policyId: params.policyId, subjects: prev },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export const RlsPolicyFilterCreateContract: OperationContract<
  typeof rlsPolicyFilterCreateSchema,
  Record<string, any>,
  Filter | undefined
> = {
  name: OperationName.rlsPolicyFilterCreate,
  entity: MetaTable.FILTER_EXP,
  schema: rlsPolicyFilterCreateSchema,
  entry: {
    entity_id: 'id',
    parent_id: (params) => params.rlsPolicyId,
    description: rlsPolicyActions.filterAdd,
    before: async (context, params) => {
      const policy = await RlsPolicy.get(context, params.rlsPolicyId);
      return { parentEntityTitle: policy?.title };
    },
  },
  sandbox: { id_field: 'filter' },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.filterDelete,
        params: { filterId: result.id },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export function registerRlsHandlers(
  rls: RlsService,
  filtersSvc: FiltersService,
): void {
  registerForward(RlsPolicyCreateContract, (context, params) =>
    rls.createPolicy(context, params),
  );
  registerForward(RlsPolicyUpdateContract, (context, params) =>
    rls.updatePolicy(context, params),
  );
  registerForward(RlsPolicyDeleteContract, (context, params) =>
    rls.deletePolicy(context, params),
  );
  registerForward(RlsPolicySetSubjectsContract, (context, params) =>
    rls.setSubjects(context, params),
  );
  registerForward(RlsPolicyFilterCreateContract, (context, params) =>
    filtersSvc.rlsPolicyFilterCreate(context, params),
  );
}
