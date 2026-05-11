import { Logger } from '@nestjs/common';
import type {
  MacroTranscriptEntry,
  OperationContract,
} from '~/command-registry/types';
import { getUndoConfig } from '~/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import {
  dispatchTranscriptEntry,
  makeReplayReq,
} from '~/command-registry/replay-context';
import { MetaTable } from '~/utils/globals';
import { macroUndoSchema } from '~/command-registry/operations/_schemas/macro';

const logger = new Logger('MacroUndo');

/**
 * Inverse-only primitive that walks a macro op's recorded transcript
 * IN REVERSE and dispatches each child's `undo.inverse` via the
 * registry. Used as the `undo.inverse` target for macro ops whose
 * children require heterogeneous inverses (e.g. `columnsBulk` whose
 * children mix add/update/delete and need three different inverse op
 * names).
 *
 * Macros whose inverse cascades cleanly via a single top-level op (e.g.
 * `duplicateTable` → `tableDelete` cascades, `viewSectionDelete` →
 * `viewSectionCreate` re-creates with re-linked views) don't need
 * `macroUndo`; they wire `undo.inverse` to that single op directly.
 *
 * macroUndo itself is NOT macro — it's a flat primitive. Its handler
 * runs entries in reverse order so deletes precede inverse-creates,
 * symmetric with the forward order.
 */
export const MacroUndoContract: OperationContract<typeof macroUndoSchema> = {
  name: OperationName.macroUndo,
  entity: MetaTable.MODELS,
  schema: macroUndoSchema,
  entry: {
    description: () => 'Undo bulk operation',
  },
};

export function registerMacroHandlers(): void {
  OperationRegistry.register(
    MacroUndoContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      const liveTranscript = (
        meta.extra as
          | { macroTranscript?: ReadonlyArray<MacroTranscriptEntry> }
          | undefined
      )?.macroTranscript;
      const transcript: ReadonlyArray<MacroTranscriptEntry> =
        liveTranscript && liveTranscript.length
          ? liveTranscript
          : (params.transcript as ReadonlyArray<MacroTranscriptEntry>);

      const updatedTranscript: MacroTranscriptEntry[] = transcript.slice();
      let anyMetaUpdate = false;

      for (let i = transcript.length - 1; i >= 0; i--) {
        const entry = transcript[i];
        const resolved = OperationRegistry.resolve(
          entry.op as any,
          entry.version,
        );
        if (!resolved) {
          logger.warn(
            `macroUndo: child contract '${entry.op}@${entry.version}' not found, skipping`,
          );
          continue;
        }
        const inverseFn = getUndoConfig(resolved.contract)?.inverse;
        if (!inverseFn) {
          logger.warn(
            `macroUndo: child '${entry.op}' has no undo.inverse, skipping`,
          );
          continue;
        }

        let inverseOp;
        try {
          inverseOp = await inverseFn(
            context,
            entry.params as any,
            undefined,
            // The child's inverse builder reads from `resolved.extra` —
            // that's the contract's E-generic, populated by entry.before
            // at forward time and persisted as `entry.resolvedExtra`.
            // (Side-effect captures from CaptureBag live in entry.extra
            // and are not what the inverse builder typically reads.)
            { extra: entry.resolvedExtra as Record<string, any> | undefined },
          );
        } catch (e: any) {
          logger.warn(
            `macroUndo: inverse builder for '${entry.op}' threw: ${e?.message}`,
          );
          continue;
        }
        if (!inverseOp) continue;

        try {
          // Pass the entry's CURRENT extra (CaptureBag captures —
          // ltar / backup / filters / etc.) through to the inverse
          // dispatch. The child handler reads them via setReplay so
          // the inverse uses the right ids / backup refs.
          const childResult = await dispatchTranscriptEntry(
            context,
            {
              op: inverseOp.name,
              version: inverseOp.version ?? 1,
              params: inverseOp.params,
              extra: entry.extra,
              entityId: entry.entityId,
            },
            req,
          );
          // Some child handlers (columnUpdate on type-change) return
          // `{ result, metaUpdate: { backup: newBackup } }` to rotate
          // state for the next cycle. Merge into this entry's extra so
          // the persisted transcript carries it forward.
          const update =
            childResult &&
            typeof childResult === 'object' &&
            'metaUpdate' in childResult
              ? (childResult as { metaUpdate?: Record<string, unknown> })
                  .metaUpdate
              : undefined;
          if (update) {
            updatedTranscript[i] = {
              ...entry,
              extra: {
                ...(entry.extra ?? {}),
                ...update,
              } as MacroTranscriptEntry['extra'],
            };
            anyMetaUpdate = true;
          }
        } catch (e: any) {
          logger.warn(
            `macroUndo: dispatch of '${inverseOp.name}' for '${entry.op}' failed: ${e?.message}`,
          );
          // Continue — best-effort partial undo.
        }
      }

      if (anyMetaUpdate) {
        // Persist the rotated transcript back to the FORWARD entry's
        // meta. UndoRedoService merges this into `entry.meta` so the
        // next redo (and the next undo after that) reads the latest
        // child state from `meta.extra.macroTranscript`.
        return {
          metaUpdate: { macroTranscript: updatedTranscript },
        };
      }
      return undefined;
    },
  );
}
