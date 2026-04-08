import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { type Message, PubSub, type Subscription } from '@google-cloud/pubsub';
import { GcpMarketplaceService } from '~/services/gcp-marketplace.service';
import { getGcpCredentials } from '~/services/gcp-credentials';

@Injectable()
export class GcpPubsubListenerService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(GcpPubsubListenerService.name);
  private subscription: Subscription | null = null;

  constructor(private readonly gcpMarketplaceService: GcpMarketplaceService) {}

  async onModuleInit(): Promise<void> {
    const subscriptionName = process.env.NC_GCP_MARKETPLACE_PUBSUB_SUBSCRIPTION;
    const projectId = process.env.NC_GCP_MARKETPLACE_PROJECT_ID;

    if (!subscriptionName) {
      this.logger.log(
        'GCP Marketplace Pub/Sub listener disabled (NC_GCP_MARKETPLACE_PUBSUB_SUBSCRIPTION not set)',
      );
      return;
    }

    try {
      const pubsub = new PubSub({
        ...(projectId ? { projectId } : {}),
        ...getGcpCredentials(),
      });

      this.subscription = pubsub.subscription(subscriptionName);

      this.subscription.on('message', this.handleMessage.bind(this));
      this.subscription.on('error', this.handleError.bind(this));

      this.logger.log(
        `GCP Marketplace Pub/Sub listener started (subscription: ${subscriptionName})`,
      );
    } catch (e) {
      this.logger.error(
        `Failed to start GCP Pub/Sub listener: ${e.message}`,
        e.stack,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscription) {
      try {
        await this.subscription.close();
        this.logger.log('GCP Marketplace Pub/Sub listener stopped');
      } catch (e) {
        this.logger.error(
          `Error closing Pub/Sub subscription: ${e.message}`,
          e.stack,
        );
      }
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    let data: any;
    try {
      data = JSON.parse(message.data.toString());
    } catch {
      this.logger.error(
        `Failed to parse Pub/Sub message: ${message.data.toString()}`,
      );
      message.ack();
      return;
    }

    const eventType = data.eventType;

    this.logger.log(`Received GCP Marketplace event: ${eventType}`);

    try {
      if (data.entitlement) {
        await this.handleEntitlementEvent(eventType, data.entitlement.id);
      } else if (data.account) {
        await this.handleAccountEvent(eventType, data.account.id);
      } else {
        this.logger.warn(
          `Unknown GCP Marketplace message format: ${JSON.stringify(data)}`,
        );
      }

      message.ack();
    } catch (e) {
      this.logger.error(
        `Failed to handle GCP event ${eventType}: ${e.message}`,
        e.stack,
      );

      // ACK only 409 (conflict / already processed) — truly non-retryable
      // NACK everything else — Pub/Sub applies its own exponential backoff on repeated NACKs
      const status = e?.response?.status;
      if (status === 409) {
        this.logger.warn(
          `ACKing conflict (409) for event ${eventType} — already processed`,
        );
        message.ack();
      } else {
        message.nack();
      }
    }
  }

  private async handleEntitlementEvent(
    eventType: string,
    entitlementId: string,
  ): Promise<void> {
    if (!entitlementId) {
      this.logger.warn(`Entitlement event missing ID: ${eventType}`);
      return;
    }

    switch (eventType) {
      case 'ENTITLEMENT_CREATION_REQUESTED':
        await this.gcpMarketplaceService.handleEntitlementCreationRequested(
          entitlementId,
        );
        break;

      case 'ENTITLEMENT_ACTIVE':
        await this.gcpMarketplaceService.handleEntitlementActive(entitlementId);
        break;

      case 'ENTITLEMENT_PLAN_CHANGE_REQUESTED':
        await this.gcpMarketplaceService.handleEntitlementPlanChangeRequested(
          entitlementId,
        );
        break;

      case 'ENTITLEMENT_PLAN_CHANGED':
        await this.gcpMarketplaceService.handleEntitlementPlanChanged(
          entitlementId,
        );
        break;

      case 'ENTITLEMENT_CANCELLED':
      case 'ENTITLEMENT_DELETED':
        await this.gcpMarketplaceService.handleEntitlementCancelled(
          entitlementId,
        );
        break;

      case 'ENTITLEMENT_PENDING_CANCELLATION':
      case 'ENTITLEMENT_CANCELLATION_REVERTED':
      case 'ENTITLEMENT_PLAN_CHANGE_CANCELLED':
      case 'ENTITLEMENT_RENEWED':
      case 'ENTITLEMENT_OFFER_ENDED':
      case 'ENTITLEMENT_OFFER_ACCEPTED':
        // No action needed for these events
        this.logger.log(
          `No-op for event ${eventType} on entitlement ${entitlementId}`,
        );
        break;

      default:
        this.logger.warn(`Unknown entitlement event type: ${eventType}`);
    }
  }

  private async handleAccountEvent(
    eventType: string,
    accountId: string,
  ): Promise<void> {
    if (!accountId) {
      this.logger.warn('Account event missing ID');
      return;
    }

    switch (eventType) {
      case 'ACCOUNT_ACTIVE':
        // Account was approved — no action needed on our side
        this.logger.log(`Account ${accountId} is now active`);
        break;

      case 'ACCOUNT_DELETED':
        await this.gcpMarketplaceService.handleAccountDeleted(accountId);
        break;

      default:
        this.logger.log(`No-op for account event ${eventType} on ${accountId}`);
    }
  }

  private handleError(error: Error): void {
    this.logger.error(
      `GCP Pub/Sub subscription error: ${error.message}`,
      error.stack,
    );
  }
}
