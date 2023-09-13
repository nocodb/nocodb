import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { PluginsService } from '~/services/plugins.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

// todo: move to a interceptor
// const blockInCloudMw = (_req, res, next) => {
//   if (process.env.NC_CLOUD === 'true') {
//     res.status(403).send('Not allowed');
//   } else next();
// };

@Controller()
@UseGuards(GlobalGuard)
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Get('/api/v1/db/meta/plugins')
  @Acl('pluginList', {
    scope: 'org',
  })
  async pluginList() {
    return new PagedResponseImpl(await this.pluginsService.pluginList());
  }

  @Get('/api/v1/db/meta/plugins/webhook')
  @Acl('webhookPluginList', {
    scope: 'org',
  })
  async webhookPluginList() {
    return new PagedResponseImpl(await this.pluginsService.webhookPluginList());
  }

  @Post('/api/v1/db/meta/plugins/test')
  @HttpCode(200)
  @Acl('pluginTest', {
    scope: 'org',
  })
  async pluginTest(@Body() body: any) {
    return await this.pluginsService.pluginTest({ body: body });
  }

  @Get('/api/v1/db/meta/plugins/:pluginId')
  @Acl('pluginRead', {
    scope: 'org',
  })
  async pluginRead(@Param('pluginId') pluginId: string) {
    return await this.pluginsService.pluginRead({ pluginId: pluginId });
  }

  @Patch('/api/v1/db/meta/plugins/:pluginId')
  @Acl('pluginUpdate', {
    scope: 'org',
  })
  async pluginUpdate(@Body() body: any, @Param('pluginId') pluginId: string) {
    const plugin = await this.pluginsService.pluginUpdate({
      pluginId: pluginId,
      plugin: body,
    });
    return plugin;
  }

  @Get('/api/v1/db/meta/plugins/:pluginTitle/status')
  @Acl('isPluginActive', {
    scope: 'org',
  })
  async isPluginActive(@Param('pluginTitle') pluginTitle: string) {
    return await this.pluginsService.isPluginActive({
      pluginTitle: pluginTitle,
    });
  }
}
