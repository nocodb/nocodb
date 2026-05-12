import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  GRACE_PERIOD_DURATION,
  PlanLimitTypes,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import Noco from '~/Noco';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { MetaTable } from '~/utils/globals';
import { WorkspaceUser } from '~/models';
import { ncSiteUrl } from '~/utils/envs';

dayjs.extend(utc);

const GRACE_END_WARNING_DAYS = [7, 3, 1];

interface GraceWorkspaceRow {
  id: string;
  title: string;
  grace_period_start_at: string | null;
  api_grace_period_start_at: string | null;
  automation_grace_period_start_at: string | null;
}

@Injectable()
export class MailLimitScannerProcessor {
  private logger = new Logger(MailLimitScannerProcessor.name);

  constructor(private readonly mailService: MailService) {}

  async job() {
    this.logger.debug('MailLimitScanner job started');

    const ncMeta = Noco.ncMeta;
    const now = dayjs.utc();

    let workspaces: GraceWorkspaceRow[] = [];
    try {
      workspaces = await ncMeta
        .knexConnection(MetaTable.WORKSPACE)
        .select(
          'id',
          'title',
          'grace_period_start_at',
          'api_grace_period_start_at',
          'automation_grace_period_start_at',
        )
        .where(function () {
          this.whereNotNull('grace_period_start_at')
            .orWhereNotNull('api_grace_period_start_at')
            .orWhereNotNull('automation_grace_period_start_at');
        })
        .andWhere(function () {
          this.whereNull('deleted').orWhere('deleted', false);
        });
    } catch (e) {
      this.logger.error(
        'MailLimitScanner: workspace query failed',
        (e as Error).stack,
      );
      return;
    }

    if (!workspaces.length) {
      this.logger.debug('MailLimitScanner: no workspaces in grace');
      return;
    }

    const limitMap: Array<{
      field: keyof Pick<
        GraceWorkspaceRow,
        | 'grace_period_start_at'
        | 'api_grace_period_start_at'
        | 'automation_grace_period_start_at'
      >;
      limitType: PlanLimitTypes;
    }> = [
      {
        field: 'grace_period_start_at',
        limitType: PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
      },
      {
        field: 'api_grace_period_start_at',
        limitType: PlanLimitTypes.LIMIT_API_CALL,
      },
      {
        field: 'automation_grace_period_start_at',
        limitType: PlanLimitTypes.LIMIT_AUTOMATION_RUN,
      },
    ];

    for (const ws of workspaces) {
      for (const { field, limitType } of limitMap) {
        const startAt = ws[field];
        if (!startAt) continue;

        try {
          await this.notifyForLimit(ws, startAt, limitType, now);
        } catch (e) {
          this.logger.error(
            `MailLimitScanner: failed for workspace ${ws.id} (${limitType})`,
            (e as Error).stack,
          );
        }
      }
    }
  }

  protected async notifyForLimit(
    ws: GraceWorkspaceRow,
    startAtIso: string,
    limitType: PlanLimitTypes,
    now: dayjs.Dayjs,
  ) {
    const start = dayjs.utc(startAtIso);
    const end = start.add(GRACE_PERIOD_DURATION, 'day');

    if (!end.isAfter(now)) {
      return;
    }

    const daysSinceStart = now.startOf('day').diff(start.startOf('day'), 'day');
    const daysRemaining = end.startOf('day').diff(now.startOf('day'), 'day');

    const owners = await WorkspaceUser.userList(
      { fk_workspace_id: ws.id, roles: WorkspaceUserRoles.OWNER },
      Noco.ncMeta,
    );

    if (!owners.length) {
      this.logger.warn(
        `MailLimitScanner: workspace ${ws.id} has no owner; skipping`,
      );
      return;
    }

    const baseUrl = ncSiteUrl ?? Noco.config?.ncSiteUrl ?? '';
    const upgradeUrl = baseUrl
      ? `${baseUrl}/${ws.id}/settings?tab=billing`
      : '';

    for (const owner of owners) {
      if (!owner?.email) continue;

      if (daysSinceStart === 0) {
        await this.mailService.sendMail({
          mailEvent: MailEvent.LIMIT_REACHED,
          payload: {
            user: {
              id: owner.id,
              email: owner.email,
              display_name: owner.display_name,
            } as any,
            workspace: { id: ws.id, title: ws.title },
            limitType,
            currentUsage: 0,
            limitValue: 0,
            gracePeriodStartAt: start.toISOString(),
            gracePeriodEndsAt: end.toISOString(),
            upgradeUrl,
          },
        } as any);
        continue;
      }

      if (GRACE_END_WARNING_DAYS.includes(daysRemaining)) {
        await this.mailService.sendMail({
          mailEvent: MailEvent.GRACE_PERIOD_ENDING,
          payload: {
            user: {
              id: owner.id,
              email: owner.email,
              display_name: owner.display_name,
            } as any,
            workspace: { id: ws.id, title: ws.title },
            limitType,
            currentUsage: 0,
            limitValue: 0,
            gracePeriodStartAt: start.toISOString(),
            gracePeriodEndsAt: end.toISOString(),
            daysRemaining,
            upgradeUrl,
          },
        } as any);
      }
    }
  }
}
