import { Injectable, Logger } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { NcContext } from '~/interface/config';
import type { SandboxMergeJobData } from '~/interface/Jobs';
import { Base, Sandbox, SandboxChangelog } from '~/models';
import { NcError } from '~/helpers/catchError';
import NocoSocket from '~/socket/NocoSocket';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { SandboxCommandReplayService } from '~/services/sandbox-command-replay.service';
import {
  expandSelectedEntries,
  validateCommandSequence,
} from '~/helpers/sandboxCherryPick';

function isUniqueViolation(e: any): boolean {
  return e?.code === '23505';
}

function isDuplicateColumn(e: any): boolean {
  return e?.code === '42701';
}

@Injectable()
export class SandboxMergeProcessor {
  private readonly logger = new Logger(SandboxMergeProcessor.name);

  constructor(
    private readonly appHooksService: AppHooksService,
    private readonly replayService: SandboxCommandReplayService,
  ) {}

  async process(job: Job<SandboxMergeJobData>) {
    const {
      context,
      sandboxBaseId,
      masterBaseId,
      sandboxId,
      req,
      selectedChangelogIds,
    } = job.data;

    const sandbox = await Sandbox.get(sandboxId);
    if (!sandbox) {
      NcError._.genericNotFound('Sandbox', sandboxId);
    }

    const base = await Base.get(context, sandboxBaseId);
    if (!base) {
      NcError._.genericNotFound('Base', sandboxBaseId);
    }

    const masterBase = await Base.get(context, masterBaseId);
    if (!masterBase) {
      NcError._.genericNotFound('Base', masterBaseId);
    }

    const masterContext: NcContext = { ...context, base_id: masterBase.id };
    const sandboxContext: NcContext = { ...context, base_id: base.id };

    // Load changelog entries (all or selected with dependency expansion)
    const allEntries = await SandboxChangelog.listBySandboxId(sandboxId, {
      excludeMerged: true,
    });

    let entries = allEntries;
    if (selectedChangelogIds?.length) {
      // Expand selection to include required parent dependencies
      const expandedIds = expandSelectedEntries(
        allEntries,
        new Set(selectedChangelogIds),
      );
      entries = allEntries.filter((e) => expandedIds.has(e.id));

      // Validate the command sequence
      const errors = validateCommandSequence(entries);
      if (errors.length) {
        this.logger.warn(
          `Cherry-pick validation warnings: ${errors.join('; ')}`,
        );
      }
    }

    if (!entries.length) {
      this.logger.log('No changelog entries to replay');
      return { success: true };
    }

    this.logger.log(
      `Replaying ${entries.length} command(s) from sandbox ${sandboxId} to master ${masterBaseId}`,
    );

    // Replay each command sequentially through the service layer
    for (const entry of entries) {
      try {
        await this.replayService.replayCommand(masterContext, entry, req);
        await SandboxChangelog.markAsMerged([entry.id]);
      } catch (e: any) {
        if (isUniqueViolation(e) || isDuplicateColumn(e)) {
          this.logger.warn(
            `Idempotency conflict for ${entry.event} (entry: ${entry.id}), skipping: ${e.message}`,
          );
          await SandboxChangelog.markAsSkipped(entry.id);
          continue;
        }
        this.logger.error(
          `Failed to replay ${entry.event} (entry: ${entry.id}): ${e.message}`,
          e.stack,
        );
        await SandboxChangelog.markAsFailed(entry.id);
        throw e;
      }
    }

    this.appHooksService.emit(AppEvents.SANDBOX_MERGE, {
      context,
      sandboxId: sandbox.id,
      baseId: sandbox.sandbox_base_id,
      masterBaseId: sandbox.master_base_id,
      req,
    });

    // Notify sandbox base users so their UI refreshes after merge
    NocoSocket.broadcastEventToBaseUsers(
      sandboxContext,
      {
        event: EventType.USER_EVENT,
        payload: {
          action: 'base_meta_reload',
          payload: {
            base_id: sandbox.sandbox_base_id,
          },
        },
      },
      req?.context?.socket_id,
    );

    // Notify master base users — merge modifies master schema
    NocoSocket.broadcastEventToBaseUsers(
      masterContext,
      {
        event: EventType.USER_EVENT,
        payload: {
          action: 'base_meta_reload',
          payload: {
            base_id: sandbox.master_base_id,
          },
        },
      },
      req?.context?.socket_id,
    );

    return { success: true };
  }
}
