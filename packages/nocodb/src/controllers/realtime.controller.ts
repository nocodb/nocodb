import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { RealtimeService } from '~/meta/realtime.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class RealtimeController {
  constructor(private realtimeService: RealtimeService) {}

  @Get('/api/v2/meta/bootstrap/:baseId')
  async bootstrap(@TenantContext() context: NcContext, @Req() req: NcRequest) {
    return this.realtimeService.bootstrap(context, req);
  }

  @Post('/api/v2/sync-events')
  async syncEvents(
    @Body() data: any,
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
  ) {
    console.log('Received sync-events request with data:', data);
    const { workspace_id, base_id, since, sinceType, offset, limit } = data;
    
    try {
      const result = await this.realtimeService.syncEvents(
        workspace_id,
        base_id,
        since,
        sinceType,
        offset,
        limit,
        context,
        req,
      );
      console.log(`Returning ${result.length} events for sync`);
      return result;
    } catch (error) {
      console.error('Error in syncEvents controller:', error);
      throw error;
    }
  }
}
