import { z } from 'zod';
import type { Filter as FilterModel } from '~/models';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Filter, Model } from '~/models';
import RlsPolicy from '~/ee/models/RlsPolicy';
import { rlsPolicyActions } from '~/decorators/trace-command-descriptions';

const subjectSchema = z.object({
  type: z.enum(['user', 'team', 'role']),
  id: z.string(),
  hierarchy_scope: z.enum(['self_only', 'self_and_descendants']).optional(),
});

const filterTreeSchema: z.ZodType<unknown> = z.lazy(() =>
  z
    .object({
      children: z.array(filterTreeSchema).optional(),
    })
    .passthrough(),
);

const POLICY_PREV_FIELDS = [
  'title',
  'enabled',
  'is_default',
  'default_behavior',
  'order',
] as const;

function snapshotPolicyFields(
  policy: RlsPolicy | null | undefined,
): Record<string, unknown> | undefined {
  if (!policy) return undefined;
  const src = policy as unknown as Record<string, unknown>;
  const snap: Record<string, unknown> = {};
  for (const k of POLICY_PREV_FIELDS) snap[k] = src[k];
  return snap;
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
    return {
      ...(f as unknown as Record<string, unknown>),
      ...(childNodes.length ? { children: childNodes } : {}),
    };
  };
  return Promise.all(roots.map((r) => walk(r as FilterModel)));
}

// ─── rlsPolicyCreate ──────────────────────────────────────────────────────────

const rlsPolicyCreateSchema = z.object({
  body: z
    .object({
      id: z.string().optional(),
      fk_model_id: z.string(),
      title: z.string().optional(),
      is_default: z.boolean().optional(),
      default_behavior: z
        .enum(['show_all', 'deny_all', 'condition'])
        .optional(),
      subjects: z.array(subjectSchema).optional(),
      filters: z.array(filterTreeSchema).optional(),
    })
    .passthrough(),
});

export const RlsPolicyCreateContract: OperationContract<
  typeof rlsPolicyCreateSchema
> = {
  name: OperationName.rlsPolicyCreate,
  version: 1,
  entity: MetaTable.RLS_POLICIES,
  schema: rlsPolicyCreateSchema,
  idField: 'body',
  entityId: (_p, r) => (r as { id?: string } | undefined)?.id,
  entityTitle: (p) => p.body?.title,
  description: rlsPolicyActions.add,
  resolveCtx: async (context, param) => {
    const table = param.body?.fk_model_id
      ? await Model.get(context, param.body.fk_model_id)
      : undefined;
    return { parentEntityTitle: table?.title };
  },
  buildInverse: (_ctx, _p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.rlsPolicyDelete,
      version: 1,
      params: { policyId: newId },
    };
  },
};

// ─── rlsPolicyUpdate ──────────────────────────────────────────────────────────

const rlsPolicyUpdateSchema = z.object({
  body: z
    .object({
      id: z.string(),
      title: z.string().optional(),
      enabled: z.boolean().optional(),
      default_behavior: z
        .enum(['show_all', 'deny_all', 'condition'])
        .optional(),
      order: z.number().optional(),
    })
    .passthrough(),
});

interface RlsPolicyUpdateExtra {
  oldTitle?: string;
  prev?: Record<string, unknown>;
}

export const RlsPolicyUpdateContract: OperationContract<
  typeof rlsPolicyUpdateSchema,
  RlsPolicyUpdateExtra
> = {
  name: OperationName.rlsPolicyUpdate,
  version: 1,
  entity: MetaTable.RLS_POLICIES,
  schema: rlsPolicyUpdateSchema,
  entityId: (p) => p.body?.id,
  entityTitle: (p, r) =>
    p.body?.title ?? (r as { title?: string } | undefined)?.title,
  description: ({ extra, ...rest }) =>
    extra?.oldTitle && extra.oldTitle !== rest.entityTitle
      ? rlsPolicyActions.rename({ extra, ...rest })
      : rlsPolicyActions.edit({ extra, ...rest }),
  resolveCtx: async (context, param) => {
    const policy = param.body?.id
      ? await RlsPolicy.get(context, param.body.id)
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
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev) return null;
    return {
      name: OperationName.rlsPolicyUpdate,
      version: 1,
      params: { body: { id: p.body.id, ...prev } },
    };
  },
};

// ─── rlsPolicyDelete ──────────────────────────────────────────────────────────

const rlsPolicyDeleteSchema = z.object({
  policyId: z.string(),
});

interface RlsPolicyDeleteExtra {
  policy?: Record<string, unknown>;
  filters?: Array<Record<string, unknown>>;
  subjects?: Array<Record<string, unknown>>;
}

export const RlsPolicyDeleteContract: OperationContract<
  typeof rlsPolicyDeleteSchema,
  RlsPolicyDeleteExtra
> = {
  name: OperationName.rlsPolicyDelete,
  version: 1,
  entity: MetaTable.RLS_POLICIES,
  schema: rlsPolicyDeleteSchema,
  entityId: (p) => p.policyId,
  description: rlsPolicyActions.delete,
  resolveCtx: async (context, param) => {
    const policy = await RlsPolicy.get(context, param.policyId);
    if (!policy) return {};
    const table = policy.fk_model_id
      ? await Model.get(context, policy.fk_model_id)
      : undefined;
    const filters = await snapshotPolicyFilterTree(context, policy.id);
    return {
      entityTitle: policy.title,
      parentEntityTitle: table?.title,
      extra: {
        policy: {
          id: policy.id,
          fk_model_id: policy.fk_model_id,
          title: policy.title,
          is_default: policy.is_default,
          default_behavior: policy.default_behavior,
          order: policy.order,
        },
        filters,
        // `RlsPolicy.get` populates `subjects` via the same join as
        // `setSubjects` reads — snapshot whatever is currently attached.
        subjects: (policy.subjects ?? []) as unknown as Array<
          Record<string, unknown>
        >,
      },
    };
  },
  // Nothing to undo when no row existed.
  skipIf: (_ctx, _p, _r, resolved) => !resolved?.extra?.policy,
  buildInverse: (_ctx, _p, _r, resolved) => {
    const snap = resolved?.extra;
    if (!snap?.policy) return null;
    return {
      name: OperationName.rlsPolicyCreate,
      version: 1,
      // `createPolicy` honors `body.id` only under `is_replay`; the
      // undo-redo dispatcher sets `additionalContext.is_replay = true`, so
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
};

// ─── rlsPolicySetSubjects ─────────────────────────────────────────────────────

const rlsPolicySetSubjectsSchema = z.object({
  policyId: z.string(),
  subjects: z.array(subjectSchema),
});

interface RlsPolicySetSubjectsExtra {
  prevSubjects?: Array<Record<string, unknown>>;
}

export const RlsPolicySetSubjectsContract: OperationContract<
  typeof rlsPolicySetSubjectsSchema,
  RlsPolicySetSubjectsExtra
> = {
  name: OperationName.rlsPolicySetSubjects,
  version: 1,
  entity: MetaTable.RLS_POLICIES,
  schema: rlsPolicySetSubjectsSchema,
  entityId: (p) => p.policyId,
  description: rlsPolicyActions.setSubjects,
  resolveCtx: async (context, param) => {
    const policy = await RlsPolicy.get(context, param.policyId);
    if (!policy) return {};
    const table = policy.fk_model_id
      ? await Model.get(context, policy.fk_model_id)
      : undefined;
    return {
      entityTitle: policy.title,
      parentEntityTitle: table?.title,
      extra: {
        prevSubjects: (policy.subjects ?? []) as unknown as Array<
          Record<string, unknown>
        >,
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevSubjects;
    if (!prev) return null;
    return {
      name: OperationName.rlsPolicySetSubjects,
      version: 1,
      params: { policyId: p.policyId, subjects: prev },
    };
  },
};

// ─── rlsPolicyFilterCreate ────────────────────────────────────────────────────

const rlsPolicyFilterCreateSchema = z.object({
  filter: filterTreeSchema,
  rlsPolicyId: z.string(),
});

export const RlsPolicyFilterCreateContract: OperationContract<
  typeof rlsPolicyFilterCreateSchema
> = {
  name: OperationName.rlsPolicyFilterCreate,
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: rlsPolicyFilterCreateSchema,
  idField: 'filter',
  entityId: 'id',
  parentId: (p) => p.rlsPolicyId,
  description: rlsPolicyActions.filterAdd,
  resolveCtx: async (context, param) => {
    const policy = await RlsPolicy.get(context, param.rlsPolicyId);
    return { parentEntityTitle: policy?.title };
  },
  buildInverse: (_ctx, _p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.filterDelete,
      version: 1,
      params: { filterId: newId },
    };
  },
};
