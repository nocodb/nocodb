import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import {
  extractCsvData,
  getViewAndModelFromRequestByAliasOrId,
} from './helpers';
import apiMetrics from '../../helpers/apiMetrics';
import View from '../../../models/View';


async function csvDataRawExport(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  let targetView = view;
  if (!targetView) {
    targetView = await View.getDefaultView(model.id);
  }
  const { offset, elapsed, data } = await extractCsvData(targetView, req);

  res.set({
    'Access-Control-Expose-Headers': 'nc-export-offset',
    'nc-export-offset': offset,
    'nc-export-elapsed-time': elapsed,
  });
  res.send(JSON.stringify({ csvData: data}));
}

async function csvDataExport(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  let targetView = view;
  if (!targetView) {
    targetView = await View.getDefaultView(model.id);
  }
  const { offset, elapsed, data } = await extractCsvData(targetView, req);

  res.set({
    'Access-Control-Expose-Headers': 'nc-export-offset',
    'nc-export-offset': offset,
    'nc-export-elapsed-time': elapsed,
    'Content-Disposition': `attachment; filename="${encodeURI(
      targetView.title
    )}-export.csv"`,
  });
  res.send(data);
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/export/csv',
  apiMetrics,
  ncMetaAclMw(csvDataExport, 'exportCsv')
);
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/export/csv',
  apiMetrics,
  ncMetaAclMw(csvDataExport, 'exportCsv')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/export/csvData',
  apiMetrics,
  ncMetaAclMw(csvDataRawExport, 'exportCsvData')
);

export default router;
