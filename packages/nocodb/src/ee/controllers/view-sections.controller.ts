import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  ViewSectionCreateReqType,
  ViewSectionUpdateReqType,
} from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { ViewSectionsService } from '~/ee/services/view-sections.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ViewSectionsController {
  constructor(
    private readonly viewSectionsService: ViewSectionsService,
  ) {}

  @Get([
    '/api/v1/db/meta/tables/:tableId/view-sections',
    '/api/v2/meta/tables/:tableId/view-sections',
  ])
  @Acl('viewList')
  async viewSectionList(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
  ) {
    return {
      list: await this.viewSectionsService.list(context, tableId),
    };
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/view-sections',
    '/api/v2/meta/tables/:tableId/view-sections',
  ])
  @HttpCode(200)
  @Acl('viewCreate')
  async viewSectionCreate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: ViewSectionCreateReqType,
    @Req() req: NcRequest,
  ) {
    return await this.viewSectionsService.create(context, tableId, body, req);
  }

  @Patch([
    '/api/v1/db/meta/view-sections/:sectionId',
    '/api/v2/meta/view-sections/:sectionId',
  ])
  @Acl('viewUpdate')
  async viewSectionUpdate(
    @TenantContext() context: NcContext,
    @Param('sectionId') sectionId: string,
    @Body() body: ViewSectionUpdateReqType,
    @Req() req: NcRequest,
  ) {
    return await this.viewSectionsService.update(
      context,
      sectionId,
      body,
      req,
    );
  }

  @Delete([
    '/api/v1/db/meta/view-sections/:sectionId',
    '/api/v2/meta/view-sections/:sectionId',
  ])
  @Acl('viewDelete')
  async viewSectionDelete(
    @TenantContext() context: NcContext,
    @Param('sectionId') sectionId: string,
    @Req() req: NcRequest,
  ) {
    return await this.viewSectionsService.delete(context, sectionId, req);
  }
}
