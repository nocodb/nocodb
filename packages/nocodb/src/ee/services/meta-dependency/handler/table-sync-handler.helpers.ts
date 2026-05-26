import {
  EventType,
  NOCO_SERVICE_USERS,
  ServiceUserType,
  TableSyncStatus,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { NocoJobsService } from '~/services/noco-jobs.service';
import type TableSync from '~/models/TableSync';
import { JobTypes } from '~/interface/Jobs';
import NocoSocket from '~/socket/NocoSocket';

const HANDLER_RESYNC_DEBOUNCE_MS = 5_000;

export function buildSyncServiceReq(destContext: NcContext) {
  return {
    context: destContext,
    user: NOCO_SERVICE_USERS[ServiceUserType.SYNC_USER],
    ncWorkspaceId: destContext.workspace_id,
    ncBaseId: destContext.base_id,
    ncSiteUrl: '',
    dashboardUrl: '',
    headers: {},
    query: {},
    body: {},
    params: {},
  } as any;
}

/** Enqueue a debounced full-resync triggered by any source-side meta
 *  event (column add/change, filter change, etc.). One jobId per sync so
 *  bursts of edits across different event types coalesce into a single
 *  resync. Skips if the sync isn't Active (Paused / Error syncs don't
 *  pick up reactive resyncs). Also broadcasts a `table_sync_update` so
 *  the UI flips to "Syncing" without waiting for the worker. */
export async function scheduleReactiveResync(
  nocoJobsService: NocoJobsService,
  destContext: NcContext,
  sync: TableSync,
): Promise<void> {
  if (sync.status !== TableSyncStatus.Active) return;

  const jobId = `tableSync:${sync.id}:resync`;

  const existing = await nocoJobsService.getJob(jobId);
  if (existing) {
    try {
      await existing.remove();
    } catch {
      // Race with prior job picking up — next enqueue will dedupe.
      return;
    }
  }

  await nocoJobsService.add(
    JobTypes.TableSyncRun,
    {
      context: destContext,
      syncId: sync.id,
      mode: 'full-resync',
      req: buildSyncServiceReq(destContext),
    },
    {
      jobId,
      delay: HANDLER_RESYNC_DEBOUNCE_MS,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );

  NocoSocket.broadcastEvent(destContext, {
    event: EventType.META_EVENT,
    payload: {
      action: 'table_sync_update',
      payload: { id: sync.id, base_id: destContext.base_id },
    },
  });
}
