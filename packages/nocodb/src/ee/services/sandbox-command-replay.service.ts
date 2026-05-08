import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import type { SandboxChangelog } from '~/models';
import type { ChangelogCommandPayload } from '~/command-registry/types';
import { OperationRegistry } from '~/command-registry/registry';
import { dispatchOperation } from '~/command-registry/replay-context';

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

    this.logger.log(
      `Replaying ${command.name}@${command.version} (entry: ${entry.id})`,
    );
    return dispatchOperation(targetContext, contract, handler, {
      params: command.params ?? {},
      entityId: entry.entity_id,
      extra: command.extra as Record<string, unknown> | undefined,
      entryId: entry.id,
      createdBy: entry.created_by,
      originalReq,
    });
  }
}
