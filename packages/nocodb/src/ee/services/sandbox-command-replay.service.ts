import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import type { SandboxChangelog } from '~/models';
import type { ChangelogCommandPayload, HandlerMeta } from '~/command-registry/_types';
import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';

@Injectable()
export class SandboxCommandReplayService {
  private readonly logger = new Logger(SandboxCommandReplayService.name);

  /**
   * Replay a single changelog entry against the target production context.
   * Resolves the registered handler via OperationRegistry, builds a synthetic
   * NcRequest to suppress re-recording and audit, then invokes the handler.
   */
  async replayCommand(
    targetContext: NcContext,
    entry: SandboxChangelog,
    originalReq: NcRequest,
  ): Promise<any> {
    const meta =
      typeof entry.meta === 'string' ? JSON.parse(entry.meta) : entry.meta;
    const command = meta?.command as ChangelogCommandPayload | undefined;

    if (!command?.name || command.version == null) {
      this.logger.warn(
        `Changelog entry ${entry.id} has no command data, skipping`,
      );
      return null;
    }

    const registration = OperationRegistry.resolve(command.name, command.version);
    if (!registration) {
      this.logger.warn(
        `No handler for '${command.name}@${command.version}' — skipping entry ${entry.id}`,
      );
      return null;
    }

    const { contract, handler } = registration;
    const req = makeReplayReq(originalReq, entry.created_by);

    const replayParams: Record<string, any> = {
      ...(command.params as Record<string, any> | null ?? {}),
      user: req.user,
      req,
    };

    if (replayParams.baseId) {
      replayParams.baseId = targetContext.base_id;
    }

    // For create operations: inject the sandbox entity ID so the production
    // entity gets the same ID (metaInsert2 preserves pre-set IDs).
    if (
      contract.idField &&
      entry.entity_id &&
      replayParams[contract.idField] &&
      typeof replayParams[contract.idField] === 'object'
    ) {
      replayParams[contract.idField] = {
        ...replayParams[contract.idField],
        id: entry.entity_id,
      };
    }

    const handlerMeta: HandlerMeta = {
      entryId: entry.id,
      entityId: entry.entity_id,
      originalReq,
      createdBy: entry.created_by,
      extra: command.extra as Record<string, unknown> | undefined,
    };

    // Mark context as replay so assertNotSandboxProduction guards are bypassed.
    const replayContext: NcContext = {
      ...targetContext,
      additionalContext: {
        ...targetContext.additionalContext,
        is_replay: true,
      },
    };

    this.logger.log(
      `Replaying ${command.name}@${command.version} (entry: ${entry.id})`,
    );
    return handler(replayContext, replayParams, handlerMeta);
  }
}
