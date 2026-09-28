import {
  captureForTrace,
  getTraceCapture,
} from '~/decorators/trace-command.decorator';
import { getReplay } from '~/helpers/replayScope';

/**
 * View-column join rows are only ever created as a side-effect of a view or
 * column create, so no command owns them and replay cannot preserve their ids
 * the usual way (`sandbox.id_field`). They are instead captured by their
 * natural key and reused when the op is replayed onto another base.
 */
function key(fkViewId?: string, fkColumnId?: string): string | undefined {
  return fkViewId && fkColumnId ? `${fkViewId}::${fkColumnId}` : undefined;
}

export function replayedViewColumnId(
  fkViewId?: string,
  fkColumnId?: string,
): string | undefined {
  const k = key(fkViewId, fkColumnId);
  return k ? getReplay('viewColumnIds')?.[k] : undefined;
}

export function recordViewColumnId(
  fkViewId: string | undefined,
  fkColumnId: string | undefined,
  id: string | undefined,
  collected: Record<string, string>,
): void {
  const k = key(fkViewId, fkColumnId);
  if (k && id) collected[k] = id;
}

export function captureViewColumnIds(collected: Record<string, string>): void {
  if (!Object.keys(collected).length) return;
  // A table create reaches both fan-out sites, so merge rather than overwrite.
  captureForTrace('viewColumnIds', {
    ...(getTraceCapture('viewColumnIds') ?? {}),
    ...collected,
  });
}
