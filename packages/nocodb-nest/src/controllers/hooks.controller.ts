import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { HookReqType, HookTestReqType } from 'nocodb-sdk';
import { GlobalGuard } from '../guards/global/global.guard';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../middlewares/extract-project-id/extract-project-id.middleware';
import { HooksService } from '../services/hooks.service';
import type { HookType } from 'nocodb-sdk';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class HooksController {
  constructor(private readonly hooksService: HooksService) {}

  @Get('/api/v1/db/meta/tables/:tableId/hooks')
  @Acl('hookList')
  async hookList(@Param('tableId') tableId: string) {
    return new PagedResponseImpl(await this.hooksService.hookList({ tableId }));
  }

  @Post('/api/v1/db/meta/tables/:tableId/hooks')
  @HttpCode(200)
  @Acl('hookCreate')
  async hookCreate(
    @Param('tableId') tableId: string,
    @Body() body: HookReqType,
  ) {
    const hook = await this.hooksService.hookCreate({
      hook: body,
      tableId,
    });
    return hook;
  }

  @Delete('/api/v1/db/meta/hooks/:hookId')
  @Acl('hookDelete')
  async hookDelete(@Param('hookId') hookId: string) {
    return await this.hooksService.hookDelete({ hookId });
  }

  @Patch('/api/v1/db/meta/hooks/:hookId')
  @Acl('hookUpdate')
  async hookUpdate(@Param('hookId') hookId: string, @Body() body: HookReqType) {
    return await this.hooksService.hookUpdate({ hookId, hook: body });
  }

  @Post('/api/v1/db/meta/tables/:tableId/hooks/test')
  @HttpCode(200)
  @Acl('hookTest')
  async hookTest(@Body() body: HookTestReqType, @Request() req: any) {
    try {
      await this.hooksService.hookTest({
        hookTest: {
          ...body,
          payload: {
            ...body.payload,
            user: (req as any)?.user,
          },
        },
        tableId: req.params.tableId,
      });
      return { msg: 'The hook has been tested successfully' };
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Get(
    '/api/v1/db/meta/tables/:tableId/hooks/samplePayload/:operation/:version',
  )
  @Acl('tableSampleData')
  async tableSampleData(
    @Param('tableId') tableId: string,
    @Param('operation') operation: HookType['operation'],
    @Param('version') version: HookType['version'],
  ) {
    return await this.hooksService.tableSampleData({
      tableId,
      operation,
      version,
    });
  }

  @Get('/api/v1/db/meta/hooks/:hookId/logs')
  @Acl('hookLogList')
  async hookLogList(@Param('hookId') hookId: string, @Request() req: any) {
    return new PagedResponseImpl(
      await this.hooksService.hookLogList({
        query: req.query,
        hookId,
      }),
      {
        ...req.query,
        count: await this.hooksService.hookLogCount({
          hookId,
        }),
      },
    );
  }
}
