import { Injectable, Inject } from '@nestjs/common';
import { AppEvents, ButtonActionsType, EventType } from 'nocodb-sdk';
import type { ScriptType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import Script from '~/models/Script';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NocoSocket from '~/socket/NocoSocket';
import { ButtonColumn } from '~/models';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
@Injectable()
export class ScriptsService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  async listScripts(context: NcContext, baseId: string) {
    return await Script.list(context, baseId);
  }

  async getScript(context: NcContext, scriptId: string) {
    const script = await Script.get(context, scriptId);

    if (!script) {
      return NcError.notFound('Script not found');
    }

    return script;
  }

  async createScript(
    context: NcContext,
    baseId: string,
    scriptBody: Partial<ScriptType>,
    req: NcRequest,
  ) {
    const script = await Script.insert(context, baseId, {
      ...scriptBody,
      created_by: req.user.id,
    });

    this.appHooksService.emit(AppEvents.SCRIPT_CREATE, {
      script,
      req,
      context,
      user: req.user,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.SCRIPT_EVENT,
        payload: {
          id: script.id,
          action: 'create',
          payload: script,
        },
      },
      context.socket_id,
    );

    return script;
  }

  async updateScript(
    context: NcContext,
    scriptId: string,
    body: Pick<ScriptType, 'title'>,
    req: NcRequest,
  ) {
    const script = await Script.get(context, scriptId);

    if (!script) {
      return NcError.notFound('Script not found');
    }

    const updatedScript = await Script.update(context, scriptId, body);

    this.appHooksService.emit(AppEvents.SCRIPT_UPDATE, {
      script: updatedScript,
      oldScript: script,
      context,
      user: context.user,
      req: req,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.SCRIPT_EVENT,
        payload: {
          id: scriptId,
          action: 'update',
          payload: updatedScript,
        },
      },
      context.socket_id,
    );

    return updatedScript;
  }

  async deleteScript(context: NcContext, scriptId: string, req: NcRequest) {
    const script = await Script.get(context, scriptId);

    if (!script) {
      return NcError.notFound('Script not found');
    }

    const buttonCols = await ButtonColumn.buttonUsages(context, scriptId);

    if (buttonCols.length) {
      for (const button of buttonCols) {
        await ButtonColumn.update(context, button.fk_column_id, {
          fk_script_id: null,
          type: ButtonActionsType.Script,
        });
      }
    }

    await Script.delete(context, scriptId);

    this.appHooksService.emit(AppEvents.SCRIPT_DELETE, {
      script,
      context,
      req: req,
      user: context.user,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.SCRIPT_EVENT,
        payload: {
          id: scriptId,
          action: 'delete',
          payload: script,
        },
      },
      context.socket_id,
    );

    return true;
  }

  async duplicateScript(context: NcContext, scriptId: string, req: NcRequest) {
    const script = await Script.get(context, scriptId);

    if (!script) {
      return NcError.notFound('Script not found');
    }

    const existingScripts = await Script.list(context, script.base_id);

    let newTitle = `Copy of ${script.title}`;
    let counter = 1;

    while (existingScripts.some((s) => s.title === newTitle)) {
      newTitle = `Copy of ${script.title} (${counter})`;
      counter++;
    }

    const newScript = await Script.insert(context, script.base_id, {
      title: newTitle,
      script: script.script,
      meta: script.meta,
      description: script.description,
      created_by: req.user.id,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.SCRIPT_EVENT,
        payload: {
          id: newScript.id,
          action: 'create',
          payload: newScript,
        },
      },
      context.socket_id,
    );

    this.appHooksService.emit(AppEvents.SCRIPT_DUPLICATE, {
      sourceScript: script,
      destScript: newScript,
      context,
      req: req,
      user: context.user,
    });

    return newScript;
  }

  async executeScript(
    context: NcContext,
    req: NcRequest,
    scriptId: string,
    rowId?: string,
    tableId?: string,
    viewId?: string,
  ) {
    const script = await Script.get(context, scriptId);

    if (!script) {
      return NcError.notFound('Script not found');
    }

    const job = await this.jobsService.add(JobTypes.ExecuteScript, {
      context,
      scriptId,
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
        ncSiteUrl: req.ncSiteUrl,
      },
      rowId,
      tableId,
      viewId,
    });

    return {
      id: job.id,
      name: job.name,
    };
  }
}
