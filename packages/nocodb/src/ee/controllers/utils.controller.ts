import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UtilsController as UtilsControllerCE } from 'src/controllers/utils.controller';
import { validateAndExtractSSLProp } from 'nocodb-sdk';
import {
  getTestDatabaseName,
  IntegrationsType,
  ProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { GlobalGuard } from '~/guards/global/global.guard';
import { UtilsService } from '~/services/utils.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcError } from '~/helpers/catchError';
import { TelemetryService } from '~/services/telemetry.service';
import { NcRequest } from '~/interface/config';
import { Integration, WorkspaceUser } from '~/models';
import { deepMerge } from '~/utils';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';

@Controller()
export class UtilsController extends UtilsControllerCE {
  constructor(
    protected readonly utilsService: UtilsService,
    protected readonly telemetryService: TelemetryService,
  ) {
    super(utilsService, telemetryService);
  }

  @Post(['/api/v1/db/meta/magic', '/api/v2/meta/magic'])
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('genericGPT')
  async genericGPT(@Body() body: any) {
    return await this.utilsService.genericGPT({
      body,
    });
  }

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Post(['/api/v1/db/meta/connection/test', '/api/v2/meta/connection/test'])
  @Acl('testConnection', {
    scope: 'org',
  })
  @HttpCode(200)
  async testConnection(@Body() body: any, @Req() req: NcRequest) {
    let config = { ...body };

    if (body.fk_integration_id) {
      const integration = await Integration.get(
        {
          workspace_id: RootScopes.BYPASS,
        },
        body.fk_integration_id,
      );

      if (!integration || integration.type !== IntegrationsType.Database) {
        NcError.integrationNotFound(body.fk_integration_id);
      }

      // check if user have access to this integration
      const workspaceUser = await WorkspaceUser.get(
        integration.fk_workspace_id,
        req.user.id,
      );

      if (
        !workspaceUser ||
        ![WorkspaceUserRoles.OWNER, WorkspaceUserRoles.CREATOR].includes(
          workspaceUser.roles as unknown as WorkspaceUserRoles,
        )
      ) {
        // check if user have owner/creator role in any of the base in the workspace
        const baseWithPermission = await Noco.ncMeta
          .knex(MetaTable.PROJECT_USERS)
          .innerJoin(
            MetaTable.PROJECT,
            `${MetaTable.PROJECT}.id`,
            `${MetaTable.PROJECT_USERS}.base_id`,
          )
          .where(
            `${MetaTable.PROJECT}.fk_workspace_id`,
            integration.fk_workspace_id,
          )
          .where(`${MetaTable.PROJECT_USERS}.fk_user_id`, req.user.id)
          .where((qb) => {
            qb.where(
              `${MetaTable.PROJECT_USERS}.roles`,
              ProjectRoles.OWNER,
            ).orWhere(`${MetaTable.PROJECT_USERS}.roles`, ProjectRoles.CREATOR);
          })
          .first();

        if (!baseWithPermission)
          NcError.forbidden('You do not have access to this integration');
      }

      if (integration.is_private && integration.created_by !== req.user.id) {
        NcError.forbidden('You do not have access to this integration');
      }

      config = await integration.getConfig();

      if (config?.connection?.database) {
        config.connection.database = getTestDatabaseName(config);
      }

      deepMerge(config, body);
    }

    if (process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS !== 'true') {
      if (
        config.client !== 'snowflake' &&
        (!config?.connection || !config?.connection.host)
      ) {
        NcError.badRequest('Connection missing host name or IP address');
      }
      if (config?.client && !config.client.includes('sqlite')) {
        const host = config.connection.host;
        const port = config.connection.port;
        if (host && port) {
          const url = `${host.includes('://') ? '' : 'http://'}${host}:${port}`;
          await axios(url, {
            httpAgent: useAgent(url, {
              stopPortScanningByUrlRedirection: true,
            }),
            httpsAgent: useAgent(url, {
              stopPortScanningByUrlRedirection: true,
            }),
            timeout: 100,
          }).catch((err) => {
            if (err.message.includes('DNS lookup')) {
              NcError.badRequest('Forbidden host name or IP address');
            }
          });
        }
      }
    }

    if (config.connection?.ssl) {
      config.connection.ssl = validateAndExtractSSLProp(
        config.connection,
        config.sslUse,
        config.client,
      );
    }

    config.pool = {
      min: 0,
      max: 1,
    };

    const result = await this.utilsService.testConnection({
      body: config,
    });

    if (result.code !== -1) {
      return result;
    } else {
      this.telemetryService.sendEvent({
        evt_type: 'a:extDb:connection:error',
        user_id: req.user.id,
        email: req.user.email,
        data: {
          client: config.client,
          message: result.message,
        },
        req,
      });
      NcError.testConnectionError(result.message, result.sql_code);
    }
  }

  @Get('/api/v1/aggregated-meta-info')
  async aggregatedMetaInfo() {
    return null;
  }
}
