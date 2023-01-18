import { Request, Response, Router } from 'express';
import apiMetrics from '../../helpers/apiMetrics';
import Page from '../../../models/Page';
import catchError from '../../helpers/catchError';
import Book from '../../../models/Book';

async function get(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const book = await Book.get({
      id: req.query.bookId as string,
      projectId: req.query?.projectId as string,
    });

    const page = await Page.get({
      id: req.params.id,
      projectId: req.query?.projectId as string,
      bookId: req.query?.bookId as string,
    });

    if (!page) throw new Error('Page not found');

    if (!book?.is_published) throw new Error('Unauthorized');

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
    const book = await Book.get({
      id: req.query.bookId as string,
      projectId: req.query?.projectId as string,
    });

    const pages = await Page.nestedList({
      bookId: req.query?.bookId as string,
      projectId: req.query?.projectId as string,
    });

    if (!book?.is_published) throw new Error('Unauthorized');
    // const publishedPages = pages.filter((page) => page.is_published);

    res // todo: pagination
      .json(pages);
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
