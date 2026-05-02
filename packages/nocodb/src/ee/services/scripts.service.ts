import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  ButtonActionsType,
  EventType,
  PlanLimitTypes,
} from 'nocodb-sdk';
import type { ScriptType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { OperationName } from '~/command-registry/op-names';
import { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import NocoSocket from '~/socket/NocoSocket';
import { ButtonColumn, Script, Workspace } from '~/models';
import { checkLimit } from '~/helpers/paymentHelpers';
import { TraceCommand } from '~/decorators/trace-command.decorator';
@Injectable()
export class ScriptsService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly baseTrashService: BaseTrashService,
  ) {}

  async listScripts(context: NcContext) {
    return await Script.list(context, context.base_id);
  }

  async getScript(context: NcContext, scriptId: string) {
    const script = await Script.get(context, scriptId);

    if (!script) {
      return NcError.get(context).scriptNotFound(scriptId);
    }

    return script;
  }

  @TraceCommand(OperationName.scriptCreate)
  async createScript(
    context: NcContext,
    param: { body: Partial<ScriptType>; req: NcRequest },
  ) {
    const { body: scriptBody, req } = param;
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const workspace = await Workspace.get(context.workspace_id);

    await checkLimit({
      workspace,
      type: PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE,
      message: ({ limit }) =>
        `You have reached the limit of ${limit} scripts for your plan.`,
    });

    scriptBody.title = scriptBody.title?.trim();

    const script = await Script.insert(context, context.base_id, {
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

  @TraceCommand(OperationName.scriptUpdate)
  async updateScript(
    context: NcContext,
    param: {
      scriptId: string;
      body: Pick<ScriptType, 'title'>;
      req: NcRequest;
    },
  ) {
    const { scriptId, body, req } = param;
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const script = await Script.get(context, scriptId);

    if (!script) {
      return NcError.get(context).scriptNotFound(scriptId);
    }

    body.title = body.title?.trim();

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

  @TraceCommand(OperationName.scriptDelete)
  async deleteScript(
    context: NcContext,
    param: { scriptId: string; req: NcRequest; ncMeta?: MetaService },
  ) {
    const { scriptId, req, ncMeta } = param;
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const script = await Script.get(context, scriptId, false, ncMeta);

    if (!script) {
      return NcError.get(context).scriptNotFound(scriptId);
    }

    // Detach button columns before trashing
    const buttonCols = await ButtonColumn.buttonUsages(
      context,
      scriptId,
      ncMeta,
    );

    if (buttonCols.length) {
      for (const button of buttonCols) {
        await ButtonColumn.update(
          context,
          button.fk_column_id,
          {
            fk_script_id: null,
            type: ButtonActionsType.Script,
            error: 'Script has been moved to trash',
          },
          ncMeta,
        );
      }
    }

    await this.baseTrashService.trashResource(context, {
      resourceId: scriptId,
      resourceType: 'script',
      user: req.user,
      req,
      ncMeta,
    });

    this.appHooksService.emit(AppEvents.SCRIPT_DELETE, {
      script,
      context,
      req,
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
      return NcError.get(context).scriptNotFound(scriptId);
    }

    await checkLimit({
      workspaceId: context.workspace_id,
      type: PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE,
      message: ({ limit }) =>
        `You have reached the limit of ${limit} scripts for your plan.`,
    });

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
}
