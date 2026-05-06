import type { ColumnBackupRef } from '~/services/column-data-backup-handler';
import type { LtarSideEffectIds } from '~/services/columns.service.type';

export interface ReplayBag {
  sandboxColumnIds: Record<string, string>;
  sandboxDefaultViewId: string;
  ltarReplayIds: LtarSideEffectIds;
  replayBackup: ColumnBackupRef;
  replayDuplicateId: string;
  columnBackupOut: ColumnBackupRef;
  viewSectionRestoreViewIds: ReadonlyArray<string>;
  rowColorFilterIds: ReadonlyArray<string>;
}

export function runInReplay<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

export function setReplay<K extends keyof ReplayBag>(
  _key: K,
  _value: ReplayBag[K],
): void {
  // no-op in CE
}

export function getReplay<K extends keyof ReplayBag>(
  _key: K,
): ReplayBag[K] | undefined {
  return undefined;
}

export function isReplay(): boolean {
  return false;
}
