import slugify from 'slug';
import { Injectable } from '@nestjs/common';
import { Project } from '../models';
import { NcError } from '../helpers/catchError';

import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import NocoCache from '../cache/NocoCache';

import { MetaService } from '../meta/meta.service';
import type { DocsPageType, UserType } from 'nocodb-sdk';

const { v4: uuidv4 } = require('uuid');

@Injectable()
export class PageDao {
  constructor(private meta: MetaService) {}

  public async tableName({
    projectId,
    workspaceId,
  }: {
    projectId: string;
    workspaceId?: string;
  }) {
    const prefix = 'nc_d_page_';
    if (workspaceId) return `${prefix}${workspaceId}`;

    const project = await Project.get(projectId);
    return `${prefix}${project.fk_workspace_id}`;
  }

  async createPageTable({
    projectId,
    workspaceId,
  }: {
    projectId: string;
    workspaceId?: string;
  }) {
    const knex = this.meta.knex;
    const pageTableName = await this.tableName({ projectId, workspaceId });

    await knex.schema.createTable(pageTableName, (table) => {
      table.string('id', 20).primary().notNullable();

      table.string('project_id', 20).notNullable();
      table
        .foreign('project_id')
        .references(`${MetaTable.PROJECT}.id`)
        .withKeyName(`nc_page_fk_project_id_${uuidv4()}`);

      table.string('title', 150).notNullable();
      table.string('published_title', 150);
      table.text('description', 'longtext').defaultTo('');

      table.text('content', 'longtext').defaultTo('');
      table.text('published_content', 'longtext').defaultTo('');
      table.string('slug', 150).notNullable();

      table.boolean('is_parent').defaultTo(false);
      table.string('parent_page_id', 20).nullable();
      table
        .foreign('parent_page_id')
        .references(`${pageTableName}.id`)
        .withKeyName(`nc_page_parent_${uuidv4()}`);

      table.boolean('is_published').defaultTo(false);
      table.datetime('last_published_date').nullable();
      table.string('last_published_by_id', 20).nullable();
      table
        .foreign('last_published_by_id')
        .references(`${MetaTable.USERS}.id`)
        .withKeyName(`nc_page_last_published_id_${uuidv4()}`);

      table.string('nested_published_parent_id', 20).nullable();
      table
        .foreign('nested_published_parent_id')
        .references(`${pageTableName}.id`)
        .withKeyName(`nc_p_nest_publish_parent_id_${uuidv4()}`);

      table.string('last_updated_by_id', 20).nullable();
      table
        .foreign('last_updated_by_id')
        .references(`${MetaTable.USERS}.id`)
        .withKeyName(`nc_page_last_updated_id_${uuidv4()}`);

      table.string('created_by_id', 20).notNullable();
      table
        .foreign('created_by_id')
        .references(`${MetaTable.USERS}.id`)
        .withKeyName(`nc_page_last_created_id_${uuidv4()}`);

      table.timestamp('archived_date').nullable();
      table.string('archived_by_id', 20).nullable();
      table
        .foreign('archived_by_id')
        .references(`${MetaTable.USERS}.id`)
        .withKeyName(`nc_page_last_archived_id_${uuidv4()}`);

      table.text('metaJson', 'longtext').defaultTo('{}');

      table.float('order');

      table.string('icon');

      table.datetime('created_at', { useTz: true });
      table.datetime('updated_at', { useTz: true });
    });
  }

  public async create({
    attributes: {
      title,
      description,
      content,
      parent_page_id,
      order,
      published_content,
      is_published,
    },
    projectId,
    user,
  }: {
    attributes: {
      title?: string;
      description?: string;
      content?: string;
      parent_page_id?: string;
      order?: number;
      published_content?: string;
      is_published?: boolean;
    };
    projectId: string;
    user: UserType;
  }): Promise<DocsPageType> {
    if (!title) throw NcError.badRequest('Title is required');

    const { id: createdPageId } = await this.meta.metaInsert2(
      null,
      null,
      await this.tableName({ projectId }),
      {
        project_id: projectId,
        title: title,
        description: description,
        content: content,
        parent_page_id: parent_page_id,
        slug: await this.uniqueSlug({
          title,
          projectId,
          parent_page_id,
        }),
        published_content,
        is_published,
        order: order,
        created_by_id: user.id,
      } as Partial<DocsPageType>,
    );

    if (parent_page_id) {
      const parentPage = await this.get({
        id: parent_page_id,
        projectId,
      });

      await this.updatePage({
        pageId: parent_page_id,
        projectId,
        attributes: {
          is_parent: true,
        },
      });

      if (parentPage?.is_published) {
        await this.updatePage({
          pageId: createdPageId,
          projectId,
          attributes: {
            is_published: true,
            nested_published_parent_id: parentPage.nested_published_parent_id,
          },
        });
      }
    }

    await this.updateOrderAfterCreate({ parent_page_id, projectId });

    const createdPage = await this.meta.metaGet2(
      null,
      null,
      await this.tableName({ projectId }),
      createdPageId,
    );

    await NocoCache.set(
      `${CacheScope.DOCS_PAGE}:${projectId}:${createdPageId}`,
      createdPage,
    );
    await this.appendToAllPagesCacheList({
      pageId: createdPageId,
      projectId,
    });
    await this.appendToCacheChildList({
      parentPageId: parent_page_id,
      pageId: createdPageId,
      projectId,
    });

    return createdPage;
  }

  public async get({
    id,
    projectId,
    fields,
  }: {
    id: string;
    projectId: string;
    fields?: string[];
  }): Promise<DocsPageType | undefined> {
    if (!id) throw new Error('Page id is required');

    let page = await NocoCache.get(
      `${CacheScope.DOCS_PAGE}:${projectId}:${id}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (page && page?.project_id !== projectId) {
      return undefined;
    }

    if (page) {
      // Remove fields that are not requested
      if (!fields) {
        return page;
      }

      const filteredPage = {};
      for (const field of fields) {
        filteredPage[field] = page[field];
      }

      return filteredPage as DocsPageType;
    }

    page = await this.meta.metaGet2(
      null,
      null,
      await this.tableName({ projectId }),
      id,
      fields,
    );

    if (page) {
      const pageWithAllFields = await this.meta.metaGet2(
        null,
        null,
        await this.tableName({ projectId }),
        id,
      );

      if (pageWithAllFields?.project_id !== projectId) {
        return undefined;
      }

      await NocoCache.set(
        `${CacheScope.DOCS_PAGE}:${projectId}:${id}`,
        pageWithAllFields,
      );
    }

    return page as DocsPageType | undefined;
  }

  async updatePage({
    pageId,
    projectId,
    attributes,
  }: {
    pageId: string;
    projectId: string;
    attributes: Partial<DocsPageType>;
  }) {
    await this.meta.metaUpdate(
      null,
      null,
      await this.tableName({ projectId }),
      { ...attributes },
      pageId,
    );

    const updatedPage = await this.meta.metaGet2(
      null,
      null,
      await this.tableName({ projectId }),
      pageId,
    );

    // get existing cache
    const key = `${CacheScope.DOCS_PAGE}:${projectId}:${pageId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o = { ...o, ...updatedPage };

      // set cache
      await NocoCache.set(key, o);
    }

    if ('parent_page_id' in attributes) {
      await NocoCache.deepDel(
        CacheScope.DOCS_PAGE,
        `${CacheScope.DOCS_PAGE}:${projectId}:${pageId}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );

      await NocoCache.set(`${CacheScope.DOCS_PAGE}:${projectId}:${pageId}`, o);

      await this.appendToAllPagesCacheList({
        pageId,
        projectId,
      });
      await this.appendToCacheChildList({
        parentPageId: attributes.parent_page_id,
        pageId,
        projectId,
      });
    }

    return await this.get({ id: pageId, projectId });
  }

  public async getChildPages({
    projectId,
    parent_page_id,
    condition = {},
  }): Promise<DocsPageType[]> {
    const cachedList = await NocoCache.getList(
      `${CacheScope.DOCS_PAGE}:${projectId}`,
      [parent_page_id ?? 'root', 'children'],
    );
    let { list: pageList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !pageList.length && parent_page_id) {
      const parentPage = await this.get({ id: parent_page_id, projectId });
      if (!parentPage?.is_parent) {
        return [];
      }
    }

    if (pageList.length === 0) {
      pageList = await this.meta.metaList2(
        null,
        null,
        await this.tableName({ projectId }),
        {
          condition: {
            project_id: projectId,
            parent_page_id: parent_page_id,
            ...condition,
          },
        } as any,
      );

      await NocoCache.setList(
        `${CacheScope.DOCS_PAGE}:${projectId}`,
        [parent_page_id ?? 'root', 'children'],
        pageList,
      );
    }

    if (!pageList || pageList.length === 0) return [];

    pageList.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return pageList;
  }

  public async list({
    parent_page_id,
    // Is used to fetch all the pages, since parent_page_id is null for root pages
    fetchAll,
    projectId,
    onlyPublished,
    fields,
    ignoreCache,
  }: {
    parent_page_id?: string;
    fetchAll?: boolean;
    projectId: string;
    onlyPublished?: boolean;
    fields?: string[];
    ignoreCache?: boolean;
  }): Promise<DocsPageType[]> {
    const condition: any = {};
    condition.project_id = projectId;

    if (!fetchAll) {
      condition.parent_page_id = parent_page_id ?? null;
    }
    if (onlyPublished) {
      condition.is_published = true;
    }

    let pageList;

    if (!ignoreCache) {
      if (fetchAll) {
        const { list: cachedList } = await NocoCache.getList(
          `${CacheScope.DOCS_PAGE}:${projectId}`,
          [],
        );
        pageList = cachedList;
      } else {
        const { list: cachedList } = await NocoCache.getList(
          `${CacheScope.DOCS_PAGE}:${projectId}`,
          [parent_page_id ?? 'root', 'children'],
        );
        pageList = cachedList;
      }

      if (pageList.length === 0 && !fetchAll && parent_page_id) {
        const parentPage = await this.get({ id: parent_page_id, projectId });
        if (!parentPage?.is_parent) return [];
      }
    }

    if (!pageList || pageList.length === 0) {
      pageList = await this.meta.metaList2(
        null,
        null,
        await this.tableName({ projectId }),
        {
          condition,
        } as any,
      );

      if (fetchAll) {
        await NocoCache.setList(
          `${CacheScope.DOCS_PAGE}:${projectId}`,
          [],
          pageList,
        );
      } else {
        await NocoCache.setList(
          `${CacheScope.DOCS_PAGE}:${projectId}`,
          [parent_page_id ?? 'root', 'children'],
          pageList,
        );
      }
    }

    pageList.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return fields
      ? pageList.map((page) => {
          const obj: any = {};
          fields.forEach((field) => {
            obj[field] = page[field];
          });
          return obj;
        })
      : pageList;
  }

  async nestedChildren({
    projectId,
    parent_page_id,
    onlyPublished = false,
  }: // fields,

  {
    projectId: string;
    parent_page_id?: string;
    onlyPublished?: boolean;
    fields?: string[];
  }) {
    const children = await this.getChildPages({
      projectId,
      parent_page_id,
      condition: onlyPublished ? { is_published: true } : {},
    });

    if (!children || children.length === 0) return [];

    const nestedPagesWithChildren = await Promise.all(
      children.map(async (child) => {
        const children = await this.nestedChildren({
          projectId,
          parent_page_id: child.id,
        });
        return {
          ...child,
          children,
        };
      }),
    );

    return nestedPagesWithChildren;
  }

  public async nestedListAll({
    projectId,
    fields,
  }: {
    projectId: string;
    fields?: string[];
  }) {
    const allPages = await this.list({
      projectId,
      fetchAll: true,
      fields,
    });

    if (!allPages || allPages.length === 0) return [];

    const arrayToTree = (
      arr: DocsPageType[],
      parentPageId: string | undefined,
    ) =>
      arr
        .filter((item) => item.parent_page_id == parentPageId)
        .map((child) => ({
          ...child,
          children: arrayToTree(arr, child.id),
        }));

    const nestedListWithChildren: Array<
      DocsPageType & { children: any[]; isLeaf: boolean }
    > = arrayToTree(allPages, undefined);

    return nestedListWithChildren;
  }

  public async nestedList({
    projectId,
    parent_page_id,
    fields,
  }: {
    projectId: string;
    parent_page_id?: string;
    fields?: string[];
  }): Promise<Array<DocsPageType & { children: any[]; isLeaf: boolean }>> {
    const parentPage: DocsPageType & { children: any[]; isLeaf: boolean } =
      (await this.get({
        id: parent_page_id,
        projectId,
        fields: fields,
      })) as any;

    parentPage.children = await this.nestedChildren({
      projectId,
      fields,
      parent_page_id,
    });
    parentPage.isLeaf = parentPage.children.length === 0;

    return [parentPage];
  }

  public async count({ projectId }: { projectId: string }): Promise<number> {
    return await this.meta.metaCount(
      null,
      null,
      await this.tableName({ projectId }),
      {},
    );
  }

  public async delete({ id, projectId }): Promise<void> {
    const page = await this.get({ id, projectId });
    if (!page) throw new Error('Page not found');

    if (page.project_id !== projectId) throw new Error('Page not found');

    const childPages = await this.getChildPages({
      parent_page_id: id,
      projectId,
    });

    if (childPages?.length > 0) {
      await Promise.all(
        childPages.map((childPage) =>
          this.delete({ id: childPage.id, projectId }),
        ),
      );
    }

    await this.meta.metaDelete(
      null,
      null,
      await this.tableName({ projectId }),
      {
        id,
      },
    );

    await NocoCache.deepDel(
      CacheScope.DOCS_PAGE,
      `${CacheScope.DOCS_PAGE}:${projectId}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  async updateOrderAfterCreate({
    parent_page_id,
    projectId,
  }: {
    projectId: string;
    parent_page_id?: string;
  }) {
    const pages = await this.list({
      parent_page_id,
      projectId,
      ignoreCache: true,
    });

    // update order for pages
    for (const [i, b] of Object.entries(pages)) {
      b.order = parseInt(i) + 1;

      await this.updatePage({
        pageId: b.id,
        projectId,
        attributes: {
          order: b.order,
        },
      });
    }
  }

  public async uniqueSlug({
    title,
    projectId,
    parent_page_id,
  }: {
    title: string;
    projectId: string;
    parent_page_id?: string;
  }) {
    const slug = slugify(title);
    const count = await this.meta.metaCount(
      null,
      null,
      await this.tableName({ projectId }),
      {
        condition: {
          slug,
          parent_page_id: parent_page_id ?? null,
        },
      },
    );

    if (count === 0) return slug;

    let newSlug;
    let collisionCount = 0;
    let slugCount = -1;
    while (slugCount !== 0) {
      newSlug = slug + '-' + String(count + collisionCount);
      slugCount = await this.meta.metaCount(
        null,
        null,
        await this.tableName({ projectId }),
        {
          condition: {
            slug: newSlug,
            parent_page_id: parent_page_id ?? null,
          },
        },
      );
      if (slugCount === 0) return newSlug;

      collisionCount = collisionCount + 1;
    }
  }

  async parents({ projectId, pageId }: { projectId: string; pageId: string }) {
    const page = await this.get({ projectId, id: pageId });

    if (!page) throw new Error('Page not found');

    const parents: DocsPageType[] = [];
    let parent = page;
    while (parent.parent_page_id) {
      parent = await this.get({
        projectId,
        id: parent.parent_page_id,
      });
      parents.push(parent);
    }

    return parents;
  }

  async hasParent({
    projectId,
    pageId,
    parentId,
  }: {
    projectId: string;
    pageId: string;
    parentId: string;
  }) {
    const page = await this.get({ projectId, id: pageId });

    if (!page) throw new Error('Page not found');

    let parent = page;
    while (parent.parent_page_id) {
      parent = await this.get({
        projectId,
        id: parent.parent_page_id,
      });
      if (parent.id === parentId) return true;
    }

    return false;
  }

  private async appendToCacheChildList({
    parentPageId,
    projectId,
    pageId,
  }: {
    parentPageId?: string;
    projectId: string;
    pageId: string;
  }) {
    const scope = `${CacheScope.DOCS_PAGE}:${projectId}`;
    const subKeys = [parentPageId ?? 'root', 'children'];

    const cachedList = await NocoCache.getList(scope, subKeys);
    const { list: existingList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !existingList.length) {
      const existingChildren = parentPageId
        ? await this.getChildPages({
            parent_page_id: parentPageId,
            projectId,
          })
        : await this.list({ projectId, parent_page_id: null });

      if (existingChildren.length !== 0) {
        await NocoCache.setList(scope, subKeys, existingChildren);
      }
    }

    await NocoCache.appendToList(
      scope,
      subKeys,
      `${CacheScope.DOCS_PAGE}:${projectId}:${pageId}`,
    );
  }

  async appendToAllPagesCacheList({
    projectId,
    pageId,
  }: {
    projectId: string;
    pageId: string;
  }) {
    await NocoCache.appendToList(
      `${CacheScope.DOCS_PAGE}:${projectId}`,
      [],
      `${CacheScope.DOCS_PAGE}:${projectId}:${pageId}`,
    );
  }

  async dropPageTable({ projectId }: { projectId: string }) {
    const knex = this.meta.knex;
    await knex.schema.dropTable(await this.tableName({ projectId }));
  }
}
