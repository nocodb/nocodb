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
 * Validate params + extras, resolve metadata, insert changelog row.
 * Throws on schema-validation failure (strict mode).
 *
 * Models are lazily imported to avoid circular-dependency issues at module
 * load time (Sandbox → Noco → app.module → services → models barrel).
 * The lazy import is resolved only when recordCommand is actually invoked
 * (runtime, not import time), so unit tests that test the pure helpers in
 * this module are not affected by the circular chain.
 */
export async function recordCommand(
  context: NcContext,
  contract: OperationContract,
  param: any,
  result: any,
  resolvedCtx: ResolvedCtx | undefined,
): Promise<void> {
  if (!context?.base_id) return;

  // Lazy import to avoid circular dependency at module load time.
  const { Sandbox, SandboxChangelog } = await import('~/models');

  const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);
  if (!sandbox) return;

  const userId = param?.req?.user?.id || param?.user?.id;
  if (!userId) return;

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
