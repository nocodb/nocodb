import { Injectable } from '@nestjs/common';
import type { DocsPageType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { Project } from '~/models';
import { PageDao } from '~/daos/page.dao';

@Injectable()
export class PublicDocsService {
  constructor(private readonly pageDao: PageDao) {}

  async getPublicPageAndProject(param: { projectId: string; pageId: string }) {
    const project = await Project.getWithInfo(param.projectId as string);
    const projectMeta =
      typeof project?.meta === 'string'
        ? JSON.parse(project?.meta)
        : project?.meta;

    const page = await this.pageDao.get({
      id: param.pageId,
      projectId: param?.projectId,
    });

    if (!page) NcError.notFound('Page not found');

    // if page and project is not public, check if the given parent page is published with nested pages
    if (!page.is_published && !projectMeta?.isPublic) {
      NcError.notFound('Page is not found.');
    }

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
      } as Partial<DocsPageType>,
      project: {
        id: project.id,
        title: project.title,
        meta: project.meta,
      },
    };
  }

  async listPublicPages(param: { projectId: string; parentPageId: string }) {
    const project = await Project.getWithInfo(param.projectId as string);
    const projectMeta =
      typeof project?.meta === 'string'
        ? JSON.parse(project?.meta)
        : project?.meta;

    if (projectMeta?.isPublic) {
      return await this.pageDao.nestedListAll({
        projectId: param.projectId,
      });
    }

    const page = await this.pageDao.get({
      id: param.parentPageId,
      projectId: param.projectId,
    });

    if (!page) NcError.notFound('Page not found');

    if (!page.is_published) {
      NcError.notFound('Page is not found.');
    }

    return await this.pageDao.nestedList({
      projectId: param.projectId,
      parent_page_id: page.nested_published_parent_id ?? param.parentPageId,
    });
  }
}
