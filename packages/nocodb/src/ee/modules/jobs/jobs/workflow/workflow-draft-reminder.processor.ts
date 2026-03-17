import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { hasWorkflowDraftChanges } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { User, Workflow, Workspace } from '~/models';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';

interface StaleWorkflowDraft {
  id: string;
  fk_workspace_id: string;
  base_id: string;
  updated_by: string;
  created_by: string;
  updated_at: string;
}

@Injectable()
export class WorkflowDraftReminderProcessor {
  private logger = new Logger(WorkflowDraftReminderProcessor.name);

  constructor(private readonly mailService: MailService) {}

  async job() {
    this.logger.log('WorkflowDraftReminderProcessor job started');

    const ncMeta = Noco.ncMeta;

    const cutoffTime = dayjs().subtract(3, 'days').toISOString();

    // Find workflows with non-null draft that haven't been updated in 3+ days
    // and either never reminded or reminded before the last update
    const staleWorkflows: StaleWorkflowDraft[] = await ncMeta.knexConnection
      .select(
        'id',
        'fk_workspace_id',
        'base_id',
        'updated_by',
        'created_by',
        'updated_at',
      )
      .from(MetaTable.AUTOMATIONS)
      .whereNotNull('draft')
      .where('updated_at', '<', cutoffTime)
      .andWhere((builder) => {
        builder
          .whereNull('draft_reminder_sent_at')
          .orWhereRaw('draft_reminder_sent_at < updated_at');
      })
      .limit(50);

    if (staleWorkflows.length === 0) {
      this.logger.debug('No stale workflow drafts to remind');
      return;
    }

    this.logger.debug(
      `Found ${staleWorkflows.length} workflows with stale drafts`,
    );

    for (const staleWorkflow of staleWorkflows) {
      try {
        const context = {
          workspace_id: staleWorkflow.fk_workspace_id,
          base_id: staleWorkflow.base_id,
        };

        const workflow = await Workflow.get(context, staleWorkflow.id);
        if (!workflow) {
          this.logger.warn(`Workflow ${staleWorkflow.id} not found, skipping`);
          await this.markAsReminded(staleWorkflow.id);
          continue;
        }

        // Verify draft actually has meaningful changes
        if (!hasWorkflowDraftChanges(workflow)) {
          this.logger.debug(
            `Workflow ${staleWorkflow.id} draft has no real changes, skipping`,
          );
          await this.markAsReminded(staleWorkflow.id);
          continue;
        }

        // Send to the user who last edited, fall back to creator
        const targetUserId =
          staleWorkflow.updated_by || staleWorkflow.created_by;
        if (!targetUserId) {
          this.logger.debug(
            `No user to notify for workflow ${staleWorkflow.id}, skipping`,
          );
          await this.markAsReminded(staleWorkflow.id);
          continue;
        }

        const user = await User.get(targetUserId);
        if (!user?.email) {
          this.logger.debug(
            `No valid email for user ${targetUserId}, skipping`,
          );
          await this.markAsReminded(staleWorkflow.id);
          continue;
        }

        const workspace = await Workspace.get(staleWorkflow.fk_workspace_id);

        const draftAge = dayjs().diff(dayjs(staleWorkflow.updated_at), 'day');

        await this.mailService.sendMail({
          mailEvent: MailEvent.WORKFLOW_DRAFT_REMINDER,
          payload: {
            user,
            workflow: {
              id: workflow.id,
              title: workflow.title,
            },
            workspace: {
              id: staleWorkflow.fk_workspace_id,
              title: workspace?.title,
            },
            draftAgeDays: draftAge,
            baseId: staleWorkflow.base_id,
            workspaceId: staleWorkflow.fk_workspace_id,
          },
        });

        this.logger.debug(
          `Sent draft reminder email to ${user.email} for workflow ${workflow.title}`,
        );

        await this.markAsReminded(staleWorkflow.id);
      } catch (error) {
        this.logger.error(
          `Failed to process draft reminder for workflow ${staleWorkflow.id}: ${error?.message}`,
          error?.stack,
        );
      }
    }

    this.logger.debug('WorkflowDraftReminderProcessor job completed');
  }

  private async markAsReminded(workflowId: string) {
    const ncMeta = Noco.ncMeta;

    await ncMeta
      .knexConnection(MetaTable.AUTOMATIONS)
      .where('id', workflowId)
      .update({
        draft_reminder_sent_at: new Date().toISOString(),
      });
  }
}
