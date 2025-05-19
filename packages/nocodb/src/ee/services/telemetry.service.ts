import { Injectable, Logger } from '@nestjs/common';
import { PostHog } from 'posthog-node';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { ConfigService } from '@nestjs/config';
import type { AppConfig, NcRequest } from '~/interface/config';
import { packageInfo } from '~/utils';

@Injectable()
export class TelemetryService {
  private logger: Logger = new Logger(TelemetryService.name);
  private defaultPayload: any;
  private phClient: PostHog;

  constructor(private configService: ConfigService<AppConfig>) {
    this.defaultPayload = {
      package_id: packageInfo.version,
    };
    if (process.env.NC_CLOUD_POSTHOG_API_KEY)
      this.phClient = new PostHog(process.env.NC_CLOUD_POSTHOG_API_KEY, {
        host: 'https://app.posthog.com',
        disableGeoip: false,
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

    // skip if email belongs to nocodb
    if (req?.user?.email?.endsWith('@nocodb.com')) return;

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
          $ip: req?.clientIp,
          user_agent: req?.headers?.['user-agent'],
          workspace_id: req?.ncWorkspaceId,
          project_id: req?.ncBaseId,
          req_id: req?.id,
          backend: true,
          ...payload,
        },
        ...(req?.ncWorkspaceId
          ? {
              groups: {
                workspace_id: req.ncWorkspaceId,
              },
            }
          : {}),
      });
  }

  async trackEvents(param: {
    body: { clientId: string; events: any[] };
    req: NcRequest;
  }) {
    if (!process.env.NC_CLOUD_POSTHOG_API_KEY) return;

    // skip if email belongs to nocodb
    if (param.req.user?.email?.endsWith('@nocodb.com')) return;

    for (const event of param.body.events) {
      const payload = {
        created_at: Date.now(),
        ...event,
        client_id: param.body.clientId,
        ip: param.req.clientIp,
        $ip: param.req.clientIp,
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
        ...(payload.workspace_id
          ? {
              groups: {
                workspace_id: payload.workspace_id,
              },
            }
          : {}),
      });
    }

    // commented out for now since we are not using kafka for now
    // await this.producer.sendMessages('cloud-telemetry', messages);
  }

  /*
    - events:
      - event_type: source_create
        user: { id: string; email: string }
        source: Source
        base: Base
        workspace: Workspace
      - event_type: priority_error
        error_type: string
        message: string
        error_details?: any
        affected_resources?: string[]
  */
  public async sendSystemEvent({
    event_type,
    ...payload
  }: {
    event_type: string;
    [key: string]: any;
  }) {
    try {
      const snsConfig = this.configService.get('sns', {
        infer: true,
      });
      const systemEventsSnsTopic = this.configService.get(
        'systemEvents.sns.topicArn',
        {
          infer: true,
        },
      );

      if (
        !systemEventsSnsTopic ||
        !snsConfig.credentials ||
        !snsConfig.credentials.secretAccessKey ||
        !snsConfig.credentials.accessKeyId
      ) {
        this.logger.error('SNS is not configured');
        return;
      }

      const params = {
        TopicArn: systemEventsSnsTopic,
        Message: JSON.stringify({
          event_type,
          ...payload,
        }),
      };

      const snsClient = new SNSClient({
        region: snsConfig.region,
        credentials: {
          accessKeyId: snsConfig.credentials.accessKeyId,
          secretAccessKey: snsConfig.credentials.secretAccessKey,
        },
      });

      try {
        await snsClient.send(new PublishCommand(params));
      } catch (err) {
        this.logger.error('Error sending system event to SNS');
        this.logger.error(err);
      }
    } catch (err) {
      this.logger.error('Error sending system event');
      this.logger.error(err);
    }
  }
}
