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
import { GlobalGuard } from '../guards/global/global.guard';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { Acl } from '../middlewares/extract-project-id/extract-project-id.middleware';
import { PluginsService } from '../services/plugins.service';

// todo: move to a interceptor
const blockInCloudMw = (_req, res, next) => {
  if (process.env.NC_CLOUD === 'true') {
    res.status(403).send('Not allowed');
  } else next();
};

@Controller()
@UseGuards(GlobalGuard)
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Get('/api/v1/db/meta/plugins')
  @Acl('pluginList')
  async pluginList() {
    return new PagedResponseImpl(await this.pluginsService.pluginList());
  }

  @Post('/api/v1/db/meta/plugins/test')
  @HttpCode(200)
  @Acl('pluginTest')
  async pluginTest(@Body() body: any) {
    return await this.pluginsService.pluginTest({ body: body });
  }

  @Get('/api/v1/db/meta/plugins/:pluginId')
  @Acl('pluginRead')
  async pluginRead(@Param('pluginId') pluginId: string) {
    return await this.pluginsService.pluginRead({ pluginId: pluginId });
  }

  @Patch('/api/v1/db/meta/plugins/:pluginId')
  @Acl('pluginUpdate')
  async pluginUpdate(@Body() body: any, @Param('pluginId') pluginId: string) {
    const plugin = await this.pluginsService.pluginUpdate({
      pluginId: pluginId,
      plugin: body,
    });
    return plugin;
  }

  @Get('/api/v1/db/meta/plugins/:pluginTitle/status')
  @Acl('isPluginActive')
  async isPluginActive(@Param('pluginTitle') pluginTitle: string) {
    return await this.pluginsService.isPluginActive({
      pluginTitle: pluginTitle,
    });
  }
}
