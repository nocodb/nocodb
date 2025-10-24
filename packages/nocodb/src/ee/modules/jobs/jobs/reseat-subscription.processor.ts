import { Injectable, Logger } from '@nestjs/common';
import type { ReseatSubscriptionJobData } from '~/interface/Jobs';
import { PaymentService } from '~/modules/payment/payment.service';
import Noco from '~/Noco';

@Injectable()
export class ReseatSubscriptionProcessor {
  private logger = new Logger(ReseatSubscriptionProcessor.name);

  constructor(private readonly paymentService: PaymentService) {}

  async job(data: ReseatSubscriptionJobData) {
    const { workspaceOrOrgId, initiator } = data;

    this.logger.log(
      `Processing delayed reseat for workspace/org ${workspaceOrOrgId}`,
    );

    try {
      await this.paymentService.reseatSubscriptionAwaited(
        workspaceOrOrgId,
        Noco.ncMeta,
        initiator,
      );
      this.logger.log(
        `Successfully reseated subscription for workspace/org ${workspaceOrOrgId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error reseating subscription for workspace/org ${workspaceOrOrgId}`,
      );
      this.logger.error(error);
      throw error;
    }
  }
}
