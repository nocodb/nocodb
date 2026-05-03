import { Logger } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import type {
  ChangelogCommandPayload,
  DescCtx,
  DescFn,
  OperationContract,
  ResolvedCtx,
  TraceCommandDep,
} from './types';
import { OperationLog, Sandbox, SandboxChangelog } from '~/models';

const logger = new Logger('CommandRegistry');

const NON_SERIALIZABLE_KEYS = new Set([
  'req',
  'ncMeta',
  'user',
  'reuse',
  'viewWebhookManager',
  'columnWebhookManager',
  // Transient capture slot for side-effect IDs (e.g. LTAR junction model id).
  // Populated during recording, read by `extraCommandMeta`, never replayed.
  '_ltarCapture',
]);

export function dotGet(obj: any, path: string): any {
  if (obj == null) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function resolveField(
  field: string | ((p: any, r: any) => string | undefined) | undefined,
  param: any,
  result: any,
): string | undefined {
  if (field == null) return undefined;
  if (typeof field === 'function') return field(param, result);
  return dotGet(result, field) ?? dotGet(param, field);
}

export function extractReplayableParams(param: any): Record<string, any> {
  if (!param || typeof param !== 'object') return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(param)) {
    if (!NON_SERIALIZABLE_KEYS.has(k)) out[k] = v;
  }
  return out;
}

export function safeExtractDeps(
  fn: (p: any, r: any) => TraceCommandDep[],
  param: any,
  result: any,
): TraceCommandDep[] {
  try {
    const d = fn(param, result) || [];
    return d.filter((x) => x && x.id && x.entity);
  } catch (e: any) {
    logger.warn(`deps extraction failed: ${e.message}`);
    return [];
  }
}

function resolveDescription(
  description: string | DescFn | undefined,
  ctx: DescCtx,
  fallback: string,
): string {
  if (!description) return fallback;
  if (typeof description === 'function') return description(ctx);
  return description;
}

interface EntityInfo {
  entityId?: string;
  entityTitle?: string;
  parentEntityId?: string;
  parentEntityTitle?: string;
  description: string;
}

function resolveEntityInfo(
  contract: OperationContract,
  param: any,
  result: any,
  resolvedCtx: ResolvedCtx | undefined,
): EntityInfo {
  const entityId = resolveField(contract.entityId ?? 'id', param, result);
  const entityTitle =
    resolveField(contract.entityTitle, param, result) ??
    resolvedCtx?.entityTitle;
  const parentEntityId = resolveField(contract.parentId, param, result);
  const parentEntityTitle =
    resolveField(contract.parentTitle, param, result) ??
    resolvedCtx?.parentEntityTitle;

  const descCtx: DescCtx = {
    entityTitle,
    parentEntityTitle,
    operation: contract.name,
    extra: resolvedCtx?.extra ?? {},
  };

  return {
    entityId,
    entityTitle,
    parentEntityId,
    parentEntityTitle,
    description: resolveDescription(
      contract.description,
      descCtx,
      contract.name,
    ),
  };
}

/**
 * Validate params + extras, resolve metadata, write changelog rows.
 *
 * Two destinations:
 *  - `nc_sandbox_changelog` — when called against a sandbox base. Drives the
 *    sandbox→production replay pipeline.
 *  - `nc_operation_logs` — when the contract has `buildInverse` AND the
 *    request carries a tab id (`x-nc-tab-id`). Drives per-tab undo/redo.
 *
 * The two are independent: a non-sandbox call with an undoable contract
 * writes only the operation log; a sandbox call with no `buildInverse`
 * writes only the sandbox changelog. Replay calls (`__isReplay`) skip the
 * operation log to avoid recording the inverse-as-forward and ending up
 * with a stack that fights itself.
 *
 * Throws on schema-validation failure (strict mode).
 */
export async function recordCommand(
  context: NcContext,
  contract: OperationContract,
  param: any,
  result: any,
  resolvedCtx: ResolvedCtx | undefined,
): Promise<void> {
  if (!context?.base_id) return;

  const userId = param?.req?.user?.id || param?.user?.id;
  if (!userId) return;

  // Decide upfront whether either destination will write — schema.parse and
  // resolveEntityInfo can be expensive (deep zod), so skip both when nothing
  // is recorded. This matters for API-token / job traffic on a production
  // base with no `x-nc-tab-id`: previously we paid the full validation cost
  // for every traced op only to drop the row.
  const isUndoableCandidate =
    !!contract.buildInverse && !param?.req?.__isReplay && !!param?.req?.ncTabId;

  const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);
  if (!sandbox && !isUndoableCandidate) return;

  const replayableParams = extractReplayableParams(param);

  // STRICT — throws on validation failure
  const validatedParams = contract.schema.parse(replayableParams);

  const extraRaw = contract.extraCommandMeta
    ? contract.extraCommandMeta(param, result)
    : undefined;
  const extra =
    contract.extraSchema && extraRaw
      ? contract.extraSchema.parse(extraRaw)
      : extraRaw;

  const info = resolveEntityInfo(contract, param, result, resolvedCtx);

  await Promise.all([
    sandbox
      ? insertSandboxChangelog(
          context,
          contract,
          sandbox,
          param,
          result,
          info,
          validatedParams,
          extra,
          userId,
        )
      : null,
    isUndoableCandidate
      ? maybeRecordUndoEntry(
          context,
          contract,
          param,
          result,
          resolvedCtx,
          info,
          validatedParams,
          userId,
        )
      : null,
  ]);
}

async function insertSandboxChangelog(
  context: NcContext,
  contract: OperationContract,
  sandbox: Sandbox,
  param: any,
  result: any,
  info: EntityInfo,
  validatedParams: unknown,
  extra: Record<string, unknown> | undefined,
  userId: string,
): Promise<void> {
  const deps = contract.deps
    ? safeExtractDeps(contract.deps, param, result)
    : [];

  const command: ChangelogCommandPayload = {
    name: contract.name,
    version: contract.version,
    params: validatedParams,
    ...(extra ? { extra } : {}),
  };

  await SandboxChangelog.insert({
    fk_sandbox_id: sandbox.id,
    base_id: context.base_id,
    event: contract.name,
    entity_type: contract.entity,
    entity_id: info.entityId,
    entity_title: info.entityTitle?.substring(0, 255),
    parent_entity_id: info.parentEntityId,
    parent_entity_title: info.parentEntityTitle?.substring(0, 255),
    created_by: userId,
    description: info.description?.substring(0, 500),
    meta: JSON.stringify({
      command,
      ...(deps.length ? { deps } : {}),
    }),
  });
}

async function maybeRecordUndoEntry(
  context: NcContext,
  contract: OperationContract,
  param: any,
  result: any,
  resolvedCtx: ResolvedCtx | undefined,
  info: EntityInfo,
  validatedParams: unknown,
  userId: string,
): Promise<void> {
  if (!contract.buildInverse) return;

  // Don't record undo entries during sandbox replay — replay would otherwise
  // build inverses for operations that were already recorded by the original
  // user mutation, doubling the stack and breaking redo.
  if (param?.req?.__isReplay) return;

  const tabId = param?.req?.ncTabId;
  if (!tabId) return;

  let inverse: Awaited<ReturnType<NonNullable<typeof contract.buildInverse>>>;
  try {
    inverse = await contract.buildInverse(context, param, result, resolvedCtx);
  } catch (e: any) {
    logger.warn(
      `buildInverse ${contract.name}@${contract.version}: ${e?.message}`,
    );
    return;
  }
  if (!inverse) return;

  await OperationLog.insert(context, {
    fk_user_id: userId,
    tab_id: tabId,
    forward_op: contract.name,
    forward_op_version: contract.version,
    forward_params: validatedParams,
    inverse_op: inverse.name,
    inverse_op_version: inverse.version ?? 1,
    inverse_params: inverse.params,
    entity_type: contract.entity,
    entity_id: info.entityId,
    entity_title: info.entityTitle?.substring(0, 255),
    description: info.description?.substring(0, 500),
  });
}
