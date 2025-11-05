import { Injectable } from '@nestjs/common';
import { AppEvents, type WorkflowType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Workflow } from '~/models';

@Injectable()
export class WorkflowsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async list(context: NcContext) {
    return await Workflow.list(context, context.base_id);
  }

  async get(context: NcContext, workflowId: string) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.notFound('Workflow not found');
    }

    return workflow;
  }

  async create(
    context: NcContext,
    workflowBody: Partial<WorkflowType>,
    req: NcRequest,
  ) {
    workflowBody.title = workflowBody.title?.trim();

    const workflow = await Workflow.insert(context, {
      ...workflowBody,
      base_id: context.base_id,
      fk_workspace_id: context.workspace_id,
    });

    this.appHooksService.emit(AppEvents.WORKFLOW_CREATE, {
      workflow,
      req,
      context,
      user: req.user,
    });

    return workflow;
  }

  async update(
    context: NcContext,
    workflowId: string,
    workflowBody: Partial<WorkflowType>,
    req: NcRequest,
  ) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.genericNotFound('Workflow', workflowId);
    }

    if (workflowBody.title) {
      workflowBody.title = workflowBody.title.trim();
    }

    const updatedWorkflow = await Workflow.update(
      context,
      workflowId,
      workflowBody,
    );

    this.appHooksService.emit(AppEvents.WORKFLOW_UPDATE, {
      workflow: updatedWorkflow,
      oldWorkflow: workflow,
      context,
      user: req.user,
      req,
    });

    return updatedWorkflow;
  }

  async delete(context: NcContext, workflowId: string, req: NcRequest) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.notFound('Workflow not found');
    }

    await Workflow.delete(context, workflowId);

    this.appHooksService.emit(AppEvents.WORKFLOW_DELETE, {
      workflow,
      context,
      req,
      user: req.user,
    });

    return { msg: 'Workflow deleted successfully' };
  }
}
