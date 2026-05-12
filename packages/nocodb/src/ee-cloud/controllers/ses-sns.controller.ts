import { Body, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { MailService } from '~/services/mail/mail.service';

interface SnsEnvelope {
  Type?: string;
  Message?: string;
  Token?: string;
  TopicArn?: string;
  SubscribeURL?: string;
}

@Controller('api/v2/internal/ses-notifications')
export class SesSnsController {
  private logger = new Logger(SesSnsController.name);

  constructor(private readonly mailService: MailService) {}

  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request, @Body() body: SnsEnvelope | any) {
    let envelope: SnsEnvelope = body;

    if (typeof body === 'string') {
      try {
        envelope = JSON.parse(body);
      } catch {
        envelope = {};
      }
    }

    const messageType =
      (req.headers['x-amz-sns-message-type'] as string | undefined) ??
      envelope?.Type;

    if (messageType === 'SubscriptionConfirmation') {
      this.logger.log(
        `SES SNS subscription confirmation received; SubscribeURL=${
          envelope?.SubscribeURL ?? '<missing>'
        }`,
      );
      // Confirm subscription out of band (curl SubscribeURL).
      return { ok: true, type: 'SubscriptionConfirmation' };
    }

    if (messageType === 'UnsubscribeConfirmation') {
      this.logger.warn('SES SNS topic unsubscribed');
      return { ok: true, type: 'UnsubscribeConfirmation' };
    }

    if (messageType === 'Notification') {
      let parsed: any = null;
      try {
        parsed =
          typeof envelope.Message === 'string'
            ? JSON.parse(envelope.Message)
            : envelope.Message;
      } catch (e) {
        this.logger.error(
          'SES SNS: failed to parse Message',
          (e as Error).stack,
        );
        return { ok: false, error: 'parse_error' };
      }

      const updated = await (this.mailService as any).handleSesNotification(
        parsed,
      );
      return { ok: true, updated };
    }

    this.logger.warn(`SES SNS: unknown message type ${messageType}`);
    return { ok: false, error: 'unknown_type' };
  }
}
