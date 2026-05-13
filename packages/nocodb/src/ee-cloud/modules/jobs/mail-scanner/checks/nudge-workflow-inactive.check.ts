import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { AutomationTypes } from 'nocodb-sdk';
import type { MailScannerCheck } from '~/modules/jobs/mail-scanner/checks/check.interface';
import { MailEvent } from '~/interface/Mail';
import { MailService } from '~/services/mail/mail.service';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { ncSiteUrl } from '~/utils/envs';
import {
  loadRecentNudgeUserIds,
  NUDGE_ACTIVE_WINDOW_DAYS,
  NUDGE_MAX_AGE_WORKFLOW_DAYS,
  NUDGE_MIN_AGE_WORKFLOW_HOURS,
} from '~/modules/jobs/mail-scanner/checks/nudge-shared';

interface CandidateRow {
  user_id: string;
  email: string;
  display_name: string | null;
  workspace_id: string;
  workspace_title: string;
  workflow_id: string;
  workflow_title: string;
}

/**
 * Targets users who created a workflow `[24h, 7d]` ago that is still
 * `enabled = false` and who have *no* enabled workflows anywhere. One nudge
 * per user (we pick the most recent inactive workflow as the message subject).
 */
@Injectable()
export class NudgeWorkflowInactiveCheck implements MailScannerCheck {
  readonly name = 'nudge-workflow-inactive';
  private logger = new Logger(NudgeWorkflowInactiveCheck.name);

  constructor(private readonly mailService: MailService) {}

  async run(): Promise<void> {
    const ncMeta = Noco.ncMeta;
    const now = dayjs.utc();
    const minCreated = now
      .subtract(NUDGE_MAX_AGE_WORKFLOW_DAYS, 'day')
      .toDate();
    const maxCreated = now
      .subtract(NUDGE_MIN_AGE_WORKFLOW_HOURS, 'hour')
      .toDate();
    const activeSince = now.subtract(NUDGE_ACTIVE_WINDOW_DAYS, 'day').toDate();

    const knex = ncMeta.knexConnection;

    const candidates: CandidateRow[] = await knex(
      `${MetaTable.AUTOMATIONS} as a`,
    )
      .innerJoin(`${MetaTable.USERS} as u`, 'u.id', 'a.created_by')
      .innerJoin(`${MetaTable.WORKSPACE} as w`, function () {
        this.on('w.id', 'a.fk_workspace_id').andOn(
          knex.raw('(w.deleted IS NULL OR w.deleted = ?)', [false]),
        );
      })
      .where('a.type', AutomationTypes.WORKFLOW)
      .andWhere('a.enabled', false)
      .whereBetween('a.created_at', [minCreated, maxCreated])
      .andWhere('u.last_active_at', '>', activeSince)
      .andWhereNot('u.is_deleted', true)
      .whereNotExists(function () {
        // user has zero activated workflows anywhere
        this.select(knex.raw('1'))
          .from(`${MetaTable.AUTOMATIONS} as a2`)
          .whereRaw('a2.created_by = u.id')
          .andWhere('a2.type', AutomationTypes.WORKFLOW)
          .andWhere('a2.enabled', true);
      })
      .select(
        'u.id as user_id',
        'u.email as email',
        'u.display_name as display_name',
        'w.id as workspace_id',
        'w.title as workspace_title',
        'a.id as workflow_id',
        'a.title as workflow_title',
      )
      .orderBy('a.created_at', 'desc');

    if (!candidates.length) {
      this.logger.debug('nudge-workflow-inactive: no candidates');
      return;
    }

    const muted = await loadRecentNudgeUserIds(ncMeta);
    const baseUrl = ncSiteUrl ?? Noco.config?.ncSiteUrl ?? '';

    const handled = new Set<string>();

    for (const c of candidates) {
      if (handled.has(c.user_id) || muted.has(c.user_id)) continue;
      handled.add(c.user_id);

      const workflowUrl = baseUrl
        ? `${baseUrl}/${c.workspace_id}/workflows/${c.workflow_id}`
        : '';

      try {
        await this.mailService.sendMail({
          mailEvent: MailEvent.NUDGE_WORKFLOW_INACTIVE,
          payload: {
            user: {
              id: c.user_id,
              email: c.email,
              display_name: c.display_name,
            } as any,
            workspace: { id: c.workspace_id, title: c.workspace_title },
            workflow: { id: c.workflow_id, title: c.workflow_title },
            workflowUrl,
          },
        });
      } catch (e) {
        this.logger.error(
          `nudge-workflow-inactive: send failed user=${c.user_id}`,
          (e as Error).stack,
        );
      }
    }
  }
}
