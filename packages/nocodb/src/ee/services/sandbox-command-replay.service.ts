import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import type { SandboxChangelog } from '~/models';
import type {
  ChangelogCommandPayload,
  HandlerMeta,
} from '~/command-registry/types';
import { OperationRegistry } from '~/command-registry/registry';
import { makeReplayReq } from '~/command-registry/replay-context';
import { runInReplay } from '~/helpers/replayScope';

@Injectable()
export class SandboxCommandReplayService {
  private readonly logger = new Logger(SandboxCommandReplayService.name);

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

    const registration = OperationRegistry.resolve(
      command.name,
      command.version,
    );
    if (!registration) {
      this.logger.warn(
        `No handler for '${command.name}@${command.version}' — skipping entry ${entry.id}`,
      );
      return null;
    }

    const { contract, handler } = registration;
    const req = makeReplayReq(originalReq, entry.created_by);

    const replayParams: Record<string, any> = {
      ...((command.params as Record<string, any> | null) ?? {}),
      user: req.user,
      req,
    };

    if (replayParams.baseId) {
      replayParams.baseId = targetContext.base_id;
    }

    // Inject sandbox entity_id into the create body so production preserves it.
    const idField = contract.sandbox?.id_field;
    if (
      idField &&
      entry.entity_id &&
      replayParams[idField] &&
      typeof replayParams[idField] === 'object'
    ) {
      replayParams[idField] = {
        ...replayParams[idField],
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

    this.logger.log(
      `Replaying ${command.name}@${command.version} (entry: ${entry.id})`,
    );
    return runInReplay(() => handler(targetContext, replayParams, handlerMeta));
  }
}
