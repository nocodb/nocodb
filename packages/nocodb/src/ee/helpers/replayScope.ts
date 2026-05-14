import { AsyncLocalStorage } from 'node:async_hooks';
import type { ColumnBackupRef } from '~/services/column-data-backup-handler';
import type { LtarSideEffectIds } from '~/services/columns.service.type';

/**
 * Per-async-tree state shared by per-tab undo/redo dispatch
 * (`undo-redo.service.ts`) and sandbox merge replay
 * (`sandbox-command-replay.service.ts`). Active store presence IS the
 * replay flag (`isReplay()`).
 *
 * Add a slot: declare it on `ReplayBag`, write via `setReplay`, read via
 * `getReplay` — both are typed by `keyof ReplayBag`.
 */

export interface ReplayBag {
  /** `tableCreate` replay: sandbox column title/cn → production-side id. */
  sandboxColumnIds: Record<string, string>;
  /** `tableCreate` replay: sandbox-side default view id, preserved on production. */
  sandboxDefaultViewId: string;
  /** `columnAdd` LTAR replay: junction model + FK + back-link + reverse LTAR ids. */
  ltarReplayIds: LtarSideEffectIds;
  /** Undo of destructive `columnUpdate`: backup ref to restore cell data from. */
  replayBackup: ColumnBackupRef;
  /** Replay of duplicate ops (widget/workflow): id to inject on the destination insert. */
  replayDuplicateId: string;
  /** Forward `columnUpdate` output: fresh backup ref for the handler's `metaUpdate`. */
  columnBackupOut: ColumnBackupRef;
  /** Inverse of `viewSectionDelete`: child view IDs to re-link on undo.
   *  Read-only — values come from the persisted capture, never mutated. */
  viewSectionRestoreViewIds: ReadonlyArray<string>;
  /** `rowColorConditionAdd` replay: inner filter ids in DFS pre-order so
   *  the recreated filter tree keeps its original ids. */
  rowColorFilterIds: ReadonlyArray<string>;
}

const replayScope = new AsyncLocalStorage<{
  bag: Map<keyof ReplayBag, ReplayBag[keyof ReplayBag]>;
}>();

/**
 * Open a replay scope. Nested `runInReplay` opens a separate inner scope —
 * inner reads/writes do NOT affect the outer bag. Handlers that want to
 * layer slots onto the dispatcher's scope should call `setReplay` directly.
 */
export function runInReplay<T>(fn: () => Promise<T>): Promise<T> {
  return replayScope.run({ bag: new Map() }, fn);
}

export function setReplay<K extends keyof ReplayBag>(
  key: K,
  value: ReplayBag[K],
): void {
  replayScope.getStore()?.bag.set(key, value);
}

export function getReplay<K extends keyof ReplayBag>(
  key: K,
): ReplayBag[K] | undefined {
  return replayScope.getStore()?.bag.get(key) as ReplayBag[K] | undefined;
}

export function isReplay(): boolean {
  return replayScope.getStore() !== undefined;
}
