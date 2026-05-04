import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { DateDependency, Model } from '~/models';
import { dateDependencyActions } from '~/decorators/trace-command-descriptions';

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
] as const;

function snapshotDateDependency(
  rule: DateDependency | null | undefined,
): Record<string, unknown> | undefined {
  if (!rule) return undefined;
  const src = rule as unknown as Record<string, unknown>;
  const snap: Record<string, unknown> = {};
  for (const k of DATE_DEPENDENCY_PREV_FIELDS) snap[k] = src[k];
  return snap;
}

interface DateDependencyExtra {
  prev?: Record<string, unknown>;
}

// ─── dateDependencyUpdate ─────────────────────────────────────────────────────

const dateDependencyUpdateSchema = z.object({
  modelId: z.string(),
  body: z.record(z.unknown()),
});

export const DateDependencyUpdateContract: OperationContract<
  typeof dateDependencyUpdateSchema,
  DateDependencyExtra
> = {
  name: OperationName.dateDependencyUpdate,
  version: 1,
  entity: MetaTable.DATE_DEPENDENCY,
  schema: dateDependencyUpdateSchema,
  entityId: (p) => p?.modelId,
  description: dateDependencyActions.edit,
  resolveCtx: async (context, param) => {
    const table = param?.modelId
      ? await Model.get(context, param.modelId)
      : undefined;
    const existing = param?.modelId
      ? await DateDependency.getByModelId(context, param.modelId)
      : undefined;
    const prev = snapshotDateDependency(existing);
    return {
      parentEntityTitle: table?.title,
      ...(prev ? { extra: { prev } } : {}),
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (prev) {
      // Was an update — restore prior body.
      return {
        name: OperationName.dateDependencyUpdate,
        version: 1,
        params: { modelId: p.modelId, body: prev },
      };
    }
    // Was an insert (no prior rule) — undo by deleting.
    return {
      name: OperationName.dateDependencyDelete,
      version: 1,
      params: { modelId: p.modelId },
    };
  },
};

// ─── dateDependencyDelete ─────────────────────────────────────────────────────

const dateDependencyDeleteSchema = z.object({
  modelId: z.string(),
});

export const DateDependencyDeleteContract: OperationContract<
  typeof dateDependencyDeleteSchema,
  DateDependencyExtra
> = {
  name: OperationName.dateDependencyDelete,
  version: 1,
  entity: MetaTable.DATE_DEPENDENCY,
  schema: dateDependencyDeleteSchema,
  entityId: (p) => p?.modelId,
  description: dateDependencyActions.delete,
  resolveCtx: async (context, param) => {
    const table = param?.modelId
      ? await Model.get(context, param.modelId)
      : undefined;
    const existing = param?.modelId
      ? await DateDependency.getByModelId(context, param.modelId)
      : undefined;
    const prev = snapshotDateDependency(existing);
    return {
      parentEntityTitle: table?.title,
      ...(prev ? { extra: { prev } } : {}),
    };
  },
  // Delete with no existing rule is a no-op — keep the undo stack clean.
  skipIf: (_ctx, _p, _r, resolved) => !resolved?.extra?.prev,
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev) return null;
    return {
      name: OperationName.dateDependencyUpdate,
      version: 1,
      params: { modelId: p.modelId, body: prev },
    };
  },
};
