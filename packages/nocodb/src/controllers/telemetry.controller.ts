import {Body, Controller, Post, Req} from '@nestjs/common';
import {TelemetryService} from '../services/telemetry.service';

@Controller()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {
  }

  @Post('/api/v1/tele')
  async trackEvents(@Body() body: { clientId: string; events: any[] }, @Req() req) {
    await this.telemetryService.trackEvents({ body, req});
  }
}
