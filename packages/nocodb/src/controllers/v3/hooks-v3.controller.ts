import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { HooksService } from '~/services/hooks.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';
import { PREFIX_APIV3_METABASE } from '~/constants/controllers';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class HooksController {
  constructor(private readonly hooksService: HooksService) {}

  @Get(`${PREFIX_APIV3_METABASE}/tables/:tableId/hooks`)
  @Acl('hookList')
  async hookList(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
  ) {
    return new PagedResponseImpl(
      await this.hooksService.hookList(context, { tableId }),
    );
  }
}
