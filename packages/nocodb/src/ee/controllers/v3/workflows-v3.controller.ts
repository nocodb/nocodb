import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  WorkflowExecutionV3GetResponseType,
  WorkflowExecutionV3ListResponseType,
  // WorkflowNodeV3CreateReqType,
  WorkflowNodeV3ListResponseType,
  WorkflowNodeV3ResponseType,
  WorkflowV3GetResponseType,
  WorkflowV3ListResponseType,
} from '~/services/v3/workflows-v3.types';
import {
  // WorkflowNodeV3UpdateReqType,
  WorkflowV3CreateReqType,
  WorkflowV3ExecuteReqType,
  // WorkflowV3TestNodeReqType,
  WorkflowV3UpdateReqType,
} from '~/services/v3/workflows-v3.types';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { WorkflowsV3Service } from '~/services/v3/workflows-v3.service';
import { PREFIX_APIV3_METABASE } from '~/constants/controllers';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class WorkflowsV3Controller {
  constructor(private readonly workflowsV3Service: WorkflowsV3Service) {}

  @Get(`${PREFIX_APIV3_METABASE}/workflows`)
  @Acl('workflowList', { scope: 'base' })
  async workflowList(
    @TenantContext() context: NcContext,
  ): Promise<WorkflowV3ListResponseType> {
    return await this.workflowsV3Service.workflowList(context);
  }

  @Get(`${PREFIX_APIV3_METABASE}/workflows/:workflowId`)
  @Acl('workflowGet', { scope: 'base' })
  async workflowGet(
    @TenantContext() context: NcContext,
    @Param('workflowId') workflowId: string,
  ): Promise<WorkflowV3GetResponseType> {
    return await this.workflowsV3Service.workflowGet(context, workflowId);
  }

  // TODO: to enable after having better flow
  // @Post(`${PREFIX_APIV3_METABASE}/workflows`)
  // @HttpCode(200)
  // @Acl('workflowCreate', { scope: 'base' })
  // async workflowCreate(
  //   @TenantContext() context: NcContext,
  //   @Body() body: WorkflowV3CreateReqType,
  //   @Request() req: NcRequest,
  // ): Promise<WorkflowV3GetResponseType> {
  //   return await this.workflowsV3Service.workflowCreate(context, body, req);
  // }

  // @Patch(`${PREFIX_APIV3_METABASE}/workflows/:workflowId`)
  // @Acl('workflowUpdate', { scope: 'base' })
  // async workflowUpdate(
  //   @TenantContext() context: NcContext,
  //   @Param('workflowId') workflowId: string,
  //   @Body() body: WorkflowV3UpdateReqType,
  //   @Request() req: NcRequest,
  // ): Promise<WorkflowV3GetResponseType> {
  //   return await this.workflowsV3Service.workflowUpdate(
  //     context,
  //     workflowId,
  //     body,
  //     req,
  //   );
  // }

  // @Delete(`${PREFIX_APIV3_METABASE}/workflows/:workflowId`)
  // @Acl('workflowDelete', { scope: 'base' })
  // async workflowDelete(
  //   @TenantContext() context: NcContext,
  //   @Param('workflowId') workflowId: string,
  //   @Request() req: NcRequest,
  // ): Promise<boolean> {
  //   return await this.workflowsV3Service.workflowDelete(
  //     context,
  //     workflowId,
  //     req,
  //   );
  // }

  // @Post(`${PREFIX_APIV3_METABASE}/workflows/:workflowId/publish`)
  // @HttpCode(200)
  // @Acl('workflowPublish', { scope: 'base' })
  // async workflowPublish(
  //   @TenantContext() context: NcContext,
  //   @Param('workflowId') workflowId: string,
  //   @Request() req: NcRequest,
  // ): Promise<WorkflowV3GetResponseType> {
  //   return await this.workflowsV3Service.workflowPublish(
  //     context,
  //     workflowId,
  //     req,
  //   );
  // }

  @Post(`${PREFIX_APIV3_METABASE}/workflows/:workflowId/execute`)
  @HttpCode(200)
  @Acl('workflowExecute', { scope: 'base' })
  async workflowExecute(
    @TenantContext() context: NcContext,
    @Param('workflowId') workflowId: string,
    @Body() body: WorkflowV3ExecuteReqType,
    @Request() req: NcRequest,
  ): Promise<{ id: string }> {
    return await this.workflowsV3Service.workflowExecute(
      context,
      workflowId,
      body,
      req,
    );
  }

  // TODO: need to improve validation & flow first
  // @Post(`${PREFIX_APIV3_METABASE}/workflows/:workflowId/test-node`)
  // @HttpCode(200)
  // @Acl('workflowTestNode', { scope: 'base' })
  // async workflowTestNode(
  //   @TenantContext() context: NcContext,
  //   @Param('workflowId') workflowId: string,
  //   @Body() body: WorkflowV3TestNodeReqType,
  //   @Request() req: NcRequest,
  // ): Promise<{ id: string }> {
  //   return await this.workflowsV3Service.workflowTestNode(
  //     context,
  //     workflowId,
  //     body,
  //     req,
  //   );
  // }

  @Get(`${PREFIX_APIV3_METABASE}/workflows/:workflowId/executions`)
  @Acl('workflowExecutionList', { scope: 'base' })
  async workflowExecutionList(
    @TenantContext() context: NcContext,
    @Param('workflowId') workflowId: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
  ): Promise<WorkflowExecutionV3ListResponseType> {
    return await this.workflowsV3Service.workflowExecutionList(
      context,
      workflowId,
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
    );
  }

  @Get(`${PREFIX_APIV3_METABASE}/workflows/:workflowId/executions/:executionId`)
  @Acl('workflowExecutionGet', { scope: 'base' })
  async workflowExecutionGet(
    @TenantContext() context: NcContext,
    @Param('workflowId') workflowId: string,
    @Param('executionId') executionId: string,
  ): Promise<WorkflowExecutionV3GetResponseType> {
    return await this.workflowsV3Service.workflowExecutionGet(
      context,
      workflowId,
      executionId,
    );
  }

  // --- Node CRUD routes ---

  @Get(`${PREFIX_APIV3_METABASE}/workflows/:workflowId/nodes`)
  @Acl('workflowGet', { scope: 'base' })
  async workflowNodeList(
    @TenantContext() context: NcContext,
    @Param('workflowId') workflowId: string,
  ): Promise<WorkflowNodeV3ListResponseType> {
    return await this.workflowsV3Service.workflowNodeList(context, workflowId);
  }

  @Get(`${PREFIX_APIV3_METABASE}/workflows/:workflowId/nodes/:nodeId`)
  @Acl('workflowGet', { scope: 'base' })
  async workflowNodeGet(
    @TenantContext() context: NcContext,
    @Param('workflowId') workflowId: string,
    @Param('nodeId') nodeId: string,
  ): Promise<WorkflowNodeV3ResponseType> {
    return await this.workflowsV3Service.workflowNodeGet(
      context,
      workflowId,
      nodeId,
    );
  }

  // TODO: need to improve validation & flow first
  // @Post(`${PREFIX_APIV3_METABASE}/workflows/:workflowId/nodes`)
  // @HttpCode(200)
  // @Acl('workflowUpdate', { scope: 'base' })
  // async workflowNodeCreate(
  //   @TenantContext() context: NcContext,
  //   @Param('workflowId') workflowId: string,
  //   @Body() body: WorkflowNodeV3CreateReqType,
  //   @Request() req: NcRequest,
  // ): Promise<WorkflowNodeV3ResponseType> {
  //   return await this.workflowsV3Service.workflowNodeCreate(
  //     context,
  //     workflowId,
  //     body,
  //     req,
  //   );
  // }

  // TODO: need to improve validation & flow first
  // @Patch(`${PREFIX_APIV3_METABASE}/workflows/:workflowId/nodes/:nodeId`)
  // @Acl('workflowUpdate', { scope: 'base' })
  // async workflowNodeUpdate(
  //   @TenantContext() context: NcContext,
  //   @Param('workflowId') workflowId: string,
  //   @Param('nodeId') nodeId: string,
  //   @Body() body: WorkflowNodeV3UpdateReqType,
  //   @Request() req: NcRequest,
  // ): Promise<WorkflowNodeV3ResponseType> {
  //   return await this.workflowsV3Service.workflowNodeUpdate(
  //     context,
  //     workflowId,
  //     nodeId,
  //     body,
  //     req,
  //   );
  // }

  // TODO: need to improve validation & flow first
  // @Delete(`${PREFIX_APIV3_METABASE}/workflows/:workflowId/nodes/:nodeId`)
  // @Acl('workflowUpdate', { scope: 'base' })
  // async workflowNodeDelete(
  //   @TenantContext() context: NcContext,
  //   @Param('workflowId') workflowId: string,
  //   @Param('nodeId') nodeId: string,
  //   @Request() req: NcRequest,
  // ): Promise<boolean> {
  //   return await this.workflowsV3Service.workflowNodeDelete(
  //     context,
  //     workflowId,
  //     nodeId,
  //     req,
  //   );
  // }
}
