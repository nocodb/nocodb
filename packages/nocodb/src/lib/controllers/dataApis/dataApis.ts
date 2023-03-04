import { Request, Response, Router } from 'express';
import { dataService } from '../../services';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import apiMetrics from '../../meta/helpers/apiMetrics';

export async function dataList(req: Request, res: Response) {
  res.json(
    await dataService.dataListByViewId({
      viewId: req.params.viewId,
      query: req.query,
    })
  );
}

export async function mmList(req: Request, res: Response) {
  res.json(
    await dataService.mmList({
      viewId: req.params.viewId,
      colId: req.params.colId,
      rowId: req.params.rowId,
      query: req.query,
    })
  );
}

export async function mmExcludedList(req: Request, res: Response) {
  res.json(
    await dataService.mmExcludedList({
      viewId: req.params.viewId,
      colId: req.params.colId,
      rowId: req.params.rowId,
      query: req.query,
    })
  );
}

export async function hmExcludedList(req: Request, res: Response) {
  res.json(
    await dataService.hmExcludedList({
      viewId: req.params.viewId,
      colId: req.params.colId,
      rowId: req.params.rowId,
      query: req.query,
    })
  );
}

export async function btExcludedList(req: Request, res: Response) {
  res.json(
    await dataService.btExcludedList({
      viewId: req.params.viewId,
      colId: req.params.colId,
      rowId: req.params.rowId,
      query: req.query,
    })
  );
}

export async function hmList(req: Request, res: Response) {
  res.json(
    await dataService.hmList({
      viewId: req.params.viewId,
      colId: req.params.colId,
      rowId: req.params.rowId,
      query: req.query,
    })
  );
}

async function dataRead(req: Request, res: Response) {
  res.json(
    await dataService.dataReadByViewId({
      viewId: req.params.viewId,
      rowId: req.params.rowId,
      query: req.query,
    })
  );
}

async function dataInsert(req: Request, res: Response) {
  res.json(
    await dataService.dataInsertByViewId({
      viewId: req.params.viewId,
      body: req.body,
      cookie: req,
    })
  );
}

async function dataUpdate(req: Request, res: Response) {
  res.json(
    await dataService.dataUpdateByViewId({
      viewId: req.params.viewId,
      rowId: req.params.rowId,
      body: req.body,
      cookie: req,
    })
  );
}

async function dataDelete(req: Request, res: Response) {
  res.json(
    await dataService.dataDeleteByViewId({
      viewId: req.params.viewId,
      rowId: req.params.rowId,
      cookie: req,
    })
  );
}

async function relationDataDelete(req, res) {
  await dataService.relationDataDelete({
    viewId: req.params.viewId,
    colId: req.params.colId,
    childId: req.params.childId,
    rowId: req.params.rowId,
    cookie: req,
  });

  res.json({ msg: 'success' });
}

//@ts-ignore
async function relationDataAdd(req, res) {
  await dataService.relationDataAdd({
    viewId: req.params.viewId,
    colId: req.params.colId,
    childId: req.params.childId,
    rowId: req.params.rowId,
    cookie: req,
  });

  res.json({ msg: 'success' });
}

const router = Router({ mergeParams: true });

router.get('/data/:viewId/', apiMetrics, ncMetaAclMw(dataList, 'dataList'));
router.post(
  '/data/:viewId/',
  apiMetrics,
  ncMetaAclMw(dataInsert, 'dataInsert')
);
router.get(
  '/data/:viewId/:rowId',
  apiMetrics,
  ncMetaAclMw(dataRead, 'dataRead')
);
router.patch(
  '/data/:viewId/:rowId',
  apiMetrics,
  ncMetaAclMw(dataUpdate, 'dataUpdate')
);
router.delete(
  '/data/:viewId/:rowId',
  apiMetrics,
  ncMetaAclMw(dataDelete, 'dataDelete')
);

router.get(
  '/data/:viewId/:rowId/mm/:colId',
  apiMetrics,
  ncMetaAclMw(mmList, 'mmList')
);
router.get(
  '/data/:viewId/:rowId/hm/:colId',
  apiMetrics,
  ncMetaAclMw(hmList, 'hmList')
);

router.get(
  '/data/:viewId/:rowId/mm/:colId/exclude',
  ncMetaAclMw(mmExcludedList, 'mmExcludedList')
);
router.get(
  '/data/:viewId/:rowId/hm/:colId/exclude',
  ncMetaAclMw(hmExcludedList, 'hmExcludedList')
);
router.get(
  '/data/:viewId/:rowId/bt/:colId/exclude',
  ncMetaAclMw(btExcludedList, 'btExcludedList')
);

router.post(
  '/data/:viewId/:rowId/:relationType/:colId/:childId',
  ncMetaAclMw(relationDataAdd, 'relationDataAdd')
);
router.delete(
  '/data/:viewId/:rowId/:relationType/:colId/:childId',
  ncMetaAclMw(relationDataDelete, 'relationDataDelete')
);
export default router;
