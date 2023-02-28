import { Request, Response, Router } from 'express';
import { MapType } from 'nocodb-sdk';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { mapViewService } from '../services';

export async function mapViewGet(req: Request, res: Response<MapType>) {
  res.json(
    await mapViewService.mapViewGet({ mapViewId: req.params.mapViewId })
  );
}

export async function mapViewCreate(req: Request<any, any>, res) {
  const view = await mapViewService.mapViewCreate({
    tableId: req.params.tableId,
    map: req.body,
  });
  res.json(view);
}

export async function mapViewUpdate(req, res) {
  res.json(
    await mapViewService.mapViewUpdate({
      mapViewId: req.params.mapViewId,
      map: req.body,
    })
  );
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
