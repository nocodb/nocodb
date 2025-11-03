import { Injectable } from '@nestjs/common';
import { AppEvents, type AutomationType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Automation } from '~/models';

@Injectable()
export class AutomationsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async list(context: NcContext) {
    return await Automation.list(context, context.base_id);
  }

  async get(context: NcContext, automationId: string) {
    const automation = await Automation.get(context, automationId);

    if (!automation) {
      NcError.notFound('Automation not found');
    }

    return automation;
  }

  async create(
    context: NcContext,
    automationBody: Partial<AutomationType>,
    req: NcRequest,
  ) {
    automationBody.title = automationBody.title?.trim();

    const automation = await Automation.insert(context, {
      ...automationBody,
      base_id: context.base_id,
      fk_workspace_id: context.workspace_id,
    });

    this.appHooksService.emit(AppEvents.AUTOMATION_CREATE, {
      automation,
      req,
      context,
      user: req.user,
    });

    return automation;
  }

  async update(
    context: NcContext,
    automationId: string,
    automationBody: Partial<AutomationType>,
    req: NcRequest,
  ) {
    const automation = await Automation.get(context, automationId);

    if (!automation) {
      NcError.genericNotFound('Automation', automationId);
    }

    if (automationBody.title) {
      automationBody.title = automationBody.title.trim();
    }

    const updatedAutomation = await Automation.update(
      context,
      automationId,
      automationBody,
    );

    this.appHooksService.emit(AppEvents.AUTOMATION_UPDATE, {
      automation: updatedAutomation,
      oldAutomation: automation,
      context,
      user: req.user,
      req,
    });

    return updatedAutomation;
  }

  async delete(context: NcContext, automationId: string, req: NcRequest) {
    const automation = await Automation.get(context, automationId);

    if (!automation) {
      NcError.notFound('Automation not found');
    }

    await Automation.delete(context, automationId);

    this.appHooksService.emit(AppEvents.AUTOMATION_DELETE, {
      automation,
      context,
      req,
      user: req.user,
    });

    return { msg: 'Automation deleted successfully' };
  }
}
