import { Logger } from '@nestjs/common';
import { CommandReplayRegistry } from './command-replay-registry';
import type { DescCtx, DescFn } from './trace-command-descriptions';
import type { MetaTable } from '~/utils/globals';
import { Sandbox, SandboxChangelog } from '~/models';

const logger = new Logger('TraceCommand');

/**
 * Fields to strip from service params before storing as replayable command.
 * These are runtime-specific objects that can't be serialized or replayed.
 */
const NON_SERIALIZABLE_KEYS = new Set([
  'req',
  'ncMeta',
  'user',
  'reuse',
  'viewWebhookManager',
  'columnWebhookManager',
]);

export interface TraceCommandDep {
  entity: MetaTable;
  id: string;
}

export interface ResolvedCtx {
  entityTitle?: string;
  parentEntityTitle?: string;
  extra?: Record<string, any>;
}

export interface TraceCommandOptions {
  entity: MetaTable;
  entityId?: string | ((param: any, result: any) => string | undefined);
  entityTitle?: string | ((param: any, result: any) => string | undefined);
  parentId?: string | ((param: any, result: any) => string | undefined);
  parentTitle?: string | ((param: any, result: any) => string | undefined);
  deps?: (param: any, result: any) => TraceCommandDep[];
  /** Human-readable changelog description. Receives a DescCtx with titles, operation, and extra context. */
  description?: string | DescFn;
  /**
   * Resolve description context BEFORE the method executes.
   * Use for delete operations where the entity won't exist after execution,
   * and for resolving parent entity titles (e.g. table name for column operations).
   * `extra` fields are forwarded to the description function's DescCtx.
   */
  resolveCtx?: (context: any, param: any) => Promise<ResolvedCtx>;
  /**
   * For create operations: the key in `param` whose object gets the sandbox entity ID
   * injected during master replay for ID preservation.
   * Example: 'table' for tableCreate, 'column' for columnAdd.
   */
  idField?: string;
  /**
   * Extract additional data to embed in meta.command after execution.
   * Used by the replay service to reconstruct state that can't be derived
   * from the stored params alone.
   * Example: tableCreate stores sandboxColumns so replay can seed auto-created
   * column IDs (Title column etc.) that are not in the original param body.
   */
  extraCommandMeta?: (param: any, result: any) => Record<string, any>;
  /**
   * Override the operation name used as the registry key and stored in
   * meta.command.operation. Required when two service classes have methods
   * with the same name — both would otherwise register under the same key,
   * with the last-loaded class silently winning.
   * Example: FiltersV3Service.filterCreate sets operation: 'filterCreateV3'.
   */
  operation?: string;
  /**
   * Conditionally skip changelog recording even when the base is a sandbox.
   * Evaluated AFTER the method runs (so post-state is observable via `result`)
   * but BEFORE the changelog write. Receives the pre-execution `resolvedCtx`
   * for cases where post-state has lost relevant info (e.g. deletes).
   * Returning truthy (or throwing) skips recording.
   * Example: base variables skip recording for already-inherited vars — those
   * are sandbox-local overrides and must not propagate back to master.
   */
  skipIf?: (
    context: any,
    param: any,
    result: any,
    resolvedCtx: ResolvedCtx | undefined,
  ) => Promise<boolean> | boolean;
}

export function dotGet(obj: any, path: string): any {
  if (obj == null) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * Resolve an entityId/parentId/title field from (param, result).
 * - string: dot-path; checked against `result` first, then `param`
 *   (result wins so freshly-assigned IDs beat stale param echoes)
 * - function: custom extractor receiving (param, result)
 * - undefined: returns undefined
 */
export function resolveField(
  field: string | ((p: any, r: any) => string | undefined) | undefined,
  param: any,
  result: any,
): string | undefined {
  if (field == null) return undefined;
  if (typeof field === 'function') return field(param, result);
  return dotGet(result, field) ?? dotGet(param, field);
}

/**
 * Extract only the data params from a service method's param object.
 * Strips request, user, meta-connection, and webhook manager objects.
 */
function extractReplayableParams(param: any): Record<string, any> {
  if (!param || typeof param !== 'object') return {};

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(param)) {
    if (!NON_SERIALIZABLE_KEYS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * @TraceCommand(options) decorator for service methods that mutate schema.
 *
 * When a schema mutation runs on a sandbox base, records the command to the
 * sandbox changelog for replay during merge.
 *
 * Sets `req.__commandTraced = true` so nested @TraceCommand calls (inner
 * service methods called by the decorated method) skip recording — only the
 * outermost decorated call in the call stack records.
 *
 * INVARIANT: every mutating operation that needs sandbox replay MUST go through
 * a service method decorated with @TraceCommand. Controller-level or ad-hoc
 * tracking is not supported — the decorator auto-registers the operation in
 * CommandReplayRegistry so the merge processor can replay it. Operations without
 * a registered replay handler are silently skipped during merge.
 */
export function TraceCommand(options: TraceCommandOptions) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    // Auto-register for sandbox merge replay using the actual class reference.
    // _target is the prototype; _target.constructor is the class itself.
    // Use options.operation as the registry key when provided — required when two
    // different classes share a method name (e.g. filterCreate in V1 and V3 services).
    const opName = options.operation ?? propertyKey;
    CommandReplayRegistry.register(opName, {
      serviceClass: _target.constructor,
      method: propertyKey,
    });

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = args[0];
      const param = args[1];

      // Nested call: an outer @TraceCommand already owns recording for this request.
      if (param?.req?.__commandTraced) {
        return originalMethod.apply(this, args);
      }

      // Mark so any nested @TraceCommand calls skip recording.
      if (param?.req) {
        (param.req as any).__commandTraced = true;
      }

      // Resolve description context before execution (for deletes where entity won't exist after).
      let resolvedCtx: ResolvedCtx | undefined;
      if (options.resolveCtx) {
        try {
          resolvedCtx = await options.resolveCtx(context, param);
        } catch (e: any) {
          logger.warn(`Trace resolveCtx ${opName}: ${e.message}`);
        }
      }

      const result = await originalMethod.apply(this, args);

      if (options.skipIf) {
        try {
          if (await options.skipIf(context, param, result, resolvedCtx))
            return result;
        } catch (e: any) {
          logger.warn(`Trace skipIf ${opName}: ${e.message}`);
        }
      }

      // Awaited (not fire-and-forget) so changelog rows are inserted in strict
      // execution order — out-of-order rows cause replay failures (e.g. viewDelete
      // replayed before gridViewCreate for the same view).
      try {
        await recordCommand(
          context,
          opName,
          param,
          result,
          options,
          resolvedCtx,
        );
      } catch (e) {
        logger.warn(`Trace ${opName}: ${e.message}`);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Record a command to the sandbox changelog.
 * Only records if the context's base is a sandbox.
 */
async function recordCommand(
  context: any,
  operation: string,
  param: any,
  result: any,
  options: TraceCommandOptions,
  resolvedCtx?: ResolvedCtx,
): Promise<void> {
  if (!context?.base_id) return;

  const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);
  if (!sandbox) return;

  const userId = param?.req?.user?.id || param?.user?.id;
  if (!userId) return;

  const replayableParams = extractReplayableParams(param);

  const entityInfo = {
    entityType: options.entity,
    entityId: resolveField(options.entityId ?? 'id', param, result),
    entityTitle:
      resolveField(options.entityTitle, param, result) ??
      resolvedCtx?.entityTitle,
    parentEntityId: resolveField(options.parentId, param, result),
    parentEntityTitle:
      resolveField(options.parentTitle, param, result) ??
      resolvedCtx?.parentEntityTitle,
  };

  const deps = options.deps ? safeExtractDeps(options.deps, param, result) : [];

  const descCtx: DescCtx = {
    entityTitle: entityInfo.entityTitle,
    parentEntityTitle: entityInfo.parentEntityTitle,
    operation,
    extra: resolvedCtx?.extra ?? {},
  };

  const description = resolveDescription(
    options.description,
    descCtx,
    operation,
  );

  const extraCmd = options.extraCommandMeta
    ? options.extraCommandMeta(param, result)
    : {};

  await SandboxChangelog.insert({
    fk_sandbox_id: sandbox.id,
    base_id: context.base_id,
    event: operation,
    entity_type: entityInfo.entityType,
    entity_id: entityInfo.entityId,
    entity_title: entityInfo.entityTitle?.substring(0, 255),
    parent_entity_id: entityInfo.parentEntityId,
    parent_entity_title: entityInfo.parentEntityTitle?.substring(0, 255),
    created_by: userId,
    description: description?.substring(0, 500),
    meta: JSON.stringify({
      command: {
        operation,
        params: replayableParams,
        ...(options.idField ? { idField: options.idField } : {}),
        ...extraCmd,
      },
      ...(deps.length ? { deps } : {}),
    }),
  });
}

function resolveDescription(
  description: TraceCommandOptions['description'],
  ctx: DescCtx,
  fallback: string,
): string {
  if (!description) return fallback;
  if (typeof description === 'function') return description(ctx);
  return description;
}

function safeExtractDeps(
  fn: (p: any, r: any) => TraceCommandDep[],
  param: any,
  result: any,
): TraceCommandDep[] {
  try {
    const deps = fn(param, result) || [];
    return deps.filter((d) => d && d.id && d.entity);
  } catch (e: any) {
    logger.warn(`Trace deps extraction failed: ${e.message}`);
    return [];
  }
}
