import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import apiMetrics from '../../helpers/apiMetrics';
import Page from '../../../models/Page';
import { UserType } from 'nocodb-sdk';

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
    const page = await Page.create({
      attributes: req.body.attributes,
      bookId: req.body.bookId,
      projectId: req.body.projectId as string,
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
    const page = await Page.update({
      pageId: req.params.id,
      attributes: req.body.attributes,
      projectId: req.body.projectId as string,
      user: (req as any)?.session?.passport?.user as UserType,
      bookId: req.body.bookId,
    });

    res.json(page);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function deletePage(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    await Page.delete({
      id: req.params.id,
      projectId: req.query?.projectId as string,
      bookId: req.query?.bookId,
    });

    res.json({});
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function drafts(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const drafts = await Page.drafts({
      bookId: req.query?.bookId as string,
      projectId: req.query?.projectId as string,
    });

    res // todo: pagination
      .json(drafts);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

const router = Router({ mergeParams: true });

// table data crud apis
router.get('/api/v1/docs/page/:id', apiMetrics, ncMetaAclMw(get, 'pageList'));
router.get('/api/v1/docs/pages', apiMetrics, ncMetaAclMw(list, 'pageList'));
router.get(
  '/api/v1/docs/page-drafts',
  apiMetrics,
  ncMetaAclMw(drafts, 'pageDraftsList')
);

router.post('/api/v1/docs/page', apiMetrics, ncMetaAclMw(create, 'pageCreate'));
router.put(
  '/api/v1/docs/page/:id',
  apiMetrics,
  ncMetaAclMw(update, 'pageUpdate')
);
router.delete(
  '/api/v1/docs/page/:id',
  apiMetrics,
  ncMetaAclMw(deletePage, 'pageDelete')
);

export default router;
