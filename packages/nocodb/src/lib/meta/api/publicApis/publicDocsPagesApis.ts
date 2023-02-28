import { Request, Response, Router } from 'express';
import apiMetrics from '../../helpers/apiMetrics';
import Page from '../../../models/Page';
import catchError from '../../helpers/catchError';
import Project from '../../../models/Project';

async function get(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const project = await Project.getWithInfo(req.query?.projectId as string);
    const projectMeta = JSON.parse(project.meta);

    if (!projectMeta.isPublic) throw new Error('Project is not found');

    const page = await Page.get({
      id: req.params.id,
      projectId: req.query?.projectId as string,
    });

    if (!page) throw new Error('Page not found');

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
    const project = await Project.getWithInfo(req.query?.projectId as string);
    const projectMeta = JSON.parse(project.meta);

    const pages = await Page.nestedList({
      projectId: req.query?.projectId as string,
    });

    const publishedPages = projectMeta.isPublic
      ? pages
      : pages.filter((page) => page.is_published);

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
