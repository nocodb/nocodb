import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GalleryUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { GalleriesService } from '~/services/galleries.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class GalleriesController {
  constructor(private readonly galleriesService: GalleriesService) {}

  @Get([
    '/api/v1/db/meta/galleries/:galleryViewId',
    '/api/v2/meta/galleries/:galleryViewId',
  ])
  @Acl('galleryViewGet')
  async galleryViewGet(
    @TenantContext() context: NcContext,
    @Param('galleryViewId') galleryViewId: string,
  ) {
    return await this.galleriesService.galleryViewGet(context, {
      galleryViewId,
    });
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/galleries',
    '/api/v2/meta/tables/:tableId/galleries',
  ])
  @HttpCode(200)
  @Acl('galleryViewCreate')
  async galleryViewCreate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: NcRequest,
  ) {
    return await this.galleriesService.galleryViewCreate(context, {
      gallery: body,
      // todo: sanitize
      tableId,
      req,
      user: req.user,
    });
  }

  @Patch([
    '/api/v1/db/meta/galleries/:galleryViewId',
    '/api/v2/meta/galleries/:galleryViewId',
  ])
  @Acl('galleryViewUpdate')
  async galleryViewUpdate(
    @TenantContext() context: NcContext,
    @Param('galleryViewId') galleryViewId: string,
    @Body() body: GalleryUpdateReqType,

    @Req() req: NcRequest,
  ) {
    return await this.galleriesService.galleryViewUpdate(context, {
      galleryViewId,
      gallery: body,
      req,
    });
  }
}
