import type { Request, Response } from 'express';
import { Router } from 'express';
import type { ColumnReqType, TableType, UITypes } from 'nocodb-sdk';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { columnService } from '../services';

export async function columnGet(req: Request, res: Response) {
  res.json(await columnService.columnGet({ columnId: req.params.columnId }));
}

export async function columnAdd(
  req: Request<any, any, ColumnReqType & { uidt: UITypes }>,
  res: Response<TableType>
) {
  res.json(
    await columnService.columnAdd({
      tableId: req.params.tableId,
      column: req.body,
      req,
    })
  );
}

export async function columnSetAsPrimary(req: Request, res: Response) {
  res.json(
    await columnService.columnSetAsPrimary({ columnId: req.params.columnId })
  );
}

export async function columnUpdate(req: Request, res: Response<TableType>) {
  res.json(
    await columnService.columnUpdate({
      columnId: req.params.columnId,
      column: req.body,
      req,
    })
  );
}

export async function columnDelete(req: Request, res: Response<TableType>) {
  res.json(
    await columnService.columnDelete({ columnId: req.params.columnId, req })
  );
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/db/meta/tables/:tableId/columns/',
  metaApiMetrics,
  ncMetaAclMw(columnAdd, 'columnAdd')
);

router.patch(
  '/api/v1/db/meta/columns/:columnId',
  metaApiMetrics,
  ncMetaAclMw(columnUpdate, 'columnUpdate')
);

router.delete(
  '/api/v1/db/meta/columns/:columnId',
  metaApiMetrics,
  ncMetaAclMw(columnDelete, 'columnDelete')
);

router.get(
  '/api/v1/db/meta/columns/:columnId',
  metaApiMetrics,
  ncMetaAclMw(columnGet, 'columnGet')
);

router.post(
  '/api/v1/db/meta/columns/:columnId/primary',
  metaApiMetrics,
  ncMetaAclMw(columnSetAsPrimary, 'columnSetAsPrimary')
);
export default router;
