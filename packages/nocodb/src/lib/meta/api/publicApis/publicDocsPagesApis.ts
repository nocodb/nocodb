import { Request, Response, Router } from 'express';
import apiMetrics from '../../helpers/apiMetrics';
import Page from '../../../models/Page';
import catchError from '../../helpers/catchError';

async function get(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const page = await Page.get({
      id: req.params.id,
      projectId: req.query?.projectId as string,
      bookId: req.query?.bookId as string,
    });

    if (!page) throw new Error('Page not found');

    if (!page?.is_published) throw new Error('Unauthorized');

    res.json(page);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function list(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const pages = await Page.list({
      bookId: req.query?.bookId as string,
      projectId: req.query?.projectId as string,
      parent_page_id: req.query?.parent_page_id as string,
    });

    const publishedPages = pages.filter((page) => page.is_published);

    res // todo: pagination
      .json(publishedPages);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

const router = Router({ mergeParams: true });

// table data crud apis
router.get('/api/v1/public/docs/page/:id', apiMetrics, catchError(get));
router.get('/api/v1/public/docs/pages', apiMetrics, catchError(list));

export default router;
