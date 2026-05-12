import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import type { MailScannerCheck } from '~/modules/jobs/mail-scanner/checks/check.interface';
import { MailEvent } from '~/interface/Mail';
import { MailService } from '~/services/mail/mail.service';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { ncSiteUrl } from '~/utils/envs';
import {
  loadRecentNudgeUserIds,
  NUDGE_ACTIVE_WINDOW_DAYS,
  NUDGE_MAX_AGE_INVITE_DAYS,
  NUDGE_MIN_AGE_INVITE_DAYS,
} from '~/modules/jobs/mail-scanner/checks/nudge-shared';

interface CandidateRow {
  user_id: string;
  email: string;
  display_name: string | null;
  workspace_id: string;
  workspace_title: string;
}

/**
 * Targets active workspace owners whose workspace is `[7, 14]` days old and
 * has exactly one member. Encourages bringing teammates aboard.
 */
@Injectable()
export class NudgeInviteTeamCheck implements MailScannerCheck {
  readonly name = 'nudge-invite-team';
  private logger = new Logger(NudgeInviteTeamCheck.name);

  constructor(private readonly mailService: MailService) {}

  async run(): Promise<void> {
    const ncMeta = Noco.ncMeta;
    const now = dayjs.utc();
    const minCreated = now.subtract(NUDGE_MAX_AGE_INVITE_DAYS, 'day').toDate();
    const maxCreated = now.subtract(NUDGE_MIN_AGE_INVITE_DAYS, 'day').toDate();
    const activeSince = now.subtract(NUDGE_ACTIVE_WINDOW_DAYS, 'day').toDate();

    const knex = ncMeta.knexConnection;

    // Workspaces in window with exactly 1 member, paired with the owner user.
    const candidates: CandidateRow[] = await knex(`${MetaTable.WORKSPACE} as w`)
      .innerJoin(`${MetaTable.WORKSPACE_USER} as wu`, function () {
        this.on('wu.fk_workspace_id', 'w.id').andOn(
          knex.raw('wu.roles = ?', [WorkspaceUserRoles.OWNER]),
        );
      })
      .innerJoin(`${MetaTable.USERS} as u`, 'u.id', 'wu.fk_user_id')
      .whereBetween('w.created_at', [minCreated, maxCreated])
      .andWhere(function () {
        this.whereNull('w.deleted').orWhere('w.deleted', false);
      })
      .andWhere('u.last_active_at', '>', activeSince)
      .andWhereNot('u.is_deleted', true)
      .andWhere(
        knex.raw(
          `(SELECT COUNT(*) FROM ?? wu2 WHERE wu2.fk_workspace_id = w.id) = ?`,
          [MetaTable.WORKSPACE_USER, 1],
        ),
      )
      .select(
        'u.id as user_id',
        'u.email as email',
        'u.display_name as display_name',
        'w.id as workspace_id',
        'w.title as workspace_title',
      )
      .orderBy('w.created_at', 'asc');

    if (!candidates.length) {
      this.logger.debug('nudge-invite-team: no candidates');
      return;
    }

    const muted = await loadRecentNudgeUserIds(ncMeta);
    const baseUrl = ncSiteUrl ?? Noco.config?.ncSiteUrl ?? '';

    const handled = new Set<string>();

    for (const c of candidates) {
      if (handled.has(c.user_id) || muted.has(c.user_id)) continue;
      handled.add(c.user_id);

      const inviteUrl = baseUrl
        ? `${baseUrl}/${c.workspace_id}/settings?tab=members`
        : '';

      try {
        await this.mailService.sendMail({
          mailEvent: MailEvent.NUDGE_INVITE_TEAM,
          payload: {
            user: {
              id: c.user_id,
              email: c.email,
              display_name: c.display_name,
            } as any,
            workspace: { id: c.workspace_id, title: c.workspace_title },
            inviteUrl,
          },
        });
      } catch (e) {
        this.logger.error(
          `nudge-invite-team: send failed user=${c.user_id}`,
          (e as Error).stack,
        );
      }
    }
  }
}
