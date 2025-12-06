import { Injectable } from '@nestjs/common';
import { PaymentService as PaymentServiceEE } from 'src/ee/modules/payment/payment.service';
import NocoLicense from '~/NocoLicense';
import Noco from '~/Noco';

@Injectable()
export class PaymentService extends PaymentServiceEE {
  async reseatSubscription(
    workspaceOrOrgId: string,
    ncMeta = Noco.ncMeta,
    initiator?: string,
  ) {
    const res = await super.reseatSubscription(
      workspaceOrOrgId,
      ncMeta,
      initiator,
    );

    NocoLicense.refreshLicenseFromServer(ncMeta).catch((err) => {
      this.logger.error(
        `Failed to refresh license after reseatSubscription for ${workspaceOrOrgId}: ${err.message}`,
      );
    });

    return res;
  }
}
