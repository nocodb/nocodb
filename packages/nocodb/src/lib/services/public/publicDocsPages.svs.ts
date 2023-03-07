import Page from '../../models/Page';
import { NcError } from '../../meta/helpers/catchError';
import Project from '../../models/Project';

export async function get(param: {
  projectId: string;
  pageId: string;
  nestedPageId: string;
}) {
  const project = await Project.getWithInfo(param.projectId as string);
  const projectMeta =
    typeof project.meta === 'string'
      ? JSON.parse(project.meta as string)
      : project.meta;

  const page = await Page.get({
    id: param.pageId,
    projectId: param?.projectId,
  });

  if (!page) NcError.notFound('Page not found');

  // if page and project is not public, check if the given parent page is published with nested pages
  if (!projectMeta?.isPublic && !page.is_published) {
    const parentPage = await Page.get({
      id: param.nestedPageId,
      projectId: param.projectId,
    });

    if (!parentPage?.is_nested_published) NcError.notFound('Page not found');

    if (
      page.id !== parentPage.id &&
      !Page.isParent({
        parentId: parentPage.id,
        pageId: page.id,
        projectId: param.projectId,
      })
    ) {
      NcError.notFound('Page is not found.');
    }
  }

  return page;
}

export async function list(param: { projectId: string; parentPageId: string }) {
  const project = await Project.getWithInfo(param.projectId);
  const projectMeta =
    typeof project.meta === 'string'
      ? JSON.parse(project.meta as string)
      : project.meta;

  if (!projectMeta?.isPublic && !param.parentPageId)
    throw new Error('Project is not found');

  if (projectMeta?.isPublic) {
    return await Page.nestedList({
      projectId: param.projectId,
    });
  }

  const page = await Page.get({
    id: param.parentPageId,
    projectId: param.projectId,
  });
  if (!page) NcError.notFound('Page not found');

  if (page.is_published && page.is_nested_published) {
    return await Page.nestedList({
      projectId: param.projectId,
      parent_page_id: param.parentPageId,
      fetchAll: false,
    });
  }

  return [page];
}
