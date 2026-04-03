import { Injectable, Logger } from '@nestjs/common';
import { PaymentService as PaymentServiceEE } from 'src/ee/modules/payment/payment.service';
import type Stripe from 'stripe';
import { OnPremLicenseService } from '~/services/on-prem-license.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { TelemetryService } from '~/services/telemetry.service';

@Injectable()
export class PaymentService extends PaymentServiceEE {
  private readonly onPremLogger = new Logger('PaymentService:Cloud');

  constructor(
    appHooksService: AppHooksService,
    nocoJobsService: NocoJobsService,
    telemetryService: TelemetryService,
    private readonly onPremLicenseService: OnPremLicenseService,
  ) {
    super(appHooksService, nocoJobsService, telemetryService);
  }

  protected async handleOnPremSubscriptionCreated(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    await this.onPremLicenseService.handleSubscriptionCreated(stripeSub);
  }

  protected async handleOnPremSubscriptionUpdated(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    await this.onPremLicenseService.handleSubscriptionUpdated(stripeSub);
  }
}
