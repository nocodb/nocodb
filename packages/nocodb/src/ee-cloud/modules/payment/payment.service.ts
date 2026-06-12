import { Injectable, Logger } from '@nestjs/common';
import { PaymentService as PaymentServiceEE } from 'src/ee/modules/payment/payment.service';
import type Stripe from 'stripe';
import { OnPremLicenseService } from '~/services/on-prem-license.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { TelemetryService } from '~/services/telemetry.service';
import { MailService } from '~/services/mail/mail.service';

@Injectable()
export class PaymentService extends PaymentServiceEE {
  private readonly onPremLogger = new Logger('PaymentService:Cloud');

  constructor(
    appHooksService: AppHooksService,
    nocoJobsService: NocoJobsService,
    telemetryService: TelemetryService,
    mailService: MailService,
    private readonly onPremLicenseService: OnPremLicenseService,
  ) {
    super(appHooksService, nocoJobsService, telemetryService, mailService);
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

  protected async handleOnPremInvoicePaid(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    await this.onPremLicenseService.handleInvoicePaid(invoice);
  }

  protected async handleOnPremInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    await this.onPremLicenseService.handleInvoicePaymentFailed(invoice);
  }

  protected async syncOnPremAddons(subscriptionId: string): Promise<void> {
    try {
      await this.onPremLicenseService.syncInstallationAddons(subscriptionId);
    } catch (e) {
      this.onPremLogger.warn(
        `on-prem addon config sync skipped: ${(e as Error)?.message}`,
      );
    }
  }
}
