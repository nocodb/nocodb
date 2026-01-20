import {
  All,
  Body,
  Controller,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NcApiVersion, NcContext } from 'nocodb-sdk';
import { NcRequest } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcError } from '~/helpers/catchError';
import { WorkflowsService } from '~/services/workflows.service';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class WorkflowWebhookController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @All('/api/v3/workflows/:workspaceId/:baseId/:workflowId/:triggerId/webhook')
  async handleWorkflowTrigger(
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Param('workflowId') workflowId: string,
    @Param('triggerId') triggerId: string,
    @Body() body: any,
    @Query() query: any,
    @Req() req: NcRequest,
  ) {

    const context: NcContext = {
      workspace_id: workspaceId,
      base_id: baseId,
      api_version: NcApiVersion.V3
    };

    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    if (!allowedMethods.includes(req.method)) {
      NcError.get(context).methodNotAllowed(`Method ${req.method} not allowed`);
    }

    // Validate triggerId format (should be trg_<nanoid>)
    if (!triggerId.startsWith('trg_')) {
      NcError.badRequest('Invalid trigger ID format');
    }

    // Check if there's an active test listener for this trigger
    const testListenerKey = `${CacheScope.WORKFLOW_WEBHOOK_TEST_LISTENER}:${workflowId}:${triggerId}`;
    const listenerData = await NocoCache.get(
      context,
      testListenerKey,
      CacheGetType.TYPE_OBJECT,
    );

    if (listenerData && listenerData.status === 'listening') {
      const headers: Record<string, string | string[]> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          headers[key] = value as string | string[];
        }
      }

      // Update cache with received webhook data
      await NocoCache.setExpiring(
        context,
        testListenerKey,
        {
          status: 'received',
          workflowId: listenerData.workflowId,
          nodeId: listenerData.nodeId,
          triggerId: listenerData.triggerId,
          body: body || {},
          headers,
          query: query || {},
          method: req.method,
          receivedAt: Date.now(),
        },
        60,
      );

      return {
        success: true,
      };
    }

    // No active test listener - handle as production webhook
    return await this.workflowsService.handleWebhookTrigger(context, {
      workflowId,
      triggerId,
      req,
    });
  }
}
