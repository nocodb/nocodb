import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { BaseReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { populateMeta, validatePayload } from '~/helpers';
import { populateRollupColumnAndHideLTAR } from '~/helpers/populateMeta';
import { syncBaseMigration } from '~/helpers/syncMigration';
import { Base, Source } from '~/models';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class SourcesService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async baseGetWithConfig(param: { sourceId: any }) {
    const source = await Source.get(param.sourceId);

    source.config = await source.getConnectionConfig();

    return source;
  }

  async baseUpdate(param: {
    sourceId: string;
    source: BaseReqType;
    baseId: string;
    req: NcRequest;
  }) {
    validatePayload('swagger.json#/components/schemas/BaseReq', param.source);

    const baseBody = param.source;
    const base = await Base.getWithInfo(param.baseId);
    const source = await Source.updateBase(param.sourceId, {
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

  async baseList(param: { baseId: string }) {
    const sources = await Source.list({ baseId: param.baseId });

    return sources;
  }

  async baseDelete(param: { sourceId: string; req: NcRequest }) {
    try {
      const source = await Source.get(param.sourceId, true);
      await source.delete();
      this.appHooksService.emit(AppEvents.BASE_DELETE, {
        source,
        req: param.req,
      });
    } catch (e) {
      NcError.badRequest(e);
    }
    return true;
  }

  async baseSoftDelete(param: { sourceId: string }) {
    try {
      const source = await Source.get(param.sourceId);
      await source.softDelete();
    } catch (e) {
      NcError.badRequest(e);
    }
    return true;
  }

  async baseCreate(param: {
    baseId: string;
    source: BaseReqType;
    logger?: (message: string) => void;
    req: NcRequest;
  }) {
    validatePayload('swagger.json#/components/schemas/BaseReq', param.source);

    // type | base | baseId
    const baseBody = param.source;
    const base = await Base.getWithInfo(param.baseId);

    param.logger?.('Creating the source');

    const source = await Source.createBase({
      ...baseBody,
      type: baseBody.config?.client,
      baseId: base.id,
    });

    await syncBaseMigration(base, source);

    param.logger?.('Populating meta');

    const info = await populateMeta(source, base, param.logger);

    await populateRollupColumnAndHideLTAR(source, base);

    this.appHooksService.emit(AppEvents.APIS_CREATED, {
      info,
      req: param.req,
    });

    delete source.config;

    this.appHooksService.emit(AppEvents.BASE_CREATE, {
      source,
      req: param.req,
    });

    return source;
  }
}
