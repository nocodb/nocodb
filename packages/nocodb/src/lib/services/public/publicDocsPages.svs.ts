import Page from '../../models/Page';
import { NcError } from '../../meta/helpers/catchError';
import Project from '../../models/Project';

export async function get(param: { projectId: string; pageId: string }) {
  const project = await Project.getWithInfo(param.projectId as string);
  const projectMeta =
    typeof project?.meta === 'string'
      ? JSON.parse(project?.meta)
      : project?.meta;

  const page = await Page.get({
    id: param.pageId,
    projectId: param?.projectId,
  });

  if (!page) NcError.notFound('Page not found');

  // if page and project is not public, check if the given parent page is published with nested pages
  if (!page.is_published && !projectMeta?.isPublic) {
    NcError.notFound('Page is not found.');
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  return {
    page: {
      id: page.id,
      title: page.title,
      content: page.content,
      is_published: page.is_published,
      nested_published_parent_id: page.nested_published_parent_id,
      last_published_date: page.last_published_date,
      last_published_by_id: page.last_published_by_id,
      published_content: page.published_content,
      is_parent: page.is_parent,
      parent_page_id: page.parent_page_id,
      order: page.order,
      icon: page.icon,
    } as Partial<Page>,
    project: {
      id: project.id,
      title: project.title,
      meta: project.meta,
    },
  };
}

export async function list(param: { projectId: string; parentPageId: string }) {
  const project = await Project.getWithInfo(param.projectId as string);
  const projectMeta =
    typeof project?.meta === 'string'
      ? JSON.parse(project?.meta)
      : project?.meta;

  if (projectMeta?.isPublic) {
    return await Page.nestedListAll({
      projectId: param.projectId,
    });
  }

  const page = await Page.get({
    id: param.parentPageId,
    projectId: param.projectId,
  });

  if (!page) NcError.notFound('Page not found');

  if (!page.is_published) {
    NcError.notFound('Page is not found.');
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  return await Page.nestedList({
    projectId: param.projectId,
    parent_page_id: page.nested_published_parent_id ?? param.parentPageId,
  });
}
