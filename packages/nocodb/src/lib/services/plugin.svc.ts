import { T } from 'nc-help';
import { validatePayload } from '../meta/api/helpers';
import { Plugin } from '../models';
import type { PluginTestReqType, PluginType } from 'nocodb-sdk';
import NcPluginMgrv2 from '../meta/helpers/NcPluginMgrv2';

export async function pluginList() {
  return await Plugin.list();
}

export async function pluginTest(param: { body: PluginTestReqType }) {
  validatePayload('swagger.json#/components/schemas/PluginTestReq', param.body);

  T.emit('evt', { evt_type: 'plugin:tested' });
  return await NcPluginMgrv2.test(param.body);
}

export async function pluginRead(param: { pluginId: string }) {
  return await Plugin.get(param.pluginId);
}
export async function pluginUpdate(param: {
  pluginId: string;
  plugin: PluginType;
}) {
  validatePayload('swagger.json#/components/schemas/PluginReq', param.plugin);

  const plugin = await Plugin.update(param.pluginId, param.plugin);
  T.emit('evt', {
    evt_type: plugin.active ? 'plugin:installed' : 'plugin:uninstalled',
    title: plugin.title,
  });
  return plugin;
}
export async function isPluginActive(param: { pluginTitle: string }) {
  return await Plugin.isPluginActive(param.pluginTitle);
}
