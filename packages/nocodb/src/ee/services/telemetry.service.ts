import { Inject, Injectable, Logger } from '@nestjs/common';
import { packageInfo } from 'nc-help';
import { PostHog } from 'posthog-node';
import { Producer } from './producer/producer';

@Injectable()
export class TelemetryService {
  private logger: Logger = new Logger(TelemetryService.name);
  private defaultPayload: any;
  private phClient: PostHog;

  constructor(@Inject(Producer) private producer: Producer) {
    this.defaultPayload = {
      package_id: packageInfo.version,
    };
    if (process.env.NC_CLOUD_POSTHOG_API_KEY)
      this.phClient = new PostHog(process.env.NC_CLOUD_POSTHOG_API_KEY, {
        host: 'https://app.posthog.com',
      });
  }

  public sendEvent({
    evt_type: event,
    req,
    clientId,
    ...payload
  }: {
    evt_type: string;
    req?: any;
    clientId?: any;
    [key: string]: any;
  }) {
    if (!process.env.NC_CLOUD_POSTHOG_API_KEY) {
      return;
    }

    const distinctId =
      clientId ||
      req?.headers?.['nc-client-id'] ||
      payload['userId'] ||
      payload['user_id'];

    // skip if client id / user id is not present
    if (distinctId)
      this.phClient?.capture({
        distinctId,
        event,
        properties: {
          created_at: Date.now(),
          email: req?.user?.email,
          ip: req?.clientIp,
          user_agent: req?.headers?.['user-agent'],
          workspace_id: req?.ncWorkspaceId,
          project_id: req?.ncProjectId,
          req_id: req?.id,
          backend: true,
          ...payload,
        },
      });
  }

  async trackEvents(param: {
    body: { clientId: string; events: any[] };
    req: any;
  }) {
    if (!process.env.NC_CLOUD_POSTHOG_API_KEY) return;

    for (const event of param.body.events) {
      const payload = {
        created_at: Date.now(),
        ...event,
        client_id: param.body.clientId,
        ip: param.req.clientIp,
        user_id: param.req.user?.id,
        email: param.req.user?.email,
        user_agent: param.req.headers['user-agent'],
        ...this.defaultPayload,
      };

      // commented out for now since we are not using kafka for now
      // messages.push(JSON.stringify(payload));

      this.phClient?.capture({
        distinctId: payload.client_id || payload.userId,
        event: payload.event,
        properties: {
          ...payload,
        },
      });
    }

    // commented out for now since we are not using kafka for now
    // await this.producer.sendMessages('cloud-telemetry', messages);
  }
}
