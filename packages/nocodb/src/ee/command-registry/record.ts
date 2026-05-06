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
import { getTraceCapture } from '~/decorators/trace-command.decorator';
import { isReplay } from '~/helpers/replayScope';

const logger = new Logger('CommandRegistry');

const NON_SERIALIZABLE_KEYS = new Set([
  'req',
  'ncMeta',
  'user',
  'reuse',
  'viewWebhookManager',
  'columnWebhookManager',
]);

export function dotGet(obj: any, path: string): any {
  if (obj == null) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function resolveField(
  field:
    | string
    | ((params: any, result: any) => string | undefined)
    | undefined,
  params: any,
  result: any,
): string | undefined {
  if (field == null) return undefined;
  if (typeof field === 'function') return field(params, result);
  return dotGet(result, field) ?? dotGet(params, field);
}

export function extractReplayableParams(params: any): Record<string, any> {
  if (!params || typeof params !== 'object') return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (!NON_SERIALIZABLE_KEYS.has(k)) out[k] = v;
  }
  return out;
}

export function safeExtractDeps(
  fn: (params: any, result: any) => TraceCommandDep[],
  params: any,
  result: any,
): TraceCommandDep[] {
  try {
    const d = fn(params, result) || [];
    return d.filter((x) => x && x.id && x.entity);
  } catch (e: any) {
    logger.warn(`deps extraction failed: ${e.message}`);
    return [];
  }
}

function resolveDescription(
  description: string | DescFn | undefined,
  context: DescCtx,
  fallback: string,
): string {
  if (!description) return fallback;
  if (typeof description === 'function') return description(context);
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
  params: any,
  result: any,
  resolvedCtx: ResolvedCtx | undefined,
): EntityInfo {
  const entry = contract.entry;
  const entityId = resolveField(entry?.entity_id ?? 'id', params, result);
  const entityTitle =
    resolveField(entry?.entity_title, params, result) ??
    resolvedCtx?.entityTitle;
  const parentEntityId = resolveField(entry?.parent_id, params, result);
  const parentEntityTitle = resolvedCtx?.parentEntityTitle;

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
    description: resolveDescription(entry?.description, descCtx, contract.name),
  };
}

/**
 * Two independent destinations:
 *  - `nc_sandbox_changelog` — sandbox → production replay (when called on a
 *    sandbox base).
 *  - `nc_operation_logs`    — per-tab undo/redo (when contract has
 *    `undo.inverse` AND the request carries a tab id).
 *
 * Replay (`isReplay()` true) skips the operation log to avoid the
 * inverse-as-forward stack-fight. Throws on schema validation failure.
 */
export async function recordCommand(
  context: NcContext,
  contract: OperationContract,
  params: any,
  result: any,
  resolvedCtx: ResolvedCtx | undefined,
): Promise<void> {
  if (!context?.base_id) return;

  const userId = params?.req?.user?.id || params?.user?.id;
  if (!userId) return;

  // Skip the deep zod parse + entity-info resolve when neither destination
  // will write — matters for API-token / job traffic without `x-nc-tab-id`.
  const isUndoableCandidate =
    !!contract.undo?.inverse && !isReplay() && !!params?.req?.ncTabId;

  const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);
  if (!sandbox && !isUndoableCandidate) return;

  const replayableParams = extractReplayableParams(params);

  const validatedParams = contract.schema.parse(replayableParams);

  let extraRaw: Record<string, unknown> | undefined;
  const captureKeys = contract.sandbox?.capture;
  if (captureKeys?.length) {
    const captured: Record<string, unknown> = {};
    for (const key of captureKeys) {
      const value = getTraceCapture(key);
      if (value !== undefined) captured[key] = value;
    }
    if (Object.keys(captured).length > 0) extraRaw = captured;
  }
  const captureSchema = contract.sandbox?.capture_schema;
  const extra =
    captureSchema && extraRaw ? captureSchema.parse(extraRaw) : extraRaw;

  const info = resolveEntityInfo(contract, params, result, resolvedCtx);

  await Promise.all([
    sandbox
      ? insertSandboxChangelog(
          context,
          contract,
          sandbox,
          params,
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
          params,
          result,
          resolvedCtx,
          info,
          validatedParams,
          extra,
          userId,
        )
      : null,
  ]);
}

async function insertSandboxChangelog(
  context: NcContext,
  contract: OperationContract,
  sandbox: Sandbox,
  params: any,
  result: any,
  info: EntityInfo,
  validatedParams: unknown,
  extra: Record<string, unknown> | undefined,
  userId: string,
): Promise<void> {
  const dependenciesFn = contract.sandbox?.dependencies;
  const deps = dependenciesFn
    ? safeExtractDeps(dependenciesFn, params, result)
    : [];

  const command: ChangelogCommandPayload = {
    name: contract.name,
    version: contract.version ?? 1,
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
  params: any,
  result: any,
  resolvedCtx: ResolvedCtx | undefined,
  info: EntityInfo,
  validatedParams: unknown,
  extra: Record<string, unknown> | undefined,
  userId: string,
): Promise<void> {
  const inverseFn = contract.undo?.inverse;
  if (!inverseFn) return;

  // Replay would double-record (original user mutation already wrote the row).
  if (isReplay()) return;

  const tabId = params?.req?.ncTabId;
  if (!tabId) return;

  let inverse: Awaited<ReturnType<typeof inverseFn>>;
  try {
    inverse = await inverseFn(context, params, result, resolvedCtx);
  } catch (e: any) {
    logger.warn(
      `undo.inverse ${contract.name}@${contract.version ?? 1}: ${e?.message}`,
    );
    return;
  }
  if (!inverse) return;

  await OperationLog.discardUndoneForTab(context, {
    fk_user_id: userId,
    tab_id: tabId,
  });

  await OperationLog.insert(context, {
    fk_user_id: userId,
    tab_id: tabId,
    forward_op: contract.name,
    forward_op_version: contract.version ?? 1,
    forward_params: validatedParams,
    inverse_op: inverse.name,
    inverse_op_version: inverse.version ?? 1,
    inverse_params: inverse.params,
    entity_type: contract.entity,
    entity_id: info.entityId,
    entity_title: info.entityTitle?.substring(0, 255),
    description: info.description?.substring(0, 500),
    ...(extra ? { meta: extra } : {}),
  });
}
