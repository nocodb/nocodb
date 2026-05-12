import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { MetaTable } from '~/utils/globals';
import { Workspace, WorkspaceUser } from '~/models';
import { ncSiteUrl } from '~/utils/envs';

dayjs.extend(utc);

interface RenewalCandidate {
  id: string;
  fk_workspace_id: string;
  fk_plan_id: string;
  status: string;
  upcoming_invoice_at: string;
  upcoming_invoice_amount: number | null;
  upcoming_invoice_currency: string | null;
}

@Injectable()
export class MailRenewalScannerProcessor {
  private logger = new Logger(MailRenewalScannerProcessor.name);

  constructor(private readonly mailService: MailService) {}

  async job() {
    this.logger.debug('MailRenewalScanner job started');

    const ncMeta = Noco.ncMeta;
    const windowStart = dayjs.utc().add(6, 'day').toISOString();
    const windowEnd = dayjs.utc().add(8, 'day').toISOString();

    let candidates: RenewalCandidate[] = [];
    try {
      candidates = await ncMeta
        .knexConnection(MetaTable.SUBSCRIPTIONS)
        .select(
          'id',
          'fk_workspace_id',
          'fk_plan_id',
          'status',
          'upcoming_invoice_at',
          'upcoming_invoice_amount',
          'upcoming_invoice_currency',
        )
        .whereNotNull('fk_workspace_id')
        .whereNotNull('upcoming_invoice_at')
        .andWhere('upcoming_invoice_at', '>=', windowStart)
        .andWhere('upcoming_invoice_at', '<', windowEnd)
        .andWhere('status', 'active')
        .whereNull('canceled_at');
    } catch (e) {
      this.logger.error(
        'MailRenewalScanner: subscription query failed',
        (e as Error).stack,
      );
      return;
    }

    if (!candidates.length) {
      this.logger.debug('MailRenewalScanner: no subscriptions in window');
      return;
    }

    const baseUrl = ncSiteUrl ?? Noco.config?.ncSiteUrl ?? '';

    for (const sub of candidates) {
      try {
        const ws = await Workspace.get(sub.fk_workspace_id, false, ncMeta);
        if (!ws) continue;

        const owners = await WorkspaceUser.userList(
          { fk_workspace_id: ws.id, roles: WorkspaceUserRoles.OWNER },
          ncMeta,
        );

        const billingPortalUrl = baseUrl
          ? `${baseUrl}/${ws.id}/settings?tab=billing`
          : '';

        for (const owner of owners) {
          if (!owner?.email) continue;

          await this.mailService.sendMail({
            mailEvent: MailEvent.RENEWAL_REMINDER,
            payload: {
              user: {
                id: owner.id,
                email: owner.email,
                display_name: owner.display_name,
              } as any,
              workspace: { id: ws.id, title: ws.title },
              subscriptionId: sub.id,
              planTitle: sub.fk_plan_id ?? 'Paid',
              periodEnd: sub.upcoming_invoice_at,
              amountDue: sub.upcoming_invoice_amount ?? undefined,
              currency: sub.upcoming_invoice_currency ?? undefined,
              billingPortalUrl,
            },
          } as any);
        }
      } catch (e) {
        this.logger.error(
          `MailRenewalScanner: failed for subscription ${sub.id}`,
          (e as Error).stack,
        );
      }
    }
  }
}
