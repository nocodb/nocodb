import {Inject, Injectable, Logger} from '@nestjs/common';
import {packageInfo} from 'nc-help';
import {Producer} from './producer/producer';
import {Request} from 'express';

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

  async trackEvents(param: { events: any[]; req: Request }) {
    // process data
    // push to kafka queue
  }
}
