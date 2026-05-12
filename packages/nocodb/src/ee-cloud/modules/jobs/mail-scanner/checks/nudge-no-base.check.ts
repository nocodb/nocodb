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
  NUDGE_MAX_AGE_NO_BASE_DAYS,
  NUDGE_MIN_AGE_NO_BASE_DAYS,
} from '~/modules/jobs/mail-scanner/checks/nudge-shared';

interface CandidateRow {
  user_id: string;
  email: string;
  display_name: string | null;
  workspace_id: string;
  workspace_title: string;
}

/**
 * Targets active users who signed up `[3, 7]` days ago and don't have a base
 * in any workspace they own. Once-ever per user via dedupe_key=`user:${id}`.
 */
@Injectable()
export class NudgeNoBaseCheck implements MailScannerCheck {
  readonly name = 'nudge-no-base';
  private logger = new Logger(NudgeNoBaseCheck.name);

  constructor(private readonly mailService: MailService) {}

  async run(): Promise<void> {
    const ncMeta = Noco.ncMeta;
    const now = dayjs.utc();
    const minSignup = now.subtract(NUDGE_MAX_AGE_NO_BASE_DAYS, 'day').toDate();
    const maxSignup = now.subtract(NUDGE_MIN_AGE_NO_BASE_DAYS, 'day').toDate();
    const activeSince = now.subtract(NUDGE_ACTIVE_WINDOW_DAYS, 'day').toDate();

    const knex = ncMeta.knexConnection;

    const candidates: CandidateRow[] = await knex(`${MetaTable.USERS} as u`)
      .innerJoin(`${MetaTable.WORKSPACE_USER} as wu`, function () {
        this.on('wu.fk_user_id', 'u.id').andOn(
          knex.raw('wu.roles = ?', [WorkspaceUserRoles.OWNER]),
        );
      })
      .innerJoin(`${MetaTable.WORKSPACE} as w`, function () {
        this.on('w.id', 'wu.fk_workspace_id').andOn(
          knex.raw('(w.deleted IS NULL OR w.deleted = ?)', [false]),
        );
      })
      .whereBetween('u.created_at', [minSignup, maxSignup])
      .andWhere('u.last_active_at', '>', activeSince)
      .andWhereNot('u.is_deleted', true)
      .whereNotExists(function () {
        this.select(knex.raw('1'))
          .from(`${MetaTable.PROJECT} as b`)
          .whereRaw('b.fk_workspace_id = w.id')
          .andWhere(function () {
            this.whereNull('b.deleted').orWhere('b.deleted', false);
          });
      })
      .select(
        'u.id as user_id',
        'u.email as email',
        'u.display_name as display_name',
        'w.id as workspace_id',
        'w.title as workspace_title',
      )
      .orderBy('u.created_at', 'asc');

    if (!candidates.length) {
      this.logger.debug('nudge-no-base: no candidates');
      return;
    }

    // Drop users that received any nudge in the last 7d (cross-event mute).
    // Per-event "once ever" idempotency is handled by the nc_mail_sends
    // partial unique on (event, dedupe_key) at insert time.
    const muted = await loadRecentNudgeUserIds(ncMeta);

    const baseUrl = ncSiteUrl ?? Noco.config?.ncSiteUrl ?? '';

    // Send at most one nudge per user even if they own multiple empty
    // workspaces — pick the first (oldest signup ordering).
    const handled = new Set<string>();

    for (const c of candidates) {
      if (handled.has(c.user_id) || muted.has(c.user_id)) continue;
      handled.add(c.user_id);

      const createBaseUrl = baseUrl ? `${baseUrl}/${c.workspace_id}` : '';

      try {
        await this.mailService.sendMail({
          mailEvent: MailEvent.NUDGE_NO_BASE,
          payload: {
            user: {
              id: c.user_id,
              email: c.email,
              display_name: c.display_name,
            } as any,
            workspace: { id: c.workspace_id, title: c.workspace_title },
            createBaseUrl,
          },
        });
      } catch (e) {
        this.logger.error(
          `nudge-no-base: send failed user=${c.user_id}`,
          (e as Error).stack,
        );
      }
    }
  }
}
