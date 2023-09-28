import { Injectable } from '@nestjs/common';
import type { DocsPageType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { Base } from '~/models';
import { PageDao } from '~/daos/page.dao';

@Injectable()
export class PublicDocsService {
  constructor(private readonly pageDao: PageDao) {}

  async getPublicPageAndProject(param: { baseId: string; pageId: string }) {
    const base = await Base.getWithInfo(param.baseId as string);
    const baseMeta =
      typeof base?.meta === 'string' ? JSON.parse(base?.meta) : base?.meta;

    const page = await this.pageDao.get({
      id: param.pageId,
      baseId: param?.baseId,
    });

    if (!page) NcError.notFound('Page not found');

    // if page and base is not public, check if the given parent page is published with nested pages
    if (!page.is_published && !baseMeta?.isPublic) {
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
      base: {
        id: base.id,
        title: base.title,
        meta: base.meta,
      },
    };
  }

  async listPublicPages(param: { baseId: string; parentPageId: string }) {
    const base = await Base.getWithInfo(param.baseId as string);
    const baseMeta =
      typeof base?.meta === 'string' ? JSON.parse(base?.meta) : base?.meta;

    if (baseMeta?.isPublic) {
      return await this.pageDao.nestedListAll({
        baseId: param.baseId,
      });
    }

    const page = await this.pageDao.get({
      id: param.parentPageId,
      baseId: param.baseId,
    });

    if (!page) NcError.notFound('Page not found');

    if (!page.is_published) {
      NcError.notFound('Page is not found.');
    }

    return await this.pageDao.nestedList({
      baseId: param.baseId,
      parent_page_id: page.nested_published_parent_id ?? param.parentPageId,
    });
  }
}
