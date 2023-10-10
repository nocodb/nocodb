import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { UtilsController as UtilsControllerCE } from 'src/controllers/utils.controller';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { GlobalGuard } from '~/guards/global/global.guard';
import { UtilsService } from '~/services/utils.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcError } from '~/helpers/catchError';

@Controller()
export class UtilsController extends UtilsControllerCE {
  constructor(protected readonly utilsService: UtilsService) {
    super(utilsService);
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
  async testConnection(@Body() body: any) {
    if (process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS !== 'true') {
      if (!body?.connection || !body?.connection.host) {
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
              NcError.badRequest('Forbidden!!!');
            }
          });
        }
      }
    }
    return await this.utilsService.testConnection({ body });
  }
}
