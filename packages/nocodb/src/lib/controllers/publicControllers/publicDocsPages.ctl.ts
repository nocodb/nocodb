import { Request, Response, Router } from 'express';
import apiMetrics from '../../meta/helpers/apiMetrics';
import catchError from '../../meta/helpers/catchError';
import { publicDocsPagesService } from '../../services';

async function get(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  const page = await publicDocsPagesService.get({
    pageId: req.params.id,
    projectId: req.query?.projectId as string,
    nestedPageId: req.query?.nestedPageId as string,
  });

  res.json(page);
}

async function list(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  const list = await publicDocsPagesService.list({
    projectId: req.query?.projectId as string,
    parentPageId: req.query?.parent_page_id as string,
  });

  res.json(list);
}

const router = Router({ mergeParams: true });

// table data crud apis
router.get('/api/v1/public/docs/page/:id', apiMetrics, catchError(get));
router.get('/api/v1/public/docs/pages', apiMetrics, catchError(list));

export default router;
