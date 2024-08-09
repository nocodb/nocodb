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
import { HookReqType, HookTestReqType } from 'nocodb-sdk';
import type { HookType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { HooksService } from '~/services/hooks.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class HooksController {
  constructor(private readonly hooksService: HooksService) {}

  @Get([
    '/api/v1/db/meta/tables/:tableId/hooks',
    '/api/v2/meta/tables/:tableId/hooks',
  ])
  @Acl('hookList')
  async hookList(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
  ) {
    return new PagedResponseImpl(
      await this.hooksService.hookList(context, { tableId }),
    );
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/hooks',
    '/api/v2/meta/tables/:tableId/hooks',
  ])
  @HttpCode(200)
  @Acl('hookCreate')
  async hookCreate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: HookReqType,
    @Req() req: NcRequest,
  ) {
    const hook = await this.hooksService.hookCreate(context, {
      hook: body,
      tableId,
      req,
    });
    return hook;
  }

  @Delete(['/api/v1/db/meta/hooks/:hookId', '/api/v2/meta/hooks/:hookId'])
  @Acl('hookDelete')
  async hookDelete(
    @TenantContext() context: NcContext,
    @Param('hookId') hookId: string,
    @Req() req: NcRequest,
  ) {
    return await this.hooksService.hookDelete(context, { hookId, req });
  }

  @Patch(['/api/v1/db/meta/hooks/:hookId', '/api/v2/meta/hooks/:hookId'])
  @Acl('hookUpdate')
  async hookUpdate(
    @TenantContext() context: NcContext,
    @Param('hookId') hookId: string,
    @Body() body: HookReqType,
    @Req() req: NcRequest,
  ) {
    return await this.hooksService.hookUpdate(context, {
      hookId,
      hook: body,
      req,
    });
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/hooks/test',
    '/api/v2/meta/tables/:tableId/hooks/test',
  ])
  @HttpCode(200)
  @Acl('hookTest')
  async hookTest(
    @TenantContext() context: NcContext,
    @Body() body: HookTestReqType,
    @Req() req: NcRequest,
  ) {
    try {
      await this.hooksService.hookTest(context, {
        hookTest: {
          ...body,
          payload: {
            ...body.payload,
            user: (req as any)?.user,
          },
        },
        tableId: req.params.tableId,
        req,
      });
      return { msg: 'The hook has been tested successfully' };
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Get([
    '/api/v1/db/meta/tables/:tableId/hooks/samplePayload/:operation/:version',
    '/api/v2/meta/tables/:tableId/hooks/samplePayload/:operation/:version',
  ])
  @Acl('tableSampleData')
  async tableSampleData(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Param('operation') operation: HookType['operation'],
    @Param('version') version: HookType['version'],
  ) {
    return await this.hooksService.tableSampleData(context, {
      tableId,
      operation,
      version,
    });
  }

  @Get([
    '/api/v1/db/meta/hooks/:hookId/logs',
    '/api/v2/meta/hooks/:hookId/logs',
  ])
  @Acl('hookLogList')
  async hookLogList(
    @TenantContext() context: NcContext,
    @Param('hookId') hookId: string,
    @Req() req: NcRequest,
  ) {
    return new PagedResponseImpl(
      await this.hooksService.hookLogList(context, {
        query: req.query,
        hookId,
      }),
      {
        ...req.query,
        count: await this.hooksService.hookLogCount(context, {
          hookId,
        }),
      },
    );
  }

  @Post(['/api/v2/meta/hooks/:hookId/trigger/:rowId'])
  @Acl('hookTrigger')
  async hookTrigger(
    @TenantContext() context: NcContext,
    @Param('hookId') hookId: string,
    @Param('rowId') rowId: string,
    @Req() req: NcRequest,
  ) {
    return await this.hooksService.hookTrigger(context, {
      hookId,
      req,
      rowId,
    });
  }
}
