import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { PluginTestReqType, PluginType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { Plugin } from '~/models';

@Injectable()
export class PluginsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async pluginList() {
    return await Plugin.list();
  }

  async pluginTest(param: { body: PluginTestReqType; req: NcRequest }) {
    validatePayload(
      'swagger.json#/components/schemas/PluginTestReq',
      param.body,
    );

    this.appHooksService.emit(AppEvents.PLUGIN_TEST, {
      testBody: param.body,
      req: param.req,
    });
    return await NcPluginMgrv2.test(param.body);
  }

  async pluginRead(param: { pluginId: string }) {
    return await Plugin.get(param.pluginId);
  }
  async pluginUpdate(param: {
    pluginId: string;
    plugin: PluginType;
    req: NcRequest;
  }) {
    validatePayload('swagger.json#/components/schemas/PluginReq', param.plugin);

    const plugin = await Plugin.update(param.pluginId, param.plugin);

    this.appHooksService.emit(
      plugin.active ? AppEvents.PLUGIN_INSTALL : AppEvents.PLUGIN_UNINSTALL,
      {
        plugin,
        req: param.req,
      },
    );

    return plugin;
  }
  async isPluginActive(param: { pluginTitle: string }) {
    return await Plugin.isPluginActive(param.pluginTitle);
  }

  async webhookPluginList() {
    const plugins = await Plugin.list();

    return plugins.filter((p) =>
      ['Slack', 'Microsoft Teams', 'Discord', 'Mattermost'].includes(p.title),
    );
  }
}
