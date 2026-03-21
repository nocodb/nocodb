import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { Base, User, Workflow, WorkflowSubscriber, Workspace } from '~/models';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { processConcurrently } from '~/utils';

interface FailedExecutionGroup {
  fk_workflow_id: string;
  fk_workspace_id: string;
  base_id: string;
  failure_count: number;
  first_failure: string;
  last_failure: string;
  last_failure_id?: string;
}

@Injectable()
export class WorkflowErrorNotificationProcessor {
  private logger = new Logger(WorkflowErrorNotificationProcessor.name);

  constructor(private readonly mailService: MailService) {}

  async job() {
    this.logger.log('WorkflowErrorNotificationProcessor job started');

    const ncMeta = Noco.ncMeta;

    const cutoffTime = dayjs().subtract(5, 'minutes').toISOString();

    // Query to get grouped failed executions where the LAST error is older than 5 minutes
    // This ensures we wait for a "quiet period" before sending notification (debounce)
    const failedGroups: FailedExecutionGroup[] = await ncMeta.knexConnection
      .select('fk_workflow_id', 'fk_workspace_id', 'base_id')
      .count('* as failure_count')
      .min('finished_at as first_failure')
      .max('finished_at as last_failure')
      .from(MetaTable.AUTOMATION_EXECUTIONS)
      .where('status', 'error')
      .whereNull('error_notified_at')
      .groupBy('fk_workflow_id', 'fk_workspace_id', 'base_id')
      .having(ncMeta.knexConnection.raw('MAX(finished_at) < ?', [cutoffTime]))
      .limit(50);

    if (failedGroups.length === 0) {
      this.logger.debug('No failed executions to notify');
      return;
    }

    // Get the last failure ID for each group in a single query using DISTINCT ON (PostgreSQL)
    // or a subquery approach for cross-database compatibility
    const workflowIds = failedGroups.map((g) => g.fk_workflow_id);
    const lastFailures = await ncMeta
      .knexConnection(MetaTable.AUTOMATION_EXECUTIONS)
      .select('id', 'fk_workflow_id', 'base_id')
      .where('status', 'error')
      .whereNull('error_notified_at')
      .where('finished_at', '<', cutoffTime)
      .whereIn('fk_workflow_id', workflowIds)
      .orderBy('finished_at', 'desc');

    // Create a map for quick lookup (first occurrence per workflow is the latest due to ORDER BY)
    const lastFailureMap = new Map<string, string>();
    for (const row of lastFailures) {
      const key = `${row.fk_workflow_id}:${row.base_id}`;
      if (!lastFailureMap.has(key)) {
        lastFailureMap.set(key, row.id);
      }
    }

    // Assign last_failure_id to each group
    for (const group of failedGroups) {
      const key = `${group.fk_workflow_id}:${group.base_id}`;
      group.last_failure_id = lastFailureMap.get(key);
    }

    this.logger.debug(
      `Found ${failedGroups.length} workflows with failed executions`,
    );

    for (const group of failedGroups) {
      try {
        const context = {
          workspace_id: group.fk_workspace_id,
          base_id: group.base_id,
        };

        const workflow = await Workflow.get(context, group.fk_workflow_id);
        if (!workflow) {
          this.logger.warn(
            `Workflow ${group.fk_workflow_id} not found, skipping`,
          );
          await this.markAsNotified(group, cutoffTime);
          continue;
        }

        const subscribers = await WorkflowSubscriber.getErrorSubscribers(
          context,
          group.fk_workflow_id,
        );

        if (subscribers.length === 0) {
          this.logger.debug(
            `No subscribers for workflow ${group.fk_workflow_id}, marking as notified`,
          );
          await this.markAsNotified(group, cutoffTime);
          continue;
        }

        const workspace = await Workspace.get(group.fk_workspace_id);
        const base = await Base.get(context, group.base_id);

        // Get user emails for subscribers
        const userIds = subscribers.map((s) => s.fk_user_id);
        const users = await processConcurrently(userIds, (userId) =>
          User.get(userId),
        );
        const validUsers = users.filter((u) => u?.email);

        if (validUsers.length === 0) {
          this.logger.debug(
            `No valid user emails for workflow ${group.fk_workflow_id}, marking as notified`,
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
              mailEvent: MailEvent.WORKFLOW_ERROR_DIGEST,
              payload: {
                user,
                workflow: {
                  id: group.fk_workflow_id,
                  title: workflow.title,
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
                lastFailureId: group.last_failure_id,
                workspaceId: group.fk_workspace_id,
              },
            });

            this.logger.debug(
              `Sent error digest email to ${user.email} for workflow ${workflow.title}`,
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
          `Failed to process error notifications for workflow ${group.fk_workflow_id}:`,
          error,
        );
      }
    }

    this.logger.debug('WorkflowErrorNotificationProcessor job completed');
  }

  private async markAsNotified(
    group: FailedExecutionGroup,
    cutoffTime: string,
  ) {
    const ncMeta = Noco.ncMeta;

    await ncMeta
      .knexConnection(MetaTable.AUTOMATION_EXECUTIONS)
      .where('fk_workflow_id', group.fk_workflow_id)
      .where('base_id', group.base_id)
      .where('status', 'error')
      .whereNull('error_notified_at')
      .where('finished_at', '<', cutoffTime)
      .update({
        error_notified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    this.logger.debug(
      `Marked ${group.failure_count} executions as notified for workflow ${group.fk_workflow_id}`,
    );
  }
}
