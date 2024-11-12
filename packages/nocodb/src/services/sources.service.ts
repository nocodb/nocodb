import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  IntegrationsType,
  validateAndExtractSSLProp,
} from 'nocodb-sdk';
import type { BaseReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { populateMeta, validatePayload } from '~/helpers';
import { populateRollupColumnAndHideLTAR } from '~/helpers/populateMeta';
import { syncBaseMigration } from '~/helpers/syncMigration';
import { Base, Integration, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';

@Injectable()
export class SourcesService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async baseGetWithConfig(context: NcContext, param: { sourceId: any }) {
    const source = await Source.get(context, param.sourceId);

    if (!source) {
      NcError.sourceNotFound(param.sourceId);
    }

    source.config = await source.getSourceConfig();

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
    const source = await Source.update(context, param.sourceId, {
      ...baseBody,
      type: baseBody.config?.client,
      id: param.sourceId,
    });

    source.config = undefined;

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

  async baseDelete(
    context: NcContext,
    param: { sourceId: string; req: any },
    ncMeta = Noco.ncMeta,
  ) {
    try {
      const source = await Source.get(context, param.sourceId, true, ncMeta);
      await source.delete(context, ncMeta);
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

    // if missing integration id, create a new private integration
    // and map the id to the source
    if (!(baseBody as any).fk_integration_id) {
      const integration = await Integration.createIntegration({
        title: baseBody.alias,
        type: IntegrationsType.Database,
        sub_type: baseBody.config?.client,
        is_private: !!param.req.user?.id,
        config: baseBody.config,
        workspaceId: context.workspace_id,
        created_by: param.req.user?.id,
      });

      (baseBody as any).fk_integration_id = integration.id;
      baseBody.config = {
        client: baseBody.config?.client,
      };
      baseBody.type = baseBody.config?.client as unknown as BaseReqType['type'];
    } else {
      const integration = await Integration.get(
        context,
        (baseBody as any).fk_integration_id,
      );

      // Check if integration exists
      if (!integration) {
        NcError.integrationNotFound((baseBody as any).fk_integration_id);
      }

      // check if integration is of type Database
      if (
        integration.type !== IntegrationsType.Database ||
        !integration.sub_type
      ) {
        NcError.badRequest('Integration type should be Database');
      }

      baseBody.type = integration.sub_type as unknown as BaseReqType['type'];
    }

    // update invalid ssl config value if found
    if (baseBody.config?.connection?.ssl) {
      baseBody.config.connection.ssl = validateAndExtractSSLProp(
        baseBody.config.connection,
        baseBody.config.sslUse,
        baseBody.config.client,
      );
    }

    const source = await Source.createBase(context, {
      ...baseBody,
      baseId: base.id,
    });

    try {
      await syncBaseMigration(base, source);

      param.logger?.('Populating meta');

      const info = await populateMeta(context, {source, base, logger:param.logger, user: param.req.user});

      await populateRollupColumnAndHideLTAR(context, source, base);

      this.appHooksService.emit(AppEvents.APIS_CREATED, {
        info,
        req: param.req,
      });

      source.config = undefined;

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
