import slugify from 'slug';
import Noco from '../Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import NocoCache from '../cache/NocoCache';
import { updatePageService } from '../services/docs/pageUpdater.svc';
import Project from './Project';
import type { DocsPageType, UserType } from 'nocodb-sdk';
import type NcMetaIO from '../meta/NcMetaIO';
const { v4: uuidv4 } = require('uuid');

export default class Page {
  public id: string;
  public title: string;
  public description: string;
  public content: string;
  public slug: string;
  public parent_page_id: string;
  public order: number;

  constructor(attr: Partial<Page>) {
    Object.assign(this, attr);
  }

  public static async tableName({
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

  static async createPageTable(
    { projectId, workspaceId }: { projectId: string; workspaceId?: string },
    ncMeta = Noco.ncMeta
  ) {
    const knex = ncMeta.knex;
    const pageTableName = await Page.tableName({ projectId, workspaceId });

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

  public static async create(
    {
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
        title: string;
        description?: string;
        content: string;
        parent_page_id: string;
        order?: number;
        published_content?: string;
        is_published?: boolean;
      };
      projectId: string;
      user: UserType;
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType> {
    const { id: createdPageId } = await ncMeta.metaInsert2(
      null,
      null,
      await Page.tableName({ projectId }),
      {
        project_id: projectId,
        title: title,
        description: description,
        content: content,
        parent_page_id: parent_page_id,
        slug: await this.uniqueSlug(
          {
            title,
            projectId,
            parent_page_id,
          },
          ncMeta
        ),
        published_content,
        is_published,
        order: order,
        created_by_id: user.id,
      } as Partial<DocsPageType>
    );

    if (parent_page_id) {
      const parentPage = await this.get(
        {
          id: parent_page_id,
          projectId,
        },
        ncMeta
      );

      await this._updatePage(
        {
          pageId: parent_page_id,
          projectId,
          attributes: {
            is_parent: true,
          },
        },
        ncMeta
      );

      if (parentPage?.is_published) {
        await this._updatePage(
          {
            pageId: createdPageId,
            projectId,
            attributes: {
              is_published: true,
              nested_published_parent_id: parentPage.nested_published_parent_id,
            },
          },
          ncMeta
        );
      }
    }

    await this.updateOrderAfterCreate({ parent_page_id, projectId });

    const createdPage = await ncMeta.metaGet2(
      null,
      null,
      await Page.tableName({ projectId }),
      createdPageId
    );

    await NocoCache.set(
      `${CacheScope.DOCS_PAGE}:${projectId}:${createdPageId}`,
      createdPage
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

  public static async get(
    {
      id,
      projectId,
      fields,
    }: {
      id: string;
      projectId: string;
      fields?: string[];
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType | undefined> {
    if (!id) throw new Error('Page id is required');

    let page = await NocoCache.get(
      `${CacheScope.DOCS_PAGE}:${projectId}:${id}`,
      CacheGetType.TYPE_OBJECT
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

    page = await ncMeta.metaGet2(
      null,
      null,
      await Page.tableName({ projectId }),
      id,
      fields
    );

    if (page) {
      const pageWithAllFields = await ncMeta.metaGet2(
        null,
        null,
        await Page.tableName({ projectId }),
        id
      );

      if (pageWithAllFields?.project_id !== projectId) {
        return undefined;
      }

      await NocoCache.set(
        `${CacheScope.DOCS_PAGE}:${projectId}:${id}`,
        pageWithAllFields
      );
    }

    return page as DocsPageType | undefined;
  }

  static async _updatePage(
    {
      pageId,
      projectId,
      attributes,
    }: {
      pageId: string;
      projectId: string;
      attributes: Partial<DocsPageType>;
    },
    ncMeta: NcMetaIO
  ) {
    await ncMeta.metaUpdate(
      null,
      null,
      await Page.tableName({ projectId }),
      { ...attributes },
      pageId
    );

    const updatedPage = await ncMeta.metaGet2(
      null,
      null,
      await Page.tableName({ projectId }),
      pageId
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
        CacheDelDirection.CHILD_TO_PARENT
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

    return await this.get({ id: pageId, projectId }, ncMeta);
  }

  public static async update(
    {
      pageId,
      projectId,
      attributes,
      user,
    }: {
      pageId: string;
      projectId: string;
      attributes: Partial<DocsPageType>;
      user: UserType;
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType> {
    return await updatePageService(
      {
        pageId,
        projectId,
        attributes,
        user,
      },
      ncMeta
    );
  }

  public static async getChildPages({
    projectId,
    parent_page_id,
    condition = {},
    ncMeta = Noco.ncMeta,
  }): Promise<Page[]> {
    let pageList = await NocoCache.getList(
      `${CacheScope.DOCS_PAGE}:${projectId}`,
      [parent_page_id ?? 'root', 'children']
    );

    if (pageList.length === 0 && parent_page_id) {
      const parentPage = await this.get(
        { id: parent_page_id, projectId },
        ncMeta
      );
      if (!parentPage?.is_parent) {
        return [];
      }
    }

    if (pageList.length === 0) {
      pageList = await ncMeta.metaList2(
        null,
        null,
        await Page.tableName({ projectId }),
        {
          condition: {
            project_id: projectId,
            parent_page_id: parent_page_id,
            ...condition,
          },
        }
      );

      await NocoCache.setList(
        `${CacheScope.DOCS_PAGE}:${projectId}`,
        [parent_page_id ?? 'root', 'children'],
        pageList
      );
    }

    if (!pageList || pageList.length === 0) return [];

    pageList.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return pageList;
  }

  public static async list(
    {
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
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType[]> {
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
        pageList = await NocoCache.getList(
          `${CacheScope.DOCS_PAGE}:${projectId}`,
          []
        );
      } else {
        pageList = await NocoCache.getList(
          `${CacheScope.DOCS_PAGE}:${projectId}`,
          [parent_page_id ?? 'root', 'children']
        );
      }

      if (pageList.length === 0 && !fetchAll && parent_page_id) {
        const parentPage = await this.get(
          { id: parent_page_id, projectId },
          ncMeta
        );
        if (!parentPage?.is_parent) return [];
      }
    }

    if (!pageList || pageList.length === 0) {
      pageList = await ncMeta.metaList2(
        null,
        null,
        await Page.tableName({ projectId }),
        {
          condition,
          fields: fields ?? [
            'id',
            'title',
            'slug',
            'order',
            'parent_page_id',
            'is_parent',
            'is_published',
            'nested_published_parent_id',
            'updated_at',
            'created_at',
            'last_updated_by_id',
            'last_published_by_id',
            'created_by_id',
            'icon',
          ],
        }
      );

      if (fetchAll) {
        await NocoCache.setList(
          `${CacheScope.DOCS_PAGE}:${projectId}`,
          [],
          pageList
        );
      } else {
        await NocoCache.setList(
          `${CacheScope.DOCS_PAGE}:${projectId}`,
          [parent_page_id ?? 'root', 'children'],
          pageList
        );
      }
    }

    pageList.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return pageList;
  }

  static async nestedChildren({
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
      })
    );

    return nestedPagesWithChildren;
  }

  public static async nestedListAll({
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
      parentPageId: string | undefined
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

  public static async nestedList({
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

  public static async count({
    projectId,
  }: {
    projectId: string;
  }): Promise<number> {
    return await Noco.ncMeta.metaCount(
      null,
      null,
      await Page.tableName({ projectId }),
      {}
    );
  }

  public static async delete(
    { id, projectId },
    ncMeta = Noco.ncMeta
  ): Promise<void> {
    const page = await this.get({ id, projectId }, ncMeta);
    if (!page) throw new Error('Page not found');

    if (page.project_id !== projectId) throw new Error('Page not found');

    const childPages = await this.getChildPages({
      parent_page_id: id,
      projectId,
    });

    if (childPages?.length > 0) {
      await Promise.all(
        childPages.map((childPage) =>
          this.delete({ id: childPage.id, projectId }, ncMeta)
        )
      );
    }

    await ncMeta.metaDelete(null, null, await Page.tableName({ projectId }), {
      id,
    });

    await NocoCache.deepDel(
      CacheScope.DOCS_PAGE,
      `${CacheScope.DOCS_PAGE}:${projectId}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT
    );
  }

  static async updateOrderAfterCreate(
    {
      parent_page_id,
      projectId,
    }: {
      projectId: string;
      parent_page_id?: string;
    },
    ncMeta = Noco.ncMeta
  ) {
    const pages = await this.list(
      { parent_page_id, projectId, ignoreCache: true },
      ncMeta
    );

    // update order for pages
    for (const [i, b] of Object.entries(pages)) {
      b.order = parseInt(i) + 1;

      await this._updatePage(
        {
          pageId: b.id,
          projectId,
          attributes: {
            order: b.order,
          },
        },
        ncMeta
      );
    }
  }

  public static async uniqueSlug(
    {
      title,
      projectId,
      parent_page_id,
    }: {
      title: string;
      projectId: string;
      parent_page_id?: string;
    },
    ncMeta = Noco.ncMeta
  ) {
    const slug = slugify(title);
    const count = await ncMeta.metaCount(
      null,
      null,
      await Page.tableName({ projectId }),
      {
        condition: {
          slug,
          parent_page_id: parent_page_id ?? null,
        },
      }
    );

    if (count === 0) return slug;

    let newSlug;
    let collisionCount = 0;
    let slugCount = -1;
    while (slugCount !== 0) {
      newSlug = slug + '-' + String(count + collisionCount);
      slugCount = await ncMeta.metaCount(
        null,
        null,
        await Page.tableName({ projectId }),
        {
          condition: {
            slug: newSlug,
            parent_page_id: parent_page_id ?? null,
          },
        }
      );
      if (slugCount === 0) return newSlug;

      collisionCount = collisionCount + 1;
    }
  }

  static async parents({
    projectId,
    pageId,
  }: {
    projectId: string;
    pageId: string;
  }) {
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

  static async hasParent({
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

  private static async appendToCacheChildList({
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

    const existingList = await NocoCache.getList(scope, subKeys);
    if (existingList.length === 0) {
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
      `${CacheScope.DOCS_PAGE}:${projectId}:${pageId}`
    );
  }

  static async appendToAllPagesCacheList({
    projectId,
    pageId,
  }: {
    projectId: string;
    pageId: string;
  }) {
    await NocoCache.appendToList(
      `${CacheScope.DOCS_PAGE}:${projectId}`,
      [],
      `${CacheScope.DOCS_PAGE}:${projectId}:${pageId}`
    );
  }

  static async dropPageTable(
    { projectId }: { projectId: string },
    ncMeta = Noco.ncMeta
  ) {
    const knex = ncMeta.knex;
    await knex.schema.dropTable(await Page.tableName({ projectId }));
  }
}
