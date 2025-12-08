import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { NcRequest } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcError } from '~/helpers/catchError';
import { WorkflowsService } from '~/services/workflows.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class WorkflowWebhookController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post('/api/v3/workflows/:workspaceId/:baseId/:workflowId/:triggerId/webhook')
  async handleWorkflowTrigger(
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Param('workflowId') workflowId: string,
    @Param('triggerId') triggerId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    if (!triggerId) {
      NcError.badRequest('Trigger ID is required');
    }

    // Validate triggerId format (should be trg_<nanoid>)
    if (!triggerId.startsWith('trg_')) {
      NcError.badRequest('Invalid trigger ID format');
    }

    return await this.workflowsService.handleWebhookTrigger(
      {
        workspace_id: workspaceId,
        base_id: baseId,
      },
      {
        workflowId,
        triggerId,
        req,
      },
    );
  }
}
