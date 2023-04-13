import {
  Body,
  Controller,
  Get, HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { GalleryUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import { GlobalGuard } from '../../guards/global/global.guard'
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { GalleriesService } from './galleries.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware,GlobalGuard)
export class GalleriesController {
  constructor(private readonly galleriesService: GalleriesService) {}

  @Get('/api/v1/db/meta/galleries/:galleryViewId')
  @Acl('galleryViewGet')
  async galleryViewGet(@Param('galleryViewId') galleryViewId: string) {
    return await this.galleriesService.galleryViewGet({
      galleryViewId,
    });
  }

  @Post('/api/v1/db/meta/tables/:tableId/galleries')
  @HttpCode(200)
  @Acl('galleryViewCreate')
  async galleryViewCreate(
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
  ) {
    return await this.galleriesService.galleryViewCreate({
      gallery: body,
      // todo: sanitize
      tableId,
    });
  }

  @Patch('/api/v1/db/meta/galleries/:galleryViewId')
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
