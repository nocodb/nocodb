import type { Request, Response } from 'express';
import { Router } from 'express';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import apiMetrics from '../../meta/helpers/apiMetrics';
import { dataAliasNestedService } from '../../services';

// todo: handle case where the given column is not ltar
export async function mmList(req: Request, res: Response) {
  res.json(
    await dataAliasNestedService.mmList({
      query: req.query,
      columnName: req.params.columnName,
      rowId: req.params.rowId,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
    })
  );
}

export async function mmExcludedList(req: Request, res: Response) {
  res.json(
    await dataAliasNestedService.mmExcludedList({
      query: req.query,
      columnName: req.params.columnName,
      rowId: req.params.rowId,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
    })
  );
}

export async function hmExcludedList(req: Request, res: Response) {
  res.json(
    await dataAliasNestedService.hmExcludedList({
      query: req.query,
      columnName: req.params.columnName,
      rowId: req.params.rowId,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
    })
  );
}

export async function btExcludedList(req: Request, res: Response) {
  res.json(
    await dataAliasNestedService.btExcludedList({
      query: req.query,
      columnName: req.params.columnName,
      rowId: req.params.rowId,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
    })
  );
}

// todo: handle case where the given column is not ltar
export async function hmList(req: Request, res: Response) {
  res.json(
    await dataAliasNestedService.hmList({
      query: req.query,
      columnName: req.params.columnName,
      rowId: req.params.rowId,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
    })
  );
}

//@ts-ignore
async function relationDataRemove(req, res) {
  await dataAliasNestedService.relationDataRemove({
    columnName: req.params.columnName,
    rowId: req.params.rowId,
    projectName: req.params.projectName,
    tableName: req.params.tableName,
    cookie: req,
    refRowId: req.params.refRowId,
  });

  res.json({ msg: 'success' });
}

//@ts-ignore
// todo: Give proper error message when reference row is already related and handle duplicate ref row id in hm
async function relationDataAdd(req, res) {
  await dataAliasNestedService.relationDataAdd({
    columnName: req.params.columnName,
    rowId: req.params.rowId,
    projectName: req.params.projectName,
    tableName: req.params.tableName,
    cookie: req,
    refRowId: req.params.refRowId,
  });

  res.json({ msg: 'success' });
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/mm/:columnName/exclude',
  apiMetrics,
  ncMetaAclMw(mmExcludedList, 'mmExcludedList')
);
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/hm/:columnName/exclude',
  apiMetrics,
  ncMetaAclMw(hmExcludedList, 'hmExcludedList')
);
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/bt/:columnName/exclude',
  apiMetrics,
  ncMetaAclMw(btExcludedList, 'btExcludedList')
);

router.post(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  apiMetrics,
  ncMetaAclMw(relationDataAdd, 'relationDataAdd')
);
router.delete(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  apiMetrics,
  ncMetaAclMw(relationDataRemove, 'relationDataRemove')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/mm/:columnName',
  apiMetrics,
  ncMetaAclMw(mmList, 'mmList')
);
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/hm/:columnName',
  apiMetrics,
  ncMetaAclMw(hmList, 'hmList')
);

export default router;
