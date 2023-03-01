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

    const page = await Page.get({
      id: req.params.id,
      projectId: req.query?.projectId as string,
    });

    if (!page) throw new Error('Page not found');

    // if page and project is not public, check if the given parent page is published with nested pages
    if (!projectMeta.isPublic && !page.is_published) {
      const parentPage = await Page.get({
        id: req.query?.nestedPageId as string,
        projectId: req.query?.projectId as string,
      });

      if (!parentPage?.is_nested_published) throw new Error('Page not found.A');

      if (
        page.id !== parentPage.id &&
        !Page.isParent({
          parentId: parentPage.id,
          pageId: page.id,
          projectId: req.query?.projectId as string,
        })
      ) {
        throw new Error('Page is not found.');
      }
    }

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

    if (!projectMeta.isPublic && !req.query?.parent_page_id)
      throw new Error('Project is not found');

    if (projectMeta.isPublic) {
      res.json(
        await Page.nestedList({
          projectId: req.query?.projectId as string,
        })
      );
      return;
    }

    const page = await Page.get({
      id: req.query?.parent_page_id as string,
      projectId: req.query?.projectId as string,
    });
    if (!page) throw new Error('Page not found');

    if (page.is_published && page.is_nested_published) {
      res.json(
        await Page.nestedList({
          projectId: req.query?.projectId as string,
          parent_page_id: req.query?.parent_page_id as string,
          fetchAll: false,
        })
      );
      return;
    }

    res.json([page]);
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
