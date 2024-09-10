import { Injectable } from '@nestjs/common';
import { packageInfo, T } from '~/utils';

@Injectable()
export class TelemetryService {
  private defaultPayload: any;

  constructor() {
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
    if (event === '$pageview') T.page({ ...payload, event });
    else T.event({ ...payload, event });
  }
}
