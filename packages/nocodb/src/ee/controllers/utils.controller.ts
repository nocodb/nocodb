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
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { GlobalGuard } from '~/guards/global/global.guard';
import { UtilsService } from '~/services/utils.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcError } from '~/helpers/catchError';
import { TelemetryService } from '~/services/telemetry.service';
import { NcRequest } from '~/interface/config';

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
    if (process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS !== 'true') {
      if (
        body.client !== 'snowflake' &&
        (!body?.connection || !body?.connection.host)
      ) {
        NcError.badRequest('Connection missing host name or IP address');
      }
      if (body?.client && !body.client.includes('sqlite')) {
        const host = body.connection.host;
        const port = body.connection.port;
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

    body.connection.ssl = validateAndExtractSSLProp(
      body.connection,
      body.sslUse,
      body.client,
    );

    body.pool = {
      min: 0,
      max: 1,
    };

    const result = await this.utilsService.testConnection({
      body,
    });

    if (result.code !== -1) {
      return result;
    } else {
      this.telemetryService.sendEvent({
        evt_type: 'a:extDb:connection:error',
        user_id: req.user.id,
        email: req.user.email,
        data: {
          client: body.client,
          message: result.message,
        },
        req,
      });
      NcError.unprocessableEntity(result.message);
    }
  }

  @Get('/api/v1/aggregated-meta-info')
  async aggregatedMetaInfo() {
    return null;
  }
}
