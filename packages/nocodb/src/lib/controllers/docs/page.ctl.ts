import { Router } from 'express';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import apiMetrics from '../../meta/helpers/apiMetrics';
import { docsPageService } from '../../services';
import type { UserType } from 'nocodb-sdk';
import type { Request, Response } from 'express';

async function get(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  const page = await docsPageService.get({
    fields: req.query?.fields as string[] | string,
    projectId: req.query?.projectId as string,
    id: req.params.id,
  });

  res.json(page);
}

async function list(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  const pages = await docsPageService.list({
    projectId: req.query?.projectId as string,
  });

  res.json(pages);
}

async function create(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  const page = await docsPageService.create({
    attributes: req.body.attributes,
    projectId: req.body.projectId as string,
    user: (req as any)?.session?.passport?.user as UserType,
  });

  res.json(page);
}

async function update(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  const page = await docsPageService.update({
    pageId: req.params.id,
    attributes: req.body.attributes,
    projectId: req.body.projectId as string,
    user: (req as any)?.session?.passport?.user as UserType,
  });

  res.json(page);
}

async function deletePage(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  await docsPageService.deletePage({
    id: req.params.id,
    projectId: req.query?.projectId as string,
  });

  res.json({});
}

async function magicExpand(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  const response = await docsPageService.magicExpand({
    projectId: req.body.projectId,
    pageId: req.body.pageId,
    text: req.body.text,
  });

  res.json(response);
}

async function magicOutline(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  const response = await docsPageService.magicOutline({
    projectId: req.body.projectId,
    pageId: req.body.pageId,
  });

  res.json(response);
}

async function pageParents(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  const data = await docsPageService.pageParents({
    pageId: req.query?.pageId as string,
    projectId: req.query?.projectId as string,
  });

  res.json(data);
}

async function magicCreatePages(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  const response = await docsPageService.magicCreatePages({
    projectId: req.body.projectId,
    pageId: req.body.pageId,
    user: (req as any)?.session?.passport?.user as UserType,
    title: req.body.title,
  });

  res.json(response);
}

async function directoryImport(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response
) {
  const response = await docsPageService.directoryImport({
    projectId: req.body.projectId,
    body: req.body,
    user: (req as any)?.session?.passport?.user as UserType,
  });

  res.json(response);
}

const router = Router({ mergeParams: true });

// table data crud apis
router.get('/api/v1/docs/page/:id', apiMetrics, ncMetaAclMw(get, 'pageGet'));
router.get(
  '/api/v1/docs/page-parents',
  apiMetrics,
  ncMetaAclMw(pageParents, 'pageParents')
);
router.get('/api/v1/docs/pages', apiMetrics, ncMetaAclMw(list, 'pageList'));

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
router.post(
  '/api/v1/docs/page/magic-expand',
  apiMetrics,
  ncMetaAclMw(magicExpand, 'pageMagicExpand')
);
router.post(
  '/api/v1/docs/page/magic-outline',
  apiMetrics,
  ncMetaAclMw(magicOutline, 'pageMagicOutline')
);
router.post(
  '/api/v1/docs/pages/magic',
  apiMetrics,
  ncMetaAclMw(magicCreatePages, 'pageMagicCreate')
);
router.post(
  '/api/v1/docs/pages/import',
  apiMetrics,
  ncMetaAclMw(directoryImport, 'pageDirectoryImport')
);
export default router;
