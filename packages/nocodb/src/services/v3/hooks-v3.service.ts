import { Injectable } from '@nestjs/common';
import type { HookV3CreateV3Type, HookV3UpdateV3Type } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Hook } from '~/models';
import { HooksService } from '~/services/hooks.service';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';

@Injectable()
export class HooksV3Service {
  // Response builder: transforms internal Hook model to V3 API response format
  protected builder = builderGenerator<Hook>({
    allowed: [
      'id',
      'fk_model_id',
      'title',
      'description',
      'event',
      'operation',
      'notification',
      'active',
      'async',
      'version',
      'trigger_fields',
      'created_at',
      'updated_at',
    ],
    mappings: {
      fk_model_id: 'table_id',
    },
    meta: {
      snakeCase: true,
      metaProps: ['notification'],
    },
  });

  // Request builder: transforms V3 API request format to internal Hook model format
  protected requestBuilder = builderGenerator<
    HookV3CreateV3Type | HookV3UpdateV3Type
  >({
    allowed: [
      'title',
      'description',
      'event',
      'operation',
      'notification',
      'active',
      'async',
      'version',
      'trigger_fields',
      'table_id',
    ],
    mappings: {
      table_id: 'fk_model_id',
    },
    meta: {
      snakeCase: true,
      metaProps: ['notification'],
    },
  });

  constructor(protected readonly hooksService: HooksService) {}

  async hookList(context: NcContext, param: { tableId: string }) {
    const list = await Hook.list(context, { fk_model_id: param.tableId });

    return this.builder().build(list);
  }

  async hookGet(context: NcContext, param: { hookId: string }) {
    const hook = await Hook.get(context, param.hookId);

    return this.builder().build(hook);
  }

  async hookCreate(
    context: NcContext,
    param: {
      tableId: string;
      hook: HookV3CreateV3Type;
      req: NcRequest;
    },
  ) {
    // Transform V3 request to internal format
    const hookData = this.requestBuilder().build(param.hook);

    const hook = await this.hooksService.hookCreate(context, {
      tableId: param.tableId,
      hook: hookData as any,
      req: param.req,
    });

    return this.builder().build(hook);
  }

  async hookUpdate(
    context: NcContext,
    param: {
      hookId: string;
      hook: HookV3UpdateV3Type;
      req: NcRequest;
    },
  ) {
    // Transform V3 request to internal format
    const hookData = this.requestBuilder().build(param.hook);

    const hook = await this.hooksService.hookUpdate(context, {
      hookId: param.hookId,
      hook: hookData as any,
      req: param.req,
    });

    return this.builder().build(hook);
  }

  async hookDelete(
    context: NcContext,
    param: { hookId: string; req: NcRequest },
  ) {
    return await this.hooksService.hookDelete(context, param);
  }
}
