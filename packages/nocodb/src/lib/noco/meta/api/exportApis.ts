import { Request, Response, Router } from 'express';
import View from '../../../noco-models/View';
import papaparse from 'papaparse';
import { isSystemColumn } from 'nocodb-sdk';
import Column from '../../../noco-models/Column';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { extractCsvData } from './dataApis/helpers';

async function exportCsv(req: Request, res: Response, next) {
  const view = await View.get(req.params.viewId);

  const model = await view.getModelWithInfo();
  await view.getColumns();

  view.model.columns = view.columns
    .filter(c => c.show)
    .map(
      c =>
        new Column({ ...c, ...view.model.columnsById[c.fk_column_id] } as any)
    )
    .filter(column => !isSystemColumn(column) || view.show_system_fields);

  if (!model) return next(new Error('Table not found'));
  const { offset, csvRows, elapsed } = await extractCsvData(model, view, req);

  const data = papaparse.unparse(
    {
      fields: model.columns.map(c => c.title),
      data: csvRows
    },
    {
      escapeFormulae: true
    }
  );

  res.set({
    'Access-Control-Expose-Headers': 'nc-export-offset',
    'nc-export-offset': offset,
    'nc-export-elapsed-time': elapsed,
    'Content-Disposition': `attachment; filename="${view.title}-export.csv"`
  });
  res.send(data);
}

const router = Router({ mergeParams: true });
router.get('/data/:viewId/export/csv', ncMetaAclMw(exportCsv, 'exportCsv'));
export default router;
