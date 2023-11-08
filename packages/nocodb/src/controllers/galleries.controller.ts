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
import { Request } from 'express';
import { GalleryUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { GalleriesService } from '~/services/galleries.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class GalleriesController {
  constructor(private readonly galleriesService: GalleriesService) {}

  @Get([
    '/api/v1/db/meta/galleries/:galleryViewId',
    '/api/v2/meta/galleries/:galleryViewId',
  ])
  @Acl('galleryViewGet')
  async galleryViewGet(@Param('galleryViewId') galleryViewId: string) {
    return await this.galleriesService.galleryViewGet({
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
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: Request,
  ) {
    return await this.galleriesService.galleryViewCreate({
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
    @Param('galleryViewId') galleryViewId: string,
    @Body() body: GalleryUpdateReqType,

    @Req() req: Request,
  ) {
    return await this.galleriesService.galleryViewUpdate({
      galleryViewId,
      gallery: body,
      req,
    });
  }
}
