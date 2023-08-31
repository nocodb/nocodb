import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { TelemetryService } from '~/services/telemetry.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Acl('trackEvents', { scope: 'org' })
  @Post('/api/v1/tele')
  async trackEvents(
    @Body() body: { clientId: string; events: any[] },
    @Req() req,
  ) {
    await this.telemetryService.trackEvents({ body, req });
  }
}
