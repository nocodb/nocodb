import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { BaseReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { populateMeta, validatePayload } from '~/helpers';
import { populateRollupColumnAndHideLTAR } from '~/helpers/populateMeta';
import { syncBaseMigration } from '~/helpers/syncMigration';
import { Base, Source } from '~/models';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class SourcesService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async baseGetWithConfig(context: NcContext, param: { sourceId: any }) {
    const source = await Source.get(context, param.sourceId);

    source.config = await source.getConnectionConfig();

    return source;
  }

  async baseUpdate(
    context: NcContext,
    param: {
      sourceId: string;
      source: BaseReqType;
      baseId: string;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/BaseReq', param.source);

    const baseBody = param.source;
    const base = await Base.getWithInfo(context, param.baseId);
    const source = await Source.updateBase(context, param.sourceId, {
      ...baseBody,
      type: baseBody.config?.client,
      baseId: base.id,
      id: param.sourceId,
    });

    delete source.config;

    this.appHooksService.emit(AppEvents.BASE_UPDATE, {
      source,
      req: param.req,
    });

    return source;
  }

  async baseList(context: NcContext, param: { baseId: string }) {
    const sources = await Source.list(context, { baseId: param.baseId });

    return sources;
  }

  async baseDelete(context: NcContext, param: { sourceId: string; req: any }) {
    try {
      const source = await Source.get(context, param.sourceId, true);
      await source.delete(context);
      this.appHooksService.emit(AppEvents.BASE_DELETE, {
        source,
        req: param.req,
      });
    } catch (e) {
      NcError.badRequest(e);
    }
    return true;
  }

  async baseSoftDelete(context: NcContext, param: { sourceId: string }) {
    try {
      const source = await Source.get(context, param.sourceId);
      await source.softDelete(context);
    } catch (e) {
      NcError.badRequest(e);
    }
    return true;
  }

  async baseCreate(
    context: NcContext,
    param: {
      baseId: string;
      source: BaseReqType;
      logger?: (message: string) => void;
      req: any;
    },
  ): Promise<{
    source: Source;
    error?: any;
  }> {
    validatePayload('swagger.json#/components/schemas/BaseReq', param.source);

    // type | base | baseId
    const baseBody = param.source;
    const base = await Base.getWithInfo(context, param.baseId);

    let error;

    param.logger?.('Creating the source');

    const source = await Source.createBase(context, {
      ...baseBody,
      type: baseBody.config?.client,
      baseId: base.id,
    });

    try {
      await syncBaseMigration(base, source);

      param.logger?.('Populating meta');

      const info = await populateMeta(context, source, base, param.logger);

      await populateRollupColumnAndHideLTAR(context, source, base);

      this.appHooksService.emit(AppEvents.APIS_CREATED, {
        info,
        req: param.req,
      });

      delete source.config;

      this.appHooksService.emit(AppEvents.BASE_CREATE, {
        source,
        req: param.req,
      });
    } catch (e) {
      error = e;
    }

    return { source, error };
  }
}
