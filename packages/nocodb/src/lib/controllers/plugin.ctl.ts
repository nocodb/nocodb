import { Router } from 'express';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { pluginService } from '../services';
import type { PluginType } from 'nocodb-sdk';
import type { Request, Response } from 'express';

export async function pluginList(_req: Request, res: Response) {
  res.json(new PagedResponseImpl(await pluginService.pluginList()));
}

export async function pluginTest(req: Request<any, any>, res: Response) {
  res.json(await pluginService.pluginTest({ body: req.body }));
}

export async function pluginRead(req: Request, res: Response) {
  res.json(await pluginService.pluginRead({ pluginId: req.params.pluginId }));
}

export async function pluginUpdate(
  req: Request<any, any, PluginType>,
  res: Response
) {
  const plugin = await pluginService.pluginUpdate({
    pluginId: req.params.pluginId,
    plugin: req.body,
  });
  res.json(plugin);
}

export async function isPluginActive(req: Request, res: Response) {
  res.json(
    await pluginService.isPluginActive({ pluginTitle: req.params.pluginTitle })
  );
}

const blockInCloudMw = (_req, res, next) => {
  if (process.env.NC_CLOUD === 'true') {
    res.status(403).send('Not allowed');
  } else next();
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/plugins',
  blockInCloudMw,
  metaApiMetrics,
  ncMetaAclMw(pluginList, 'pluginList')
);
router.post(
  '/api/v1/db/meta/plugins/test',
  metaApiMetrics,
  blockInCloudMw,
  ncMetaAclMw(pluginTest, 'pluginTest')
);
router.get(
  '/api/v1/db/meta/plugins/:pluginId',
  metaApiMetrics,
  blockInCloudMw,
  ncMetaAclMw(pluginRead, 'pluginRead')
);
router.patch(
  '/api/v1/db/meta/plugins/:pluginId',
  metaApiMetrics,
  blockInCloudMw,
  ncMetaAclMw(pluginUpdate, 'pluginUpdate')
);
router.get(
  '/api/v1/db/meta/plugins/:pluginTitle/status',
  metaApiMetrics,
  blockInCloudMw,
  ncMetaAclMw(isPluginActive, 'isPluginActive')
);
export default router;
