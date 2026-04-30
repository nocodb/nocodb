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
import type { BookmarkGroupReqType, BookmarkReqType } from 'nocodb-sdk';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { License } from '~/decorators/license.decorator';
import { BookmarkService } from '~/services/bookmark.service';
import type { NcRequest } from '~/interface/config';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
@License(PlanFeatureTypes.FEATURE_EE_CORE)
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}

  @Get('/api/v1/bookmarks')
  @Acl('bookmarkList', { scope: 'org' })
  async bookmarkList(@Req() req: NcRequest) {
    return await this.bookmarkService.bookmarkList({ req });
  }

  @Get('/api/v1/bookmarks/check')
  @Acl('bookmarkCheck', { scope: 'org' })
  async bookmarkCheck(@Req() req: NcRequest) {
    return await this.bookmarkService.bookmarkCheck({ req });
  }

  @Post('/api/v1/bookmarks')
  @HttpCode(200)
  @Acl('bookmarkCreate', { scope: 'org' })
  async bookmarkCreate(@Body() body: BookmarkReqType, @Req() req: NcRequest) {
    return await this.bookmarkService.bookmarkCreate({ body, req });
  }

  @Patch('/api/v1/bookmarks/:bookmarkId')
  @Acl('bookmarkUpdate', { scope: 'org' })
  async bookmarkUpdate(
    @Param('bookmarkId') bookmarkId: string,
    @Body() body: BookmarkReqType,
    @Req() req: NcRequest,
  ) {
    return await this.bookmarkService.bookmarkUpdate({
      bookmarkId,
      body,
      req,
    });
  }

  @Delete('/api/v1/bookmarks/:bookmarkId')
  @Acl('bookmarkDelete', { scope: 'org' })
  async bookmarkDelete(
    @Param('bookmarkId') bookmarkId: string,
    @Req() req: NcRequest,
  ) {
    return await this.bookmarkService.bookmarkDelete({ bookmarkId, req });
  }

  @Get('/api/v1/bookmark-groups')
  @Acl('bookmarkGroupList', { scope: 'org' })
  async bookmarkGroupList(@Req() req: NcRequest) {
    return await this.bookmarkService.bookmarkGroupList({ req });
  }

  @Post('/api/v1/bookmark-groups')
  @HttpCode(200)
  @Acl('bookmarkGroupCreate', { scope: 'org' })
  async bookmarkGroupCreate(
    @Body() body: BookmarkGroupReqType,
    @Req() req: NcRequest,
  ) {
    return await this.bookmarkService.bookmarkGroupCreate({ body, req });
  }

  @Patch('/api/v1/bookmark-groups/:groupId')
  @Acl('bookmarkGroupUpdate', { scope: 'org' })
  async bookmarkGroupUpdate(
    @Param('groupId') groupId: string,
    @Body() body: BookmarkGroupReqType,
    @Req() req: NcRequest,
  ) {
    return await this.bookmarkService.bookmarkGroupUpdate({
      groupId,
      body,
      req,
    });
  }

  @Delete('/api/v1/bookmark-groups/:groupId')
  @Acl('bookmarkGroupDelete', { scope: 'org' })
  async bookmarkGroupDelete(
    @Param('groupId') groupId: string,
    @Req() req: NcRequest,
  ) {
    return await this.bookmarkService.bookmarkGroupDelete({ groupId, req });
  }
}
