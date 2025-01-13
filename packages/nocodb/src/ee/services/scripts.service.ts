import { Injectable } from '@nestjs/common';
import type { ScriptType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import Script from '~/models/Script';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ScriptsService {
  constructor() {}

  async listScripts(context: NcContext, baseId: string) {
    const scripts = await Script.list(context, baseId);
    return scripts;
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
    return script;
  }

  async updateScript(
    context: NcContext,
    scriptId: string,
    body: Pick<ScriptType, 'title'>,
  ) {
    const script = await Script.get(context, scriptId);

    if (!script) {
      return NcError.notFound('Script not found');
    }

    return await Script.update(context, scriptId, body);
  }

  async deleteScript(context: NcContext, scriptId: string) {
    const script = await Script.get(context, scriptId);

    if (!script) {
      return NcError.notFound('Script not found');
    }

    await Script.delete(context, scriptId);

    return true;
  }
}
