import { z } from 'zod';

/**
 * Schema for a single child entry in a macro op's transcript. The
 * `params` and `extra` fields are validated lazily at replay time
 * against the resolved child contract's `schema` and `sandbox.capture`
 * keys — schema-version drift is caught there with a clean error, not
 * silently corrupted.
 */
export const macroTranscriptEntrySchema = z
  .object({
    op: z.string(),
    version: z.number().int().positive(),
    params: z.unknown(),
    extra: z.record(z.unknown()).optional(),
    /** Snapshot from the child's entry.before's `extra` — opaque here,
     *  typed at the inverse-builder call site. */
    resolvedExtra: z.unknown().optional(),
    entityId: z.string().optional(),
  })
  .strict();

/**
 * Persisted shape of `meta.extra.macroTranscript` — an ordered array of
 * recorded child operations. The macro's registered handler iterates
 * this on replay (undo/redo or sandbox merge).
 */
export const macroTranscriptSchema = z.array(macroTranscriptEntrySchema);

/**
 * Schema for the `macroUndo` primitive's params. `macroUndo` is the
 * inverse-only op dispatched when a macro contract's `undo.inverse`
 * routes through the transcript-walking primitive (used when child
 * inverses are heterogeneous, e.g. `columnsBulk`'s [delete | update |
 * trashRestore] mix).
 */
export const macroUndoSchema = z
  .object({
    transcript: macroTranscriptSchema,
  })
  .strict();
