import {Inject, Injectable, Logger} from '@nestjs/common';
import {packageInfo} from 'nc-help'
import {Producer} from "./producer/producer";

@Injectable()
export class TelemetryService {

  private logger: Logger = new Logger(TelemetryService.name);
  private defaultPayload: any;

  constructor(@Inject(Producer) private producer: Producer) {
    this.defaultPayload = {
      package_id: packageInfo.version
    };
  }


  public async sendEvent(event: string, payload: any = {}) {
    try {
      await this.producer.sendMessage('cloud-telemetry', JSON.stringify({
        ...this.defaultPayload,
        ...payload
      })
    } catch (e) {
      this.logger.error(e);
    }
  }

}
