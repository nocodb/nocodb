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

@Controller()
@UseGuards(GlobalGuard)
export class GalleriesController {
  constructor(private readonly galleriesService: GalleriesService) {}

  @Get([
    '/api/v1/db/meta/galleries/:galleryViewId',
    '/api/v1/meta/galleries/:galleryViewId',
  ])
  @Acl('galleryViewGet')
  async galleryViewGet(@Param('galleryViewId') galleryViewId: string) {
    return await this.galleriesService.galleryViewGet({
      galleryViewId,
    });
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/galleries',
    '/api/v1/meta/tables/:tableId/galleries',
  ])
  @HttpCode(200)
  @Acl('galleryViewCreate')
  async galleryViewCreate(
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: any,
  ) {
    return await this.galleriesService.galleryViewCreate({
      gallery: body,
      // todo: sanitize
      tableId,
      user: req.user,
    });
  }

  @Patch([
    '/api/v1/db/meta/galleries/:galleryViewId',
    '/api/v1/meta/galleries/:galleryViewId',
  ])
  @Acl('galleryViewUpdate')
  async galleryViewUpdate(
    @Param('galleryViewId') galleryViewId: string,
    @Body() body: GalleryUpdateReqType,
  ) {
    return await this.galleriesService.galleryViewUpdate({
      galleryViewId,
      gallery: body,
    });
  }
}
