import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SortReqType } from 'nocodb-sdk';
import { GlobalGuard } from '../../guards/global/global.guard';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import {
  ExtractProjectIdMiddleware,
  UseAclMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { SortsService } from './sorts.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class SortsController {
  constructor(private readonly sortsService: SortsService) {}

  @Get('/api/v1/db/meta/views/:viewId/sorts/')
  @UseAclMiddleware({
    permissionName: 'sortList',
  })
  async sortList(@Param('viewId') viewId: string) {
    return new PagedResponseImpl(
      await this.sortsService.sortList({
        viewId,
      }),
    );
  }

  @Post('/api/v1/db/meta/views/:viewId/sorts/')
  @HttpCode(200)
  @UseAclMiddleware({
    permissionName: 'sortCreate',
  })
  async sortCreate(@Param('viewId') viewId: string, @Body() body: SortReqType) {
    const sort = await this.sortsService.sortCreate({
      sort: body,
      viewId,
    });
    return sort;
  }

  @Get('/api/v1/db/meta/sorts/:sortId')
  @UseAclMiddleware({
    permissionName: 'sortGet',
  })
  async sortGet(@Param('sortId') sortId: string) {
    const sort = await this.sortsService.sortGet({
      sortId,
    });
    return sort;
  }

  @Patch('/api/v1/db/meta/sorts/:sortId')
  @UseAclMiddleware({
    permissionName: 'sortUpdate',
  })
  async sortUpdate(@Param('sortId') sortId: string, @Body() body: SortReqType) {
    const sort = await this.sortsService.sortUpdate({
      sortId,
      sort: body,
    });
    return sort;
  }

  @Delete('/api/v1/db/meta/sorts/:sortId')
  async sortDelete(@Param('sortId') sortId: string) {
    const sort = await this.sortsService.sortDelete({
      sortId,
    });
    return sort;
  }
}
