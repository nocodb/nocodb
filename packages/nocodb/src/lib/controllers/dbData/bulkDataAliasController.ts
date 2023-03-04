import { Request, Response, Router } from 'express';
import { bulkDataService } from '../../services';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import apiMetrics from '../../meta/helpers/apiMetrics';

async function bulkDataInsert(req: Request, res: Response) {
  res.json(
    await bulkDataService.bulkDataInsert({
      body: req.body,
      cookie: req,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
    })
  );
}

async function bulkDataUpdate(req: Request, res: Response) {
  res.json(
    await bulkDataService.bulkDataUpdate({
      body: req.body,
      cookie: req,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
    })
  );
}

// todo: Integrate with filterArrJson bulkDataUpdateAll
async function bulkDataUpdateAll(req: Request, res: Response) {
  res.json(
    await bulkDataService.bulkDataUpdateAll({
      body: req.body,
      cookie: req,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
      query: req.query,
    })
  );
}

async function bulkDataDelete(req: Request, res: Response) {
  res.json(
    await bulkDataService.bulkDataDelete({
      body: req.body,
      cookie: req,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
    })
  );
}

// todo: Integrate with filterArrJson bulkDataDeleteAll
async function bulkDataDeleteAll(req: Request, res: Response) {
  res.json(
    await bulkDataService.bulkDataDeleteAll({
      // cookie: req,
      projectName: req.params.projectName,
      tableName: req.params.tableName,
      query: req.query,
    })
  );
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(bulkDataInsert, 'bulkDataInsert')
);
router.patch(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(bulkDataUpdate, 'bulkDataUpdate')
);
router.patch(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName/all',
  apiMetrics,
  ncMetaAclMw(bulkDataUpdateAll, 'bulkDataUpdateAll')
);
router.delete(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(bulkDataDelete, 'bulkDataDelete')
);
router.delete(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName/all',
  apiMetrics,
  ncMetaAclMw(bulkDataDeleteAll, 'bulkDataDeleteAll')
);

export default router;
