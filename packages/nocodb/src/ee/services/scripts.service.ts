import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { ScriptType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import Script from '~/models/Script';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class ScriptsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

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

    return updatedScript;
  }

  async deleteScript(context: NcContext, scriptId: string, req: NcRequest) {
    const script = await Script.get(context, scriptId);

    if (!script) {
      return NcError.notFound('Script not found');
    }

    await Script.delete(context, scriptId);

    this.appHooksService.emit(AppEvents.SCRIPT_DELETE, {
      script,
      context,
      req: req,
      user: context.user,
    });

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
      description: script.description,
      created_by: req.user.id,
    });

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
