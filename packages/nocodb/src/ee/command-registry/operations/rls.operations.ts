import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/_types';
import { OperationName } from '~/command-registry/_op-names';
import { MetaTable } from '~/utils/globals';
import { Model } from '~/models';
import RlsPolicy from '~/ee/models/RlsPolicy';
import { rlsPolicyActions } from '~/decorators/trace-command-descriptions';

// ─── Reusable sub-schemas ─────────────────────────────────────────────────────

const filtersSchema = z.array(z.record(z.unknown())).optional();
const subjectsSchema = z.array(z.unknown()).optional();

// ─── rlsPolicyCreate ──────────────────────────────────────────────────────────

const rlsPolicyCreateSchema = z.object({
  body: z.object({
    id: z.string().optional(),
    fk_model_id: z.string(),
    title: z.string().optional(),
    is_default: z.boolean().optional(),
    default_behavior: z.string().optional(),
    subjects: subjectsSchema,
    filters: filtersSchema,
  }),
  userId: z.string(),
});

export const RlsPolicyCreateContract: OperationContract<
  typeof rlsPolicyCreateSchema
> = {
  name: OperationName.rlsPolicyCreate,
  version: 1,
  entity: MetaTable.RLS_POLICIES,
  schema: rlsPolicyCreateSchema,
  idField: 'body',
  entityId: 'id',
  entityTitle: 'title',
  parentId: (p) => p?.body?.fk_model_id,
  description: rlsPolicyActions.add,
  resolveCtx: async (context, param) => {
    const tableId = param?.body?.fk_model_id;
    const table = tableId ? await Model.get(context, tableId) : undefined;
    return { parentEntityTitle: table?.title };
  },
};

// ─── rlsPolicyUpdate ──────────────────────────────────────────────────────────

const rlsPolicyUpdateSchema = z.object({
  body: z.object({
    id: z.string(),
    title: z.string().optional(),
    enabled: z.boolean().optional(),
    default_behavior: z.string().optional(),
    order: z.number().optional(),
  }),
  userId: z.string(),
});

export const RlsPolicyUpdateContract: OperationContract<
  typeof rlsPolicyUpdateSchema
> = {
  name: OperationName.rlsPolicyUpdate,
  version: 1,
  entity: MetaTable.RLS_POLICIES,
  schema: rlsPolicyUpdateSchema,
  entityId: (p) => p?.body?.id,
  entityTitle: (p) => p?.body?.title,
  description: (ctx) =>
    ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
      ? rlsPolicyActions.rename(ctx)
      : rlsPolicyActions.edit(ctx),
  resolveCtx: async (context, param) => {
    const policy = param?.body?.id
      ? await RlsPolicy.get(context, param.body.id)
      : undefined;
    const table = policy?.fk_model_id
      ? await Model.get(context, policy.fk_model_id)
      : undefined;
    return {
      parentEntityTitle: table?.title,
      extra: { oldTitle: policy?.title },
    };
  },
};

// ─── rlsPolicyDelete ──────────────────────────────────────────────────────────

const rlsPolicyDeleteSchema = z.object({
  policyId: z.string(),
  userId: z.string(),
});

export const RlsPolicyDeleteContract: OperationContract<
  typeof rlsPolicyDeleteSchema
> = {
  name: OperationName.rlsPolicyDelete,
  version: 1,
  entity: MetaTable.RLS_POLICIES,
  schema: rlsPolicyDeleteSchema,
  entityId: (p) => p?.policyId,
  description: rlsPolicyActions.delete,
  resolveCtx: async (context, param) => {
    const policy = param?.policyId
      ? await RlsPolicy.get(context, param.policyId)
      : undefined;
    const table = policy?.fk_model_id
      ? await Model.get(context, policy.fk_model_id)
      : undefined;
    return {
      entityTitle: policy?.title,
      parentEntityTitle: table?.title,
    };
  },
};
