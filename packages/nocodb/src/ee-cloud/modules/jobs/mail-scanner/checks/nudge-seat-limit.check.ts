import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { PlanTitles, WorkspaceUserRoles } from 'nocodb-sdk';
import type { MailScannerCheck } from '~/modules/jobs/mail-scanner/checks/check.interface';
import { MailEvent } from '~/interface/Mail';
import { MailService } from '~/services/mail/mail.service';
import { MetaTable } from '~/utils/globals';
import { Workspace } from '~/models';
import Noco from '~/Noco';
import { ncSiteUrl } from '~/utils/envs';
import {
  loadRecentNudgeUserIds,
  NUDGE_ACTIVE_WINDOW_DAYS,
  NUDGE_MAX_AGE_SEAT_LIMIT_DAYS,
  NUDGE_MIN_AGE_SEAT_LIMIT_DAYS,
} from '~/modules/jobs/mail-scanner/checks/nudge-shared';

/**
 * Free-plan editor seat limit. Hard-coded here because it's used as the
 * SQL bound — querying the plan meta per workspace would force a JOIN
 * we don't otherwise need. If the Free editor limit changes, update here.
 */
const FREE_EDITOR_LIMIT = 3;

interface CandidateRow {
  user_id: string;
  email: string;
  display_name: string | null;
  workspace_id: string;
  workspace_title: string;
  seat_count: number;
}

/**
 * Targets active workspace owners on the Free plan whose workspace has hit
 * the editor seat limit. One-time per user. Messaging emphasizes that
 * viewers/commenters remain free of charge.
 */
@Injectable()
export class NudgeSeatLimitCheck implements MailScannerCheck {
  readonly name = 'nudge-seat-limit';
  private logger = new Logger(NudgeSeatLimitCheck.name);

  constructor(private readonly mailService: MailService) {}

  async run(): Promise<void> {
    const ncMeta = Noco.ncMeta;
    const now = dayjs.utc();
    const activeSince = now.subtract(NUDGE_ACTIVE_WINDOW_DAYS, 'day').toDate();
    const minCreated = now
      .subtract(NUDGE_MAX_AGE_SEAT_LIMIT_DAYS, 'day')
      .toDate();
    const maxCreated = now
      .subtract(NUDGE_MIN_AGE_SEAT_LIMIT_DAYS, 'day')
      .toDate();

    const knex = ncMeta.knexConnection;

    // Subquery: count seat-charging members per workspace. We bind the
    // values directly into the SQL because Knex's `whereIn` on the
    // subquery alone wouldn't filter at the GROUP level.
    const seatCountSub = knex(`${MetaTable.WORKSPACE_USER} as wu_count`)
      .select('wu_count.fk_workspace_id')
      .count<{ fk_workspace_id: string; cnt: string }>('* as cnt')
      .whereIn('wu_count.roles', [
        WorkspaceUserRoles.OWNER,
        WorkspaceUserRoles.CREATOR,
        WorkspaceUserRoles.EDITOR,
      ])
      .groupBy('wu_count.fk_workspace_id')
      .havingRaw('COUNT(*) >= ?', [FREE_EDITOR_LIMIT])
      .as('sc');

    const candidates: CandidateRow[] = await knex(`${MetaTable.WORKSPACE} as w`)
      .innerJoin(seatCountSub, 'sc.fk_workspace_id', 'w.id')
      .innerJoin(`${MetaTable.WORKSPACE_USER} as wu`, function () {
        this.on('wu.fk_workspace_id', 'w.id').andOn(
          knex.raw('wu.roles = ?', [WorkspaceUserRoles.OWNER]),
        );
      })
      .innerJoin(`${MetaTable.USERS} as u`, 'u.id', 'wu.fk_user_id')
      .where(function () {
        this.whereNull('w.deleted').orWhere('w.deleted', false);
      })
      .whereBetween('w.created_at', [minCreated, maxCreated])
      .andWhere('u.last_active_at', '>', activeSince)
      .andWhereNot('u.is_deleted', true)
      .select(
        'u.id as user_id',
        'u.email as email',
        'u.display_name as display_name',
        'w.id as workspace_id',
        'w.title as workspace_title',
        knex.raw('sc.cnt as seat_count'),
      );

    if (!candidates.length) {
      this.logger.debug('nudge-seat-limit: no candidates');
      return;
    }

    const muted = await loadRecentNudgeUserIds(ncMeta);
    const baseUrl = ncSiteUrl ?? Noco.config?.ncSiteUrl ?? '';

    const handled = new Set<string>();

    for (const c of candidates) {
      if (handled.has(c.user_id) || muted.has(c.user_id)) continue;

      // Confirm Free plan via the canonical workspace.payment.plan.title.
      // The legacy nc_workspace.plan column isn't kept in sync — going via
      // the model honors the actual subscription state.
      let workspace: Workspace | null = null;
      try {
        workspace = await Workspace.get(c.workspace_id, undefined, ncMeta);
      } catch (e) {
        this.logger.warn(
          `nudge-seat-limit: workspace lookup failed for ${c.workspace_id}: ${
            (e as Error).message
          }`,
        );
        continue;
      }
      const planTitle = workspace?.payment?.plan?.title;
      // Treat "no payment record" as Free — many free workspaces never had
      // a subscription row created.
      if (planTitle && planTitle !== PlanTitles.FREE) continue;

      handled.add(c.user_id);

      const inviteUrl = baseUrl
        ? `${baseUrl}/${c.workspace_id}/settings?tab=members`
        : '';
      const upgradeUrl = baseUrl
        ? `${baseUrl}/${c.workspace_id}/settings?tab=billing`
        : '';

      try {
        await this.mailService.sendMail({
          mailEvent: MailEvent.NUDGE_SEAT_LIMIT,
          payload: {
            user: {
              id: c.user_id,
              email: c.email,
              display_name: c.display_name,
            } as any,
            workspace: { id: c.workspace_id, title: c.workspace_title },
            currentEditors: Number(c.seat_count) || FREE_EDITOR_LIMIT,
            editorLimit: FREE_EDITOR_LIMIT,
            inviteUrl,
            upgradeUrl,
          },
        });
      } catch (e) {
        this.logger.error(
          `nudge-seat-limit: send failed user=${c.user_id}`,
          (e as Error).stack,
        );
      }
    }
  }
}
