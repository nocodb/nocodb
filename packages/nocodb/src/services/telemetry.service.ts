import { Inject, Injectable, Logger } from '@nestjs/common';
import { packageInfo } from 'nc-help';
import { Producer } from './producer/producer';

@Injectable()
export class TelemetryService {
  private logger: Logger = new Logger(TelemetryService.name);
  private defaultPayload: any;

  constructor(@Inject(Producer) private producer: Producer) {
    this.defaultPayload = {
      package_id: packageInfo.version,
    };
  }

  public sendEvent({
    evt_type: event,
    ...payload
  }: {
    evt_type: string;
    [key: string]: any;
  }) {
    this.producer
      .sendMessage(
        'cloud-telemetry',
        JSON.stringify({
          timestamp: Date.now(),
          event,
          ...this.defaultPayload,
          ...payload,
        }),
      )
      .catch((err) => {
        this.logger.error(err);
      });
  }

  async trackEvents(param: {
    body: { clientId: string; events: any[] };
    req: any;
  }) {
    const messages = [];

    for (const event of param.body.events) {
      const payload = {
        created_at: Date.now(),
        ...event,
        client_id: param.body.clientId,
        project_id: event?.pid ?? undefined,
        ip: param.req.clientIp,
        userId: param.req.user?.id,
        user_agent: param.req.headers['user-agent'],
        ...this.defaultPayload,
      };

      messages.push(JSON.stringify(payload));
    }

    await this.producer.sendMessages('cloud-telemetry', messages);
  }
}
