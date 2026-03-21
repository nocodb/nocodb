import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { Base, Hook, Model, User, WorkflowSubscriber, Workspace } from '~/models';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { processConcurrently } from '~/utils';

interface FailedHookLogGroup {
  fk_hook_id: string;
  fk_workspace_id: string;
  base_id: string;
  failure_count: number;
  first_failure: string;
  last_failure: string;
}

@Injectable()
export class HookErrorNotificationProcessor {
  private logger = new Logger(HookErrorNotificationProcessor.name);

  constructor(private readonly mailService: MailService) {}

  async job() {
    this.logger.log('HookErrorNotificationProcessor job started');

    const ncMeta = Noco.ncMeta;

    const cutoffTime = dayjs().subtract(5, 'minutes').toISOString();

    // Query to get grouped failed hook logs where the LAST error is older than 5 minutes
    // This ensures we wait for a "quiet period" before sending notification (debounce)
    const failedGroups: FailedHookLogGroup[] = await ncMeta.knexConnection
      .select('fk_hook_id', 'fk_workspace_id', 'base_id')
      .count('* as failure_count')
      .min('created_at as first_failure')
      .max('created_at as last_failure')
      .from(MetaTable.HOOK_LOGS)
      .whereNotNull('error')
      .whereNull('error_notified_at')
      .groupBy('fk_hook_id', 'fk_workspace_id', 'base_id')
      .having(ncMeta.knexConnection.raw('MAX(created_at) < ?', [cutoffTime]))
      .limit(50);

    if (failedGroups.length === 0) {
      this.logger.debug('No failed hook logs to notify');
      return;
    }

    this.logger.debug(
      `Found ${failedGroups.length} hooks with failed executions`,
    );

    for (const group of failedGroups) {
      try {
        const context = {
          workspace_id: group.fk_workspace_id,
          base_id: group.base_id,
        };

        const hook = await Hook.get(context, group.fk_hook_id);
        if (!hook) {
          this.logger.warn(`Hook ${group.fk_hook_id} not found, skipping`);
          await this.markAsNotified(group, cutoffTime);
          continue;
        }

        const subscribers = await WorkflowSubscriber.getErrorSubscribers(
          context,
          group.fk_hook_id,
        );

        if (subscribers.length === 0) {
          this.logger.debug(
            `No subscribers for hook ${group.fk_hook_id}, marking as notified`,
          );
          await this.markAsNotified(group, cutoffTime);
          continue;
        }

        const workspace = await Workspace.get(group.fk_workspace_id);
        const base = await Base.get(context, group.base_id);

        // Get table info for the hook
        const table = hook.fk_model_id
          ? await Model.get(context, hook.fk_model_id)
          : null;

        // Get user emails for subscribers
        const userIds = subscribers.map((s) => s.fk_user_id);
        const users = await processConcurrently(userIds, (userId) =>
          User.get(userId),
        );
        const validUsers = users.filter((u) => u?.email);

        if (validUsers.length === 0) {
          this.logger.debug(
            `No valid user emails for hook ${group.fk_hook_id}, marking as notified`,
          );
          await this.markAsNotified(group, cutoffTime);
          continue;
        }

        // Format time range
        const firstFailure = dayjs(group.first_failure);
        const lastFailure = dayjs(group.last_failure);

        // Send email to each subscriber
        for (const user of validUsers) {
          try {
            await this.mailService.sendMail({
              mailEvent: MailEvent.HOOK_ERROR_DIGEST,
              payload: {
                req: undefined,
                user,
                hook: {
                  id: group.fk_hook_id,
                  title: hook.title,
                },
                table: {
                  id: table?.id || '',
                  title: table?.title || 'Unknown Table',
                },
                workspace: {
                  id: group.fk_workspace_id,
                  title: workspace?.title || 'Workspace',
                },
                base: {
                  id: group.base_id,
                  title: base?.title || 'Base',
                },
                failureCount: Number(group.failure_count),
                firstFailureTime: firstFailure.format(
                  'MM/DD/YYYY [at] h:mm A [UTC]',
                ),
                lastFailureTime: lastFailure.format(
                  'MM/DD/YYYY [at] h:mm A [UTC]',
                ),
                workspaceId: group.fk_workspace_id,
              },
            });

            this.logger.debug(
              `Sent error digest email to ${user.email} for hook ${hook.title}`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to send error digest email to ${user.email}:`,
              error,
            );
          }
        }

        await this.markAsNotified(group, cutoffTime);
      } catch (error) {
        this.logger.error(
          `Failed to process error notifications for hook ${group.fk_hook_id}:`,
          error,
        );
      }
    }

    this.logger.debug('HookErrorNotificationProcessor job completed');
  }

  private async markAsNotified(group: FailedHookLogGroup, cutoffTime: string) {
    const ncMeta = Noco.ncMeta;

    await ncMeta
      .knexConnection(MetaTable.HOOK_LOGS)
      .where('fk_hook_id', group.fk_hook_id)
      .where('base_id', group.base_id)
      .whereNotNull('error')
      .whereNull('error_notified_at')
      .where('created_at', '<', cutoffTime)
      .update({
        error_notified_at: new Date().toISOString(),
      });

    this.logger.debug(
      `Marked ${group.failure_count} hook logs as notified for hook ${group.fk_hook_id}`,
    );
  }
}
