import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import apiMetrics from '../../helpers/apiMetrics';
import Book from '../../../models/Book';
import { UserType } from 'nocodb-sdk';

async function get(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const page = await Book.get({
      id: req.params.id,
      projectId: req.query?.projectId as string,
    });

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
    const pages = await Book.list({
      projectId: req.query?.projectId,
    });

    res // todo: pagination
      .json(pages);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function create(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const page = await Book.create({
      attributes: req.body.attributes,
      projectId: req.body.projectId,
      user: (req as any)?.session?.passport?.user as UserType,
    });

    res.json(page);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function update(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const page = await Book.update({
      id: req.params.id,
      attributes: req.body.attributes,
      user: (req as any)?.session?.passport?.user as UserType,
      projectId: req.body.projectId,
    });

    res.json(page);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function destroy(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    await Book.delete({
      id: req.params.id,
      projectId: req.query?.projectId as string,
    });

    res.json({});
  } catch (e) {
    console.log(e);
    next(e);
  }
}

const router = Router({ mergeParams: true });

// table data crud apis
router.get('/api/v1/docs/book/:id', apiMetrics, ncMetaAclMw(get, 'bookGet'));
router.get('/api/v1/docs/books', apiMetrics, ncMetaAclMw(list, 'bookList'));
router.post('/api/v1/docs/book', apiMetrics, ncMetaAclMw(create, 'bookCreate'));
router.put(
  '/api/v1/docs/book/:id',
  apiMetrics,
  ncMetaAclMw(update, 'bookUpdate')
);
router.delete(
  '/api/v1/docs/book/:id',
  apiMetrics,
  ncMetaAclMw(destroy, 'bookDelete')
);

export default router;
