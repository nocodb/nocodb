import { Request, Response, Router } from 'express';
import { MapType, ViewTypes } from 'nocodb-sdk';
import View from '../../models/View';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { Tele } from 'nc-help';
import { metaApiMetrics } from '../helpers/apiMetrics';
import MapView from '../../models/MapView';

export async function mapViewGet(req: Request, res: Response<MapType>) {
  res.json(await MapView.get(req.params.mapViewId));
}

export async function mapViewCreate(req: Request<any, any>, res) {
  Tele.emit('evt', { evt_type: 'vtable:created', show_as: 'map' });
  const view = await View.insert({
    ...req.body,
    // todo: sanitize
    fk_model_id: req.params.tableId,
    type: ViewTypes.MAP,
  });
  res.json(view);
}

export async function mapViewUpdate(req, res) {
  Tele.emit('evt', { evt_type: 'view:updated', type: 'map' });
  res.json(await MapView.update(req.params.mapViewId, req.body));
}

const router = Router({ mergeParams: true });

// todo: add schema in swagger and use getAjvValidatorMw
router.post(
  '/api/v1/db/meta/tables/:tableId/maps',
  metaApiMetrics,
  ncMetaAclMw(mapViewCreate, 'mapViewCreate')
);
router.patch(
  '/api/v1/db/meta/maps/:mapViewId',
  metaApiMetrics,
  ncMetaAclMw(mapViewUpdate, 'mapViewUpdate')
);
router.get(
  '/api/v1/db/meta/maps/:mapViewId',
  metaApiMetrics,
  ncMetaAclMw(mapViewGet, 'mapViewGet')
);
export default router;
