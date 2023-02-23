import Noco from '../Noco';
import { CacheScope, MetaTable } from '../utils/globals';
import NocoCache from '../cache/NocoCache';
import slugify from 'slug';
import { DocsPageType, UserType } from 'nocodb-sdk';
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

  public static tableName({ projectId }: { projectId: string }) {
    return `nc_d_page_${projectId}`;
  }

  static async createPageTable(
    { projectId }: { projectId: string },
    ncMeta = Noco.ncMeta
  ) {
    const knex = ncMeta.knex;
    await knex.schema.createTable(Page.tableName({ projectId }), (table) => {
      table.string('id', 20).primary().notNullable();

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
        .references(`${Page.tableName({ projectId })}.id`)
        .withKeyName(`nc_page_parent_${uuidv4()}`);

      table.boolean('is_published').defaultTo(false);
      table.datetime('last_published_date').nullable();
      table.string('last_published_by_id', 20).nullable();
      table
        .foreign('last_published_by_id')
        .references(`${MetaTable.USERS}.id`)
        .withKeyName(`nc_page_last_published_id_${uuidv4()}`);

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
      Page.tableName({ projectId }),
      {
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
      await ncMeta.metaUpdate(
        null,
        null,
        Page.tableName({ projectId }),
        {
          is_parent: true,
        },
        parent_page_id
      );
    }

    await this.reorder({ parent_page_id, projectId });

    return await this.get({ id: createdPageId, projectId }, ncMeta);
  }

  public static async get(
    {
      id,
      projectId,
    }: {
      id: string;
      projectId: string;
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType> {
    // todo: Add cache
    let page = undefined;
    if (!page) {
      page = await ncMeta.metaGet2(
        null,
        null,
        Page.tableName({ projectId }),
        id
      );
      if (page) {
        await NocoCache.set(`${CacheScope.DOCS_PAGE}:${id}`, page);
      }
    }

    return page;
  }

  public static async getBySlug(
    {
      nestedSlug,
      projectId,
    }: {
      nestedSlug: string;
      projectId: string;
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType> {
    const slugsArr = nestedSlug.split('/');
    // todo: Add cache
    let page = undefined;
    if (!page) {
      for (const slug of slugsArr) {
        page = await ncMeta.metaGet2(
          null,
          null,
          Page.tableName({ projectId }),
          {
            slug,
            parent_page_id: page?.id || null,
          }
        );
      }
      if (page) {
        await NocoCache.set(`${CacheScope.DOCS_PAGE}:${page.id}`, page);
      }
    }

    return page;
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
    // const now = new Date();
    const previousPage = await this.get({ id: pageId, projectId });
    if (!previousPage) throw new Error('Page not found');

    if (attributes.title === previousPage.title) delete attributes.title;

    if (attributes.title) {
      if (attributes.title.length === 0) {
        throw new Error('Title cannot be empty');
      }

      const uniqueSlug = await this.uniqueSlug({
        projectId,
        parent_page_id: previousPage.parent_page_id,
        title: attributes.title,
      });

      attributes.slug = uniqueSlug;
    }

    if ('is_published' in attributes && attributes.is_published) {
      // todo: Set published date
      // attributes.last_published_date = now.toISOString();
      attributes.last_published_by_id = user.id;
      attributes.published_content = attributes.content || previousPage.content;
    }

    attributes.last_updated_by_id = user.id;

    await ncMeta.metaUpdate(
      null,
      null,
      Page.tableName({ projectId }),
      { ...attributes },
      pageId
    );

    // if parent page is changed, update is_parent flag of previous parent page
    if (
      'parent_page_id' in attributes &&
      previousPage.parent_page_id &&
      attributes.parent_page_id !== previousPage.parent_page_id
    ) {
      const previousParentChildren = await this.getChildPages({
        parent_page_id: previousPage.parent_page_id,
        projectId,
      });
      if (previousParentChildren.length === 0) {
        await ncMeta.metaUpdate(
          null,
          null,
          Page.tableName({ projectId }),
          {
            is_parent: false,
          },
          previousPage.parent_page_id
        );
      }
    }

    if (attributes.order) {
      await this.reorder({
        projectId,
        parent_page_id: attributes.parent_page_id,
        keepPageId: pageId,
      });
    }

    if (attributes.parent_page_id) {
      await ncMeta.metaUpdate(
        null,
        null,
        Page.tableName({ projectId }),
        {
          is_parent: true,
        },
        attributes.parent_page_id
      );
      const currentPage = await this.get({ id: pageId, projectId });

      // Since there can be slug collision, when page is moved to a new parent
      const uniqueSlug = await this.uniqueSlug(
        {
          projectId,
          parent_page_id: attributes.parent_page_id,
          title: currentPage.title,
        },
        ncMeta
      );
      if (uniqueSlug !== currentPage.slug) {
        await ncMeta.metaUpdate(
          null,
          null,
          Page.tableName({ projectId }),
          {
            slug: uniqueSlug,
          },
          pageId
        );
      }
    }

    return await this.get({ id: pageId, projectId });
  }

  public static async getChildPages({
    projectId,
    parent_page_id,
    ncMeta = Noco.ncMeta,
  }): Promise<Page[]> {
    const pageList = await ncMeta.metaList2(
      null,
      null,
      Page.tableName({ projectId }),
      {
        condition: {
          parent_page_id: parent_page_id,
        },
      }
    );

    if (!pageList || pageList.length === 0) return [];

    pageList.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return pageList;
  }

  public static async list(
    {
      parent_page_id,
      fetchAll,
      projectId,
    }: {
      parent_page_id?: string;
      fetchAll?: boolean;
      projectId: string;
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType[]> {
    const pageList = await ncMeta.metaList2(
      null,
      null,
      Page.tableName({ projectId }),
      {
        condition: fetchAll
          ? {}
          : {
              parent_page_id: parent_page_id ?? null,
            },
        fields: [
          'id',
          'title',
          'slug',
          'order',
          'parent_page_id',
          'is_parent',
          'is_published',
          'updated_at',
          'created_at',
          'last_updated_by_id',
          'last_published_by_id',
          'created_by_id',
          'icon',
        ],
      }
    );

    pageList.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return pageList;
  }

  public static async nestedList({
    projectId,
    parent_page_id,
  }: {
    projectId: string;
    parent_page_id?: string;
  }): Promise<Array<DocsPageType & { children: any[]; isLeaf: boolean }>> {
    const nestedList = await this.list({
      projectId,
      parent_page_id,
      fetchAll: true,
    });

    if (!nestedList || nestedList.length === 0) return [];

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
    > = arrayToTree(nestedList, parent_page_id);

    return nestedListWithChildren;
  }

  public static async count({
    projectId,
  }: {
    projectId: string;
  }): Promise<number> {
    return await Noco.ncMeta.metaCount(
      null,
      null,
      Page.tableName({ projectId }),
      {}
    );
  }

  public static async delete(
    { id, projectId },
    ncMeta = Noco.ncMeta
  ): Promise<void> {
    const page = await this.get({ id, projectId }, ncMeta);
    if (!page) throw new Error('Page not found');

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

    return ncMeta.metaDelete(null, null, Page.tableName({ projectId }), {
      id,
    });
  }

  static async reorder(
    {
      parent_page_id,
      keepPageId,
      projectId,
    }: {
      projectId: string;
      parent_page_id?: string;
      keepPageId?: string;
    },
    ncMeta = Noco.ncMeta
  ) {
    const pages = await this.list({ parent_page_id, projectId }, ncMeta);

    if (keepPageId) {
      const kpPage = pages.splice(
        pages.indexOf(pages.find((base) => base.id === keepPageId)),
        1
      );
      if (kpPage.length) {
        pages.splice(kpPage[0].order - 1, 0, kpPage[0]);
      }
    }

    // update order for pages
    for (const [i, b] of Object.entries(pages)) {
      b.order = parseInt(i) + 1;

      await ncMeta.metaUpdate(
        null,
        null,
        Page.tableName({ projectId }),
        {
          order: b.order,
        },
        b.id
      );
    }
  }

  private static async uniqueSlug(
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
      Page.tableName({ projectId }),
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
        Page.tableName({ projectId }),
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

  static async drafts({ projectId }: { projectId: string }) {
    const knex = Noco.ncMeta.knex;
    const pages: DocsPageType[] = (await knex(
      Page.tableName({ projectId })
    ).orderBy('updated_at', 'asc')) as any;

    return pages.filter((p) => {
      return p.content !== p.published_content || p.title !== p.published_title;
    });
  }

  static async publish({
    projectId,
    pageId,
    userId,
  }: {
    projectId: string;
    pageId: string;
    userId: string;
  }) {
    const knex = Noco.ncMeta.knex;
    const page = await this.get({ projectId, id: pageId });

    if (!page) throw new Error('Page not found');

    await knex(Page.tableName({ projectId })).where({ id: pageId }).update({
      published_content: page.content,
      published_title: page.title,
      is_published: true,
      last_published_date: new Date(),
      last_published_by_id: userId,
    });
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

  static async paginate({
    projectId,
    pageNumber = 1,
    perPage = 10,
    orderBy = 'updated_at',
    order = 'desc',
    condition = {},
  }: {
    projectId: string;
    pageNumber?: number;
    perPage?: number;
    orderBy?: string;
    order?: 'asc' | 'desc';
    condition?: any;
  }) {
    const knex = Noco.ncMeta.knex;
    const pages = await knex(Page.tableName({ projectId }))
      .where(condition)
      .orderBy(orderBy, order)
      .offset((pageNumber - 1) * perPage)
      .limit(perPage);

    const total = await knex(Page.tableName({ projectId }))
      .where(condition)
      .count('id as total')
      .first();

    return {
      pages,
      total: total.total,
    };
  }

  static async search({
    projectId,
    query,
    pageNumber = 1,
    perPage = 10,
    orderBy = 'updated_at',
    order = 'desc',
  }: {
    projectId: string;
    query: string;
    pageNumber?: number;
    perPage?: number;
    orderBy?: string;
    order?: 'asc' | 'desc';
  }) {
    const knex = Noco.ncMeta.knex;
    const pages = await knex(Page.tableName({ projectId }))
      .whereILike('title', `%${query}%`)
      .orderBy(orderBy, order)
      .offset((pageNumber - 1) * perPage)
      .limit(perPage);

    return {
      pages,
    };
  }

  static async dropPageTable(
    { projectId }: { projectId: string },
    ncMeta = Noco.ncMeta
  ) {
    const knex = ncMeta.knex;
    await knex.schema.dropTable(Page.tableName({ projectId }));
  }
}
