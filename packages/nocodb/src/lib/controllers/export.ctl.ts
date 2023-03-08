import type { Request, Response } from 'express';
import { Router } from 'express';
import View from '../models/View';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { extractCsvData } from './dbData/helpers';

async function exportCsv(req: Request, res: Response) {
  const view = await View.get(req.params.viewId);
  const { offset, elapsed, data } = await extractCsvData(view, req);

  res.set({
    'Access-Control-Expose-Headers': 'nc-export-offset',
    'nc-export-offset': offset,
    'nc-export-elapsed-time': elapsed,
    'Content-Disposition': `attachment; filename="${encodeURI(
      view.title
    )}-export.csv"`,
  });
  res.send(data);
}

const router = Router({ mergeParams: true });
router.get('/data/:viewId/export/csv', ncMetaAclMw(exportCsv, 'exportCsv'));
export default router;
