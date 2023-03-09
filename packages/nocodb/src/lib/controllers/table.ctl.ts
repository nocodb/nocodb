import { Router } from 'express';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import { tableService } from '../services';
import type { TableListType, TableReqType, TableType } from 'nocodb-sdk';
import type { Request, Response } from 'express';

export async function tableList(req: Request, res: Response<TableListType>) {
  res.json(
    new PagedResponseImpl(
      await tableService.getAccessibleTables({
        projectId: req.params.projectId,
        baseId: req.params.baseId,
        includeM2M: req.query?.includeM2M === 'true',
        roles: (req as any).session?.passport?.user?.roles,
      })
    )
  );
}

export async function tableCreate(req: Request<any, any, TableReqType>, res) {
  const result = await tableService.tableCreate({
    projectId: req.params.projectId,
    baseId: req.params.baseId,
    table: req.body,
    user: (req as any).session?.passport?.user,
  });

  res.json(result);
}

export async function tableGet(req: Request, res: Response<TableType>) {
  const table = await tableService.getTableWithAccessibleViews({
    tableId: req.params.tableId,
    user: (req as any).session?.passport?.user,
  });

  res.json(table);
}

export async function tableDelete(req: Request, res: Response) {
  const result = await tableService.tableDelete({
    tableId: req.params.tableId,
    user: (req as any).session?.passport?.user,
    req,
  });

  res.json(result);
}

export async function tableReorder(req: Request, res: Response) {
  res.json(
    await tableService.reorderTable({
      tableId: req.params.tableId,
      order: req.body.order,
    })
  );
}

export async function tableUpdate(req: Request<any, any>, res) {
  await tableService.tableUpdate({
    tableId: req.params.tableId,
    table: req.body,
    projectId: (req as any).ncProjectId,
  });
  res.json({ msg: 'success' });
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/projects/:projectId/tables',
  metaApiMetrics,
  ncMetaAclMw(tableList, 'tableList')
);
router.get(
  '/api/v1/db/meta/projects/:projectId/:baseId/tables',
  metaApiMetrics,
  ncMetaAclMw(tableList, 'tableList')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/tables',
  metaApiMetrics,
  ncMetaAclMw(tableCreate, 'tableCreate')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/:baseId/tables',
  metaApiMetrics,
  ncMetaAclMw(tableCreate, 'tableCreate')
);
router.get(
  '/api/v1/db/meta/tables/:tableId',
  metaApiMetrics,
  ncMetaAclMw(tableGet, 'tableGet')
);
router.patch(
  '/api/v1/db/meta/tables/:tableId',
  metaApiMetrics,
  ncMetaAclMw(tableUpdate, 'tableUpdate')
);
router.delete(
  '/api/v1/db/meta/tables/:tableId',
  metaApiMetrics,
  ncMetaAclMw(tableDelete, 'tableDelete')
);
router.post(
  '/api/v1/db/meta/tables/:tableId/reorder',
  metaApiMetrics,
  ncMetaAclMw(tableReorder, 'tableReorder')
);
export default router;
