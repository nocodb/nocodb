import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  ScriptV3GetResponseType,
  ScriptV3ListResponseType,
  ScriptV3RequestType,
} from '~/services/v3/scripts-v3.types';
import type { Script } from '~/models';
import { ScriptsService } from '~/services/scripts.service';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';
import { validatePayload } from '~/helpers';

const scriptBuilder = builderGenerator<Script, ScriptV3GetResponseType>({
  allowed: [
    'id',
    'title',
    'description',
    'base_id',
    'fk_workspace_id',
    'script',
    'config',
    'meta',
    'created_at',
    'updated_at',
  ],
  mappings: {
    fk_workspace_id: 'workspace_id',
  },
});

const scriptListItemBuilder = builderGenerator<
  Script,
  ScriptV3ListResponseType['list']
>({
  allowed: ['id', 'title', 'description', 'base_id', 'fk_workspace_id'],
  mappings: {
    fk_workspace_id: 'workspace_id',
  },
});

@Injectable()
export class ScriptsV3Service {
  constructor(private readonly scriptsService: ScriptsService) {}

  async scriptList(context: NcContext): Promise<ScriptV3ListResponseType> {
    const scripts = await this.scriptsService.listScripts(context);

    return {
      list: scriptListItemBuilder().build(scripts),
    };
  }

  async scriptGet(
    context: NcContext,
    id: string,
  ): Promise<ScriptV3GetResponseType> {
    const script = await this.scriptsService.getScript(context, id);
    return scriptBuilder().build(script);
  }

  async scriptCreate(
    context: NcContext,
    body: ScriptV3RequestType,
    req: NcRequest,
  ): Promise<ScriptV3GetResponseType> {
    validatePayload(
      'swagger-v3.json#/components/schemas/ScriptCreateReq',
      body,
      true,
      context,
    );
    const script = await this.scriptsService.createScript(context, body, req);
    return scriptBuilder().build(script);
  }

  async scriptUpdate(
    context: NcContext,
    id: string,
    body: ScriptV3RequestType,
    req: NcRequest,
  ): Promise<ScriptV3GetResponseType> {
    validatePayload(
      'swagger-v3.json#/components/schemas/ScriptUpdateReq',
      body,
      true,
      context,
    );
    const script = await this.scriptsService.updateScript(
      context,
      id,
      body,
      req,
    );
    return scriptBuilder().build(script);
  }

  async scriptDelete(
    context: NcContext,
    id: string,
    req: NcRequest,
  ): Promise<boolean> {
    return await this.scriptsService.deleteScript(context, id, req);
  }
}
