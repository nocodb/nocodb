import { Request, Response, Router } from 'express';
import apiMetrics from '../../helpers/apiMetrics';
import catchError from '../../helpers/catchError';
import Book from '../../../models/Book';

async function get(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    let book;

    if (req.params.slug !== 'latest') {
      book = await Book.get({
        slug: req.params.slug,
        projectId: req.query?.projectId as string,
      });
    } else {
      book = await Book.last({
        projectId: req.query?.projectId as string,
      });
    }

    if (!book || !book.is_published) {
      throw new Error('Book not found');
    }

    res.json(book);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

const router = Router({ mergeParams: true });

// table data crud apis
router.get('/api/v1/public/docs/books/:slug', apiMetrics, catchError(get));
// router.get('/api/v1/public/docs/books', apiMetrics, catchError(get));

export default router;
