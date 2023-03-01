import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import apiMetrics from '../../meta/helpers/apiMetrics';
import { parseHrtimeToSeconds } from '../../meta/api/helpers';

import { dataService } from '../../services';

// todo: Handle the error case where view doesnt belong to model
async function dataList(req: Request, res: Response) {
  const startTime = process.hrtime();
  const responseData = await dataService.dataList({
    query: req.query,
    projectName: req.params.projectName,
    tableName: req.params.tableName,
    viewName: req.params.viewName,
  });
  const elapsedSeconds = parseHrtimeToSeconds(process.hrtime(startTime));
  res.setHeader('xc-db-response', elapsedSeconds);
  res.json(responseData);
}

async function dataFindOne(req: Request, res: Response) {
  res.json(
    await dataService.dataFindOne({
      query: req.query,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
      viewName: req.params.viewName,
    })
  );
}

async function dataGroupBy(req: Request, res: Response) {
  res.json(
    await dataService.dataFindOne({
      query: req.query,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
      viewName: req.params.viewName,
    })
  );
}

async function dataCount(req: Request, res: Response) {
  const count = await dataService.dataCount({
    query: req.query,
    projectName: req.params.projectName,
    tableName: req.params.tableName,
    viewName: req.params.viewName,
  });

  res.json({ count });
}

async function dataInsert(req: Request, res: Response) {
  res.json(
    await dataService.dataInsert({
      projectName: req.params.projectName,
      tableName: req.params.tableName,
      viewName: req.params.viewName,
      body: req.body,
      cookie: req,
    })
  );
}

async function dataUpdate(req: Request, res: Response) {
  res.json(
    await dataService.dataUpdate({
      projectName: req.params.projectName,
      tableName: req.params.tableName,
      viewName: req.params.viewName,
      body: req.body,
      cookie: req,
      rowId: req.params.rowId,
    })
  );
}

async function dataDelete(req: Request, res: Response) {
  res.json(
    await dataService.dataDelete({
      projectName: req.params.projectName,
      tableName: req.params.tableName,
      viewName: req.params.viewName,
      cookie: req,
      rowId: req.params.rowId,
    })
  );
}

async function dataRead(req: Request, res: Response) {
  res.json(
    await dataService.dataRead({
      projectName: req.params.projectName,
      tableName: req.params.tableName,
      viewName: req.params.viewName,
      rowId: req.params.rowId,
      query: req.query,
    })
}

async function dataExist(req: Request, res: Response) {
  res.json(await dataService.dataExist({
    projectName: req.params.projectName,
    tableName: req.params.tableName,
    viewName: req.params.viewName,
    rowId: req.params.rowId,
    query: req.query,
  }));
}

// todo: Handle the error case where view doesnt belong to model
async function groupedDataList(req: Request, res: Response) {
  const startTime = process.hrtime();
  const groupedData = await dataService.groupedDataList({
    projectName: req.params.projectName,
    tableName: req.params.tableName,
    viewName: req.params.viewName,
    query: req.query,
    columnId: req.params.columnId
  });
  const elapsedSeconds = parseHrtimeToSeconds(process.hrtime(startTime));
  res.setHeader('xc-db-response', elapsedSeconds);
  res.json(groupedData);
}

const router = Router({ mergeParams: true });

// table data crud apis
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(dataList, 'dataList')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/find-one',
  apiMetrics,
  ncMetaAclMw(dataFindOne, 'dataFindOne')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/groupby',
  apiMetrics,
  ncMetaAclMw(dataGroupBy, 'dataGroupBy')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/group/:columnId',
  apiMetrics,
  ncMetaAclMw(groupedDataList, 'groupedDataList')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/exist',
  apiMetrics,
  ncMetaAclMw(dataExist, 'dataExist')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/count',
  apiMetrics,
  ncMetaAclMw(dataCount, 'dataCount')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/count',
  apiMetrics,
  ncMetaAclMw(dataCount, 'dataCount')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataRead, 'dataRead')
);

router.patch(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataUpdate, 'dataUpdate')
);

router.delete(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataDelete, 'dataDelete')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(dataList, 'dataList')
);

// table view data crud apis
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName',
  apiMetrics,
  ncMetaAclMw(dataList, 'dataList')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/find-one',
  apiMetrics,
  ncMetaAclMw(dataFindOne, 'dataFindOne')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/groupby',
  apiMetrics,
  ncMetaAclMw(dataGroupBy, 'dataGroupBy')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/group/:columnId',
  apiMetrics,
  ncMetaAclMw(groupedDataList, 'groupedDataList')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId/exist',
  apiMetrics,
  ncMetaAclMw(dataExist, 'dataExist')
);

router.post(
  '/api/v1/db/data/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(dataInsert, 'dataInsert')
);

router.post(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName',
  apiMetrics,
  ncMetaAclMw(dataInsert, 'dataInsert')
);

router.patch(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataUpdate, 'dataUpdate')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataRead, 'dataRead')
);

router.delete(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataDelete, 'dataDelete')
);

export default router;
