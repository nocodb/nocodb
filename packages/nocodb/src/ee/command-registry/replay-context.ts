import { Logger } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  CommandHandler,
  HandlerMeta,
  MacroTranscriptEntry,
  OperationContract,
} from '~/command-registry/types';
import { getSandboxConfig } from '~/command-registry/types';
import { OperationRegistry } from '~/command-registry/registry';
import { isReplay, runInReplay } from '~/helpers/replayScope';

const logger = new Logger('ReplayContext');

// `createdBy` is the fallback when originalReq has no user.
export function makeReplayReq(
  originalReq: NcRequest,
  createdBy: string,
): NcRequest {
  return {
    ...originalReq,
    user: originalReq?.user ?? { id: createdBy },
  } as NcRequest;
}

export function registerForward<C extends OperationContract<any>>(
  contract: C,
  forward: (context: NcContext, params: any) => Promise<unknown>,
): void {
  OperationRegistry.register(contract, async (context, params, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);
    return forward(context, { ...params, req });
  });
}

/**
 * Normalised input to the shared replay dispatcher. Each call site
 * (sandbox merge, per-tab undo/redo, macro child) projects its own row
 * shape onto this struct.
 */
export interface ReplayCall {
  params: any;
  entityId?: string;
  extra?: Record<string, unknown>;
  entryId: string;
  createdBy: string;
  originalReq: NcRequest;
}

/**
 * Single source of truth for replay-time param transformation +
 * handler invocation. Call sites: `SandboxCommandReplayService`,
 * `UndoRedoService.dispatch`, `dispatchTranscriptEntry`.
 *
 * `baseId` rewrite is a no-op for undo/redo (same base); load-bearing
 * for sandbox merge (sandbox → prod). The id_field injection lets
 * model insert paths preserve the recorded id via `isReplay() &&
 * entity.id`.
 */
export async function dispatchOperation(
  context: NcContext,
  contract: OperationContract,
  handler: CommandHandler,
  call: ReplayCall,
): Promise<unknown> {
  contract.schema.parse(call.params ?? {});

  const req = makeReplayReq(call.originalReq, call.createdBy);

  const replayParams: Record<string, any> = {
    ...((call.params as Record<string, any> | null) ?? {}),
    user: req.user,
    req,
  };

  if (replayParams.baseId) {
    replayParams.baseId = context.base_id;
  }

  const idField = getSandboxConfig(contract)?.id_field;
  if (
    idField &&
    call.entityId &&
    replayParams[idField] &&
    typeof replayParams[idField] === 'object'
  ) {
    replayParams[idField] = {
      ...replayParams[idField],
      id: call.entityId,
    };
  }

  const handlerMeta: HandlerMeta = {
    entryId: call.entryId,
    entityId: call.entityId,
    originalReq: call.originalReq,
    createdBy: call.createdBy,
    extra: call.extra,
  };

  return runInReplay(() => handler(context, replayParams, handlerMeta));
}

/**
 * Re-invoke a recorded macro child entry. Schema re-validation happens
 * inside `dispatchOperation`.
 *
 * Handlers that rotate state across replay cycles (e.g. `columnUpdate`'s
 * backup pointer) return `{ result, metaUpdate }`; macro callers
 * propagate `metaUpdate` back into the entry's `extra` so the next
 * cycle reads the latest values.
 */
export async function dispatchTranscriptEntry(
  context: NcContext,
  entry: MacroTranscriptEntry,
  req: NcRequest,
): Promise<unknown> {
  const resolved = OperationRegistry.resolve(entry.op as any, entry.version);
  if (!resolved) {
    throw new Error(
      `Macro transcript entry references unknown op '${entry.op}@${entry.version}'`,
    );
  }
  const { contract, handler } = resolved;

  return dispatchOperation(context, contract, handler, {
    params: entry.params,
    entityId: entry.entityId,
    extra: entry.extra as Record<string, unknown> | undefined,
    entryId: 'macro-child',
    createdBy: req.user?.id ?? '',
    originalReq: req,
  });
}

function extractMetaUpdate(
  handlerResult: unknown,
): Record<string, unknown> | undefined {
  if (
    handlerResult &&
    typeof handlerResult === 'object' &&
    'metaUpdate' in handlerResult
  ) {
    const update = (handlerResult as { metaUpdate?: unknown }).metaUpdate;
    if (update && typeof update === 'object') {
      return update as Record<string, unknown>;
    }
  }
  return undefined;
}

/**
 * Register a macro op's handler. On forward, runs `forwardCall`; the
 * decorator's macro mode auto-records each nested child call into
 * `meta.extra.macroTranscript`. On replay (`isReplay()` with transcript
 * in `meta.extra`), walks the transcript and re-dispatches each entry
 * — the transcript IS the program; the service body is never re-run.
 */
export function registerMacro<C extends OperationContract<any>>(
  contract: C,
  forwardCall: (
    context: NcContext,
    params: any,
    req: NcRequest,
  ) => Promise<unknown>,
): void {
  OperationRegistry.register(contract, async (context, params, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);
    const transcript = (
      meta.extra as { macroTranscript?: MacroTranscriptEntry[] } | undefined
    )?.macroTranscript;

    if (isReplay() && transcript && transcript.length) {
      // Children that rotate state across cycles (e.g. columnUpdate's
      // backup pointer) return a metaUpdate that needs merging back
      // into the persisted transcript. Per-child failures are warned
      // and skipped — partial replay beats none.
      const updatedTranscript: MacroTranscriptEntry[] = [];
      let lastResult: unknown;
      let anyMetaUpdate = false;
      for (const entry of transcript) {
        try {
          const childResult = await dispatchTranscriptEntry(
            context,
            entry,
            req,
          );
          lastResult = childResult;
          const update = extractMetaUpdate(childResult);
          if (update) {
            updatedTranscript.push({
              ...entry,
              extra: {
                ...(entry.extra ?? {}),
                ...update,
              } as MacroTranscriptEntry['extra'],
            });
            anyMetaUpdate = true;
          } else {
            updatedTranscript.push(entry);
          }
        } catch (e: any) {
          logger.warn(
            `Macro replay '${contract.name}' child '${entry.op}@${entry.version}' failed: ${e?.message}`,
          );
          updatedTranscript.push(entry);
        }
      }
      if (anyMetaUpdate) {
        return {
          result: lastResult,
          metaUpdate: { macroTranscript: updatedTranscript },
        };
      }
      return lastResult;
    }

    return forwardCall(context, params, req);
  });
}
