import { Router } from 'express';
import * as XLSX from 'xlsx';
import apiMetrics from '../../meta/helpers/apiMetrics';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import { View } from '../../models';
import { extractCsvData, extractXlsxData } from '../../services/dbData/helpers';
import { getViewAndModelFromRequestByAliasOrId } from './helpers';
import type { Request, Response } from 'express';

async function excelDataExport(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  let targetView = view;
  if (!targetView) {
    targetView = await View.getDefaultView(model.id);
  }
  const { offset, elapsed, data } = await extractXlsxData(targetView, req);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, data, targetView.title);
  const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  res.set({
    'Access-Control-Expose-Headers': 'nc-export-offset',
    'nc-export-offset': offset,
    'nc-export-elapsed-time': elapsed,
    'Content-Disposition': `attachment; filename="${encodeURI(
      targetView.title
    )}-export.xlsx"`,
  });
  res.end(buf);
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
  '/api/v1/db/data/:orgs/:projectName/:tableName/export/excel',
  apiMetrics,
  ncMetaAclMw(excelDataExport, 'exportExcel')
);
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/export/excel',
  apiMetrics,
  ncMetaAclMw(excelDataExport, 'exportExcel')
);

export default router;
