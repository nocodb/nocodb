import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { FilterReqType } from 'nocodb-sdk';
import { FiltersController as FiltersControllerCE } from 'src/controllers/filters.controller';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { FiltersService } from '~/services/filters.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
export class FiltersController extends FiltersControllerCE {
  constructor(protected readonly filtersService: FiltersService) {
    super(filtersService);
  }

  @Get(['/api/v2/meta/links/:columnId/filters'])
  @Acl('linkFilterList')
  async linkFilterList(
    @TenantContext() context: NcContext,
    @Param('columnId') columnId: string,
  ) {
    return new PagedResponseImpl(
      await this.filtersService.linkFilterList(context, {
        columnId: columnId,
      }),
    );
  }

  @Post(['/api/v2/meta/links/:columnId/filters'])
  @HttpCode(200)
  @Acl('linkFilterCreate')
  async linkFilterCreate(
    @TenantContext() context: NcContext,
    @Param('columnId') columnId: string,
    @Body() body: FilterReqType,
    @Req() req: NcRequest,
  ) {
    const filter = await this.filtersService.linkFilterCreate(context, {
      filter: body,
      columnId,
      user: req.user,
      req,
    });
    return filter;
  }
}
