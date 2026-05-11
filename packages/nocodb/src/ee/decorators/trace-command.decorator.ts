import { AsyncLocalStorage } from 'node:async_hooks';
import { Logger } from '@nestjs/common';
import type { OperationName } from '~/command-registry/op-names';
import type {
  CaptureBag,
  CaptureKey,
  MacroTranscriptEntry,
  OperationContract,
  ResolvedCtx,
} from '~/command-registry/types';
import { OperationRegistry } from '~/command-registry/registry';
import {
  extractReplayableParams,
  recordCommand,
  resolveField,
} from '~/command-registry/record';

const logger = new Logger('TraceCommand');

interface TraceScopeState {
  active: boolean;
  capture: Map<CaptureKey, CaptureBag[CaptureKey]>;
  /** When set, this scope was opened by a macro op. Nested @TraceCommand
   *  calls auto-record one entry each into this array (instead of being
   *  silent re-entrant skips). The macro's recordCommand persists this
   *  as `meta.extra.macroTranscript`. */
  transcript?: MacroTranscriptEntry[];
}

const traceScope = new AsyncLocalStorage<TraceScopeState>();

export function captureForTrace<K extends CaptureKey>(
  key: K,
  value: CaptureBag[K],
): void {
  traceScope.getStore()?.capture.set(key, value);
}

export function getTraceCapture<K extends CaptureKey>(
  key: K,
): CaptureBag[K] | undefined {
  return traceScope.getStore()?.capture.get(key) as CaptureBag[K] | undefined;
}

/** True when an outer `@TraceCommand` (or `runInChildTraceScope`) is
 *  active. Use to gate expensive snapshot work — e.g. extra SELECTs
 *  to populate `displacedRecords` in delete cascade — so they only
 *  run when something will actually consume the capture. */
export function isTraceActive(): boolean {
  return traceScope.getStore()?.active === true;
}

/**
 * Run `fn` inside a fresh child trace scope. Bulk operations use this to
 * isolate per-child captures that would otherwise collide in the outer
 * scope's flat `capture` Map (e.g. `ltar`, `filters` writes from
 * sequentially-called columnAdd children would overwrite each other).
 *
 * Inner `@TraceCommand` decorators see the new scope as active and
 * auto-skip recording (re-entrancy guard) — they just run the method.
 * Child captures land in the returned `bag`; the caller chooses what to
 * persist on the outer entry under per-child keys.
 *
 * The child scope deliberately does NOT inherit `transcript` from the
 * outer — only the IMMEDIATE child of a macro records a transcript
 * entry; deeper nested calls are silent re-entrant skips (matching the
 * single-entry-per-traced-op semantic of sandbox / undo dispatch).
 */
export async function runInChildTraceScope<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; bag: Map<CaptureKey, CaptureBag[CaptureKey]> }> {
  const childBag = new Map<CaptureKey, CaptureBag[CaptureKey]>();
  let result!: T;
  await traceScope.run({ active: true, capture: childBag }, async () => {
    result = await fn();
  });
  return { result, bag: childBag };
}

/**
 * Run `fn` inside an outer trace scope so any nested `@TraceCommand`
 * calls take the silent re-entrant skip branch (no recordCommand,
 * no changelog row). Use for system-driven cleanup paths that fan out
 * to traced services but are not themselves user-initiated, undoable
 * operations — e.g. trash permanent-delete, retention sweeps.
 *
 * Differs from `runInReplay`:
 *  - `isReplay()` stays false → child handlers don't take their replay-
 *    only branches (`forceUpdateSystem`, trash-restore short-circuit,
 *    pre-set id propagation).
 *  - Suppression happens at the decorator's re-entrancy guard, not at
 *    `recordCommand`'s `isReplay()` check, so the contract's `before`
 *    / `skip_if` / replay handler logic never runs.
 *
 * Child captures land in a throwaway map — callers that need captured
 * side-effect ids should use `runInChildTraceScope` instead.
 */
export async function runUntraced<T>(fn: () => Promise<T>): Promise<T> {
  let result!: T;
  await traceScope.run(
    { active: true, capture: new Map<CaptureKey, CaptureBag[CaptureKey]>() },
    async () => {
      result = await fn();
    },
  );
  return result;
}

/**
 * Method decorator equivalent of `runUntraced`. Wraps the decorated
 * method's body in an outer trace scope so any nested `@TraceCommand`
 * calls take the silent re-entrant skip branch. Use on system-driven
 * fan-out entry points (duplicate / snapshot / import processors) that
 * call traced services but are not themselves user-initiated, undoable
 * operations.
 */
export function Untraced() {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      return runUntraced(() => originalMethod.apply(this, args));
    };
    return descriptor;
  };
}

export interface TraceCommandOpts {
  /**
   * Marks the op as a macro — a user-facing action that fans out to
   * multiple traced child ops. The decorator opens a transcript-tracking
   * scope; nested @TraceCommand calls auto-record one MacroTranscriptEntry
   * each. Replay (registered handler) iterates the transcript instead of
   * re-running the service body. Same end-state as today's recordCommand
   * persistence; just one extra `meta.extra.macroTranscript` array.
   */
  macro?: boolean;
}

/**
 * Auto-instrument a re-entrant child call when the outer scope is a
 * macro. Opens a child trace scope (so the child's captureForTrace
 * writes don't collide with sibling children's writes in the outer
 * scope), runs the child's `entry.before`, runs the method, then
 * harvests per-child captures into a transcript entry on the outer.
 *
 * NOT called for non-macro outer scopes — those keep today's silent
 * re-entrant skip behavior (the `originalMethod.apply` fallback).
 */
async function autoInstrumentMacroChild(
  thisArg: any,
  originalMethod: (...args: any[]) => Promise<any>,
  args: any[],
  childContract: OperationContract,
  transcript: MacroTranscriptEntry[],
): Promise<any> {
  const ctx = args[0];
  const param = args[1];
  const childCapture = new Map<CaptureKey, CaptureBag[CaptureKey]>();
  let result: any;
  let resolvedCtx: ResolvedCtx | undefined;

  await traceScope.run({ active: true, capture: childCapture }, async () => {
    const beforeFn = childContract.entry?.before;
    if (beforeFn) {
      try {
        resolvedCtx = await beforeFn(ctx, param);
      } catch (e: any) {
        logger.warn(
          `auto-instrument entry.before ${childContract.name}: ${e?.message}`,
        );
      }
    }
    result = await originalMethod.apply(thisArg, args);
  });

  // Harvest only the keys the child contract opted into via
  // top-level `capture`. Same allowlist that `recordCommand` uses for
  // single-entity ops — ensures the transcript carries exactly what the
  // child's existing replay logic reads via setReplay slots.
  const allowlist = childContract.capture ?? [];
  const extra: Record<string, unknown> = {};
  for (const key of allowlist) {
    const value = childCapture.get(key);
    if (value !== undefined) extra[key] = value;
  }

  const entityId = resolveField(
    childContract.entry?.entity_id ?? 'id',
    param,
    result,
    resolvedCtx,
  );

  const filteredParams = extractReplayableParams(param);
  let validatedParams: unknown = filteredParams;
  try {
    validatedParams = childContract.schema.parse(filteredParams);
  } catch (e: any) {
    // Validation failure shouldn't fail the user-facing op (it already
    // succeeded). Log + persist the raw filtered params so the entry is
    // still recoverable / inspectable.
    logger.warn(
      `auto-instrument schema.parse ${childContract.name}: ${e?.message}`,
    );
  }

  // Persist the child's pre-state snapshot (resolvedCtx.extra) so its
  // `undo.inverse` builder can reconstruct the inverse op when
  // `macroUndo` walks the transcript. Without this, contracts whose
  // inverse reads `resolved.extra.prev` (columnUpdate, viewSectionDelete,
  // etc.) would build no inverse and the macro undo would partial-no-op.
  const resolvedExtra = resolvedCtx?.extra;

  // Suppress empty entries that would offer nothing on replay (e.g. a
  // child whose contract has no entity_id and no captures — rare). Such
  // entries still get a row so transcript order is preserved.
  transcript.push({
    op: childContract.name,
    version: childContract.version ?? 1,
    params: validatedParams,
    ...(Object.keys(extra).length
      ? { extra: extra as Partial<CaptureBag> }
      : {}),
    ...(resolvedExtra !== undefined ? { resolvedExtra } : {}),
    ...(entityId ? { entityId } : {}),
  });

  return result;
}

/**
 * Decorator for state-mutating service methods.
 *
 * Outermost call: opens scope, runs entry.before, runs method, runs
 * skip_if, then `recordCommand` (writes nc_operation_logs +
 * nc_sandbox_changelog rows).
 *
 * Re-entrant call (outer scope already active):
 *  - Macro outer (`outer.transcript` set): auto-instrument — push one
 *    transcript entry, run the method in an isolated child capture
 *    scope. Replay reads the transcript and re-dispatches each entry.
 *  - Non-macro outer: plain re-entrant skip (today's behavior). The
 *    method just runs; no recording.
 */
/**
 * Dynamic op-name resolver — supplies the op name based on the call's
 * (ctx, param) at invocation time. Returns `undefined`/`null` to skip
 * tracing entirely (the method runs unrecorded).
 *
 * Used by services whose single method handles both single-row and
 * bulk shapes (e.g. `dataTableSvc.dataInsert` accepts both an object
 * and an array as `body`); the resolver picks
 * `recordInsert` vs `recordBulkInsert` based on `Array.isArray(body)`.
 */
export type OperationNameResolver = (
  ctx: any,
  param: any,
) => OperationName | undefined | null;

export function TraceCommand(
  name: OperationName | OperationNameResolver,
  version: number = 1,
  opts?: TraceCommandOpts,
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const ctx = args[0];
      const param = args[1];
      const resolvedName: OperationName | undefined | null =
        typeof name === 'function' ? name(ctx, param) : name;
      if (!resolvedName) return originalMethod.apply(this, args);

      const contract = OperationRegistry.contract(resolvedName, version);
      // Early module init before OperationRegistryBootstrap finishes.
      if (!contract) return originalMethod.apply(this, args);

      const outer = traceScope.getStore();
      if (outer) {
        if (outer.transcript) {
          return autoInstrumentMacroChild(
            this,
            originalMethod,
            args,
            contract,
            outer.transcript,
          );
        }
        return originalMethod.apply(this, args);
      }

      const isMacro = contract.macro === true || opts?.macro === true;

      return traceScope.run(
        {
          active: true,
          capture: new Map<CaptureKey, CaptureBag[CaptureKey]>(),
          ...(isMacro ? { transcript: [] as MacroTranscriptEntry[] } : {}),
        },
        async () => {
          let resolvedCtx: ResolvedCtx | undefined;
          const beforeFn = contract.entry?.before;
          if (beforeFn) {
            try {
              resolvedCtx = await beforeFn(ctx, param);
            } catch (e: any) {
              logger.warn(
                `Trace entry.before ${resolvedName}@${version}: ${e.message}`,
              );
            }
          }

          const result = await originalMethod.apply(this, args);

          const skipFn = contract.entry?.skip_if;
          if (skipFn) {
            try {
              if (await skipFn(ctx, param, result, resolvedCtx)) {
                return result;
              }
            } catch (e: any) {
              logger.warn(
                `Trace entry.skip_if ${resolvedName}@${version}: ${e.message}`,
              );
            }
          }

          // Surface the macro transcript so it ends up in BOTH places
          // it needs to be:
          //   1. capture map → recordCommand persists it as
          //      `meta.extra.macroTranscript` on the log row.
          //   2. resolvedCtx.extra → the contract's `undo.inverse`
          //      reads `resolved.extra.macroTranscript` when building
          //      the inverse op (typically `macroUndo` carrying the
          //      transcript). Without this injection, inverseFn sees
          //      whatever entry.before returned (often empty) and
          //      returns null → no undo row written.
          if (isMacro) {
            const scope = traceScope.getStore();
            const transcript = scope?.transcript ?? [];
            if (transcript.length) {
              captureForTrace(
                'macroTranscript',
                transcript as ReadonlyArray<MacroTranscriptEntry>,
              );
            }
            // Inject into resolvedCtx so the inverse builder can see it
            // (resolvedCtx may be undefined if entry.before wasn't
            // defined or returned nothing — synthesize a minimal one).
            resolvedCtx = {
              ...(resolvedCtx ?? {}),
              extra: {
                ...((resolvedCtx?.extra as Record<string, unknown>) ?? {}),
                macroTranscript: transcript,
              },
            };
          }

          // Recording failures must not propagate — user-facing op already succeeded.
          try {
            await recordCommand(ctx, contract, param, result, resolvedCtx);
          } catch (e: any) {
            logger.error(
              `recordCommand ${resolvedName}@${version} failed: ${e?.message}`,
              e?.stack,
            );
          }

          return result;
        },
      );
    };

    return descriptor;
  };
}
