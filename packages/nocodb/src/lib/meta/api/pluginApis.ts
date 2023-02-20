import { Request, Response, Router } from 'express';
import { Tele } from 'nc-help';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import Plugin from '../../models/Plugin';
import { PluginType } from 'nocodb-sdk';
import NcPluginMgrv2 from '../helpers/NcPluginMgrv2';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';

export async function pluginList(_req: Request, res: Response) {
  res.json(new PagedResponseImpl(await Plugin.list()));
}

export async function pluginTest(req: Request<any, any>, res: Response) {
  Tele.emit('evt', { evt_type: 'plugin:tested' });
  res.json(await NcPluginMgrv2.test(req.body));
}

export async function pluginRead(req: Request, res: Response) {
  res.json(await Plugin.get(req.params.pluginId));
}
export async function pluginUpdate(
  req: Request<any, any, PluginType>,
  res: Response
) {
  const plugin = await Plugin.update(req.params.pluginId, req.body);
  Tele.emit('evt', {
    evt_type: plugin.active ? 'plugin:installed' : 'plugin:uninstalled',
    title: plugin.title,
  });
  res.json(plugin);
}
export async function isPluginActive(req: Request, res: Response) {
  res.json(await Plugin.isPluginActive(req.params.pluginTitle));
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/plugins',
  metaApiMetrics,
  ncMetaAclMw(pluginList, 'pluginList')
);
router.post(
  '/api/v1/db/meta/plugins/test',
  metaApiMetrics,
  ncMetaAclMw(pluginTest, 'pluginTest')
);
router.get(
  '/api/v1/db/meta/plugins/:pluginId',
  metaApiMetrics,
  ncMetaAclMw(pluginRead, 'pluginRead')
);
router.patch(
  '/api/v1/db/meta/plugins/:pluginId',
  metaApiMetrics,
  ncMetaAclMw(pluginUpdate, 'pluginUpdate')
);
router.get(
  '/api/v1/db/meta/plugins/:pluginTitle/status',
  metaApiMetrics,
  ncMetaAclMw(isPluginActive, 'isPluginActive')
);
export default router;
