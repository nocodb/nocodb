import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { AppEvents } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import NcPluginMgrv2 from '../helpers/NcPluginMgrv2';
import { Plugin } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { PluginTestReqType, PluginType } from 'nocodb-sdk';

@Injectable()
export class PluginsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async pluginList() {
    return await Plugin.list();
  }

  async pluginTest(param: { body: PluginTestReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/PluginTestReq',
      param.body,
    );

    this.appHooksService.emit(AppEvents.PLUGIN_TEST, {
      testBody: param.body,
    });
    return await NcPluginMgrv2.test(param.body);
  }

  async pluginRead(param: { pluginId: string }) {
    return await Plugin.get(param.pluginId);
  }
  async pluginUpdate(param: { pluginId: string; plugin: PluginType }) {
    validatePayload('swagger.json#/components/schemas/PluginReq', param.plugin);

    const plugin = await Plugin.update(param.pluginId, param.plugin);

    this.appHooksService.emit(
      plugin.active ? AppEvents.PLUGIN_INSTALL : AppEvents.PLUGIN_UNINSTALL,
      {
        plugin,
      },
    );

    return plugin;
  }
  async isPluginActive(param: { pluginTitle: string }) {
    return await Plugin.isPluginActive(param.pluginTitle);
  }
}
