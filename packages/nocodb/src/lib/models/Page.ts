import Noco from '../Noco';
import { CacheScope, MetaTable } from '../utils/globals';
import NocoCache from '../cache/NocoCache';
import slugify from 'slug';
import { DocsPageType, UserType } from 'nocodb-sdk';
import Book from './Book';
const { v4: uuidv4 } = require('uuid');
export default class Page {
  public id: string;
  public title: string;
  public description: string;
  public content: string;
  public slug: string;
  public book_id: string;
  public parent_page_id: string;
  public order: number;

  constructor(attr: Partial<Page>) {
    Object.assign(this, attr);
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
      bookId,
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
      bookId: string;
      projectId: string;
      user: UserType;
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType> {
    const { id: createdPageId } = await ncMeta.metaInsert2(
      null,
      null,
      Page.tableName({ projectId, bookId }),
      {
        title: title,
        description: description,
        content: content,
        parent_page_id: parent_page_id,
        slug: await this.uniqueSlug(
          {
            title,
            bookId,
            projectId,
            parent_page_id,
          },
          ncMeta
        ),
        published_content,
        is_published,
        order: order,
        book_id: bookId,
        created_by_id: user.id,
      } as Partial<DocsPageType>
    );

    if (parent_page_id) {
      await ncMeta.metaUpdate(
        null,
        null,
        Page.tableName({ projectId, bookId }),
        {
          is_parent: true,
        },
        parent_page_id
      );
    }

    await this.reorder({ bookId, parent_page_id, projectId });

    return await this.get({ id: createdPageId, bookId, projectId }, ncMeta);
  }

  public static async get(
    {
      id,
      bookId,
      projectId,
    }: {
      id: string;
      bookId: string;
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
        Page.tableName({ projectId, bookId }),
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
      slug,
      bookId,
      projectId,
    }: {
      slug: string;
      bookId: string;
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
        Page.tableName({ projectId, bookId }),
        {
          slug,
        }
      );
      if (page) {
        await NocoCache.set(`${CacheScope.DOCS_PAGE}:${page.id}`, page);
      }
    }

    return page;
  }

  public static async update(
    {
      bookId,
      pageId,
      projectId,
      attributes,
      user,
    }: {
      bookId: string;
      pageId: string;
      projectId: string;
      attributes: Partial<DocsPageType>;
      user: UserType;
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType> {
    // const now = new Date();
    const previousPage = await this.get({ id: pageId, bookId, projectId });
    if (!previousPage) throw new Error('Page not found');

    if (attributes.book_id) throw new Error('Cannot update book_id');

    if (attributes.title === previousPage.title) delete attributes.title;

    if (attributes.title) {
      if (attributes.title.length === 0) {
        throw new Error('Title cannot be empty');
      }

      const uniqueSlug = await this.uniqueSlug({
        bookId,
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
      Page.tableName({ projectId, bookId }),
      { ...attributes, book_id: bookId },
      pageId
    );

    // if parent page is changed, update is_parent flag of previous parent page
    if (
      'parent_page_id' in attributes &&
      previousPage.parent_page_id &&
      attributes.parent_page_id !== previousPage.parent_page_id
    ) {
      const previousParentChildren = await this.getChildPages({
        bookId,
        parent_page_id: previousPage.parent_page_id,
        projectId,
      });
      if (previousParentChildren.length === 0) {
        await ncMeta.metaUpdate(
          null,
          null,
          Page.tableName({ projectId, bookId }),
          {
            is_parent: false,
            book_id: bookId,
          },
          previousPage.parent_page_id
        );
      }
    }

    if (attributes.order) {
      await this.reorder({
        projectId,
        bookId,
        parent_page_id: attributes.parent_page_id,
        keepPageId: pageId,
      });
    }

    if (attributes.parent_page_id) {
      await ncMeta.metaUpdate(
        null,
        null,
        Page.tableName({ projectId, bookId }),
        {
          is_parent: true,
          book_id: bookId,
        },
        attributes.parent_page_id
      );
      const currentPage = await this.get({ id: pageId, bookId, projectId });

      // Since there can be slug collision, when page is moved to a new parent
      const uniqueSlug = await this.uniqueSlug(
        {
          bookId,
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
          Page.tableName({ projectId, bookId }),
          {
            slug: uniqueSlug,
            book_id: bookId,
          },
          pageId
        );
      }
    }

    return await this.get({ id: pageId, bookId, projectId });
  }

  public static async getChildPages({
    bookId,
    projectId,
    parent_page_id,
    ncMeta = Noco.ncMeta,
  }): Promise<Page[]> {
    const pageList = await ncMeta.metaList2(
      null,
      null,
      Page.tableName({ projectId, bookId }),
      {
        condition: {
          parent_page_id: parent_page_id,
          book_id: bookId,
        },
      }
    );

    if (!pageList || pageList.length === 0) return [];

    pageList.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return pageList;
  }

  public static async list(
    {
      bookId,
      parent_page_id,
      fetchAll,
      projectId,
    }: {
      bookId: string;
      parent_page_id?: string;
      fetchAll?: boolean;
      projectId: string;
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType[]> {
    const pageList = await ncMeta.metaList2(
      null,
      null,
      Page.tableName({ projectId, bookId }),
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
          'book_id',
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
    bookId,
    projectId,
    parent_page_id,
  }: {
    bookId: string;
    projectId: string;
    parent_page_id?: string;
  }): Promise<Array<DocsPageType & { children: any[]; isLeaf: boolean }>> {
    const nestedList = await this.list({
      bookId,
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
    bookId,
    projectId,
  }: {
    bookId: string;
    projectId: string;
  }): Promise<number> {
    return await Noco.ncMeta.metaCount(
      null,
      null,
      Page.tableName({ projectId, bookId }),
      {}
    );
  }

  public static async delete(
    { id, bookId, projectId },
    ncMeta = Noco.ncMeta
  ): Promise<void> {
    const page = await this.get({ id, bookId, projectId }, ncMeta);
    if (!page) throw new Error('Page not found');

    const childPages = await this.getChildPages({
      bookId,
      parent_page_id: id,
      projectId,
    });

    if (childPages?.length > 0) {
      await Promise.all(
        childPages.map((childPage) =>
          this.delete({ id: childPage.id, bookId, projectId }, ncMeta)
        )
      );
    }

    return ncMeta.metaDelete(
      null,
      null,
      Page.tableName({ projectId, bookId }),
      {
        id,
      }
    );
  }

  static async reorder(
    {
      bookId,
      parent_page_id,
      keepPageId,
      projectId,
    }: {
      projectId: string;
      bookId: string;
      parent_page_id?: string;
      keepPageId?: string;
    },
    ncMeta = Noco.ncMeta
  ) {
    const pages = await this.list(
      { bookId, parent_page_id, projectId },
      ncMeta
    );

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
        Page.tableName({ projectId, bookId }),
        {
          order: b.order,
          book_id: b.book_id,
        },
        b.id
      );
    }
  }

  public static tableName({
    projectId,
    bookId,
  }: {
    projectId: string;
    bookId: string;
  }) {
    return Book.pages_table_name(projectId, bookId);
  }

  private static async uniqueSlug(
    {
      title,
      projectId,
      bookId,
      parent_page_id,
    }: {
      title: string;
      projectId: string;
      bookId: string;
      parent_page_id?: string;
    },
    ncMeta = Noco.ncMeta
  ) {
    const slug = slugify(title);
    const count = await ncMeta.metaCount(
      null,
      null,
      Page.tableName({ projectId, bookId }),
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
        Page.tableName({ projectId, bookId }),
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

  static async createPageTable(
    { projectId, bookId }: { projectId: string; bookId: string },
    ncMeta = Noco.ncMeta
  ) {
    const knex = ncMeta.knex;
    await knex.schema.createTable(
      Page.tableName({ projectId, bookId }),
      (table) => {
        table.string('id', 20).primary().notNullable();

        table.string('book_id', 20).notNullable();
        table.foreign('book_id').references(`${MetaTable.BOOK}.id`);

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
          .references(`${Page.tableName({ projectId, bookId })}.id`)
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
      }
    );
  }

  static async drafts({
    projectId,
    bookId,
  }: {
    projectId: string;
    bookId: string;
  }) {
    const knex = Noco.ncMeta.knex;
    const pages: DocsPageType[] = (await knex(
      Page.tableName({ projectId, bookId })
    ).orderBy('updated_at', 'asc')) as any;

    return pages.filter((p) => {
      return p.content !== p.published_content || p.title !== p.published_title;
    });
  }

  static async publish({
    projectId,
    bookId,
    pageId,
    userId,
  }: {
    projectId: string;
    bookId: string;
    pageId: string;
    userId: string;
  }) {
    const knex = Noco.ncMeta.knex;
    const page = await this.get({ projectId, bookId, id: pageId });

    if (!page) throw new Error('Page not found');

    await knex(Page.tableName({ projectId, bookId }))
      .where({ id: pageId })
      .update({
        published_content: page.content,
        published_title: page.title,
        is_published: true,
        last_published_date: new Date(),
        last_published_by_id: userId,
      });
  }

  static async parents({
    projectId,
    bookId,
    pageId,
  }: {
    projectId: string;
    bookId: string;
    pageId: string;
  }) {
    const page = await this.get({ projectId, bookId, id: pageId });

    if (!page) throw new Error('Page not found');

    const parents: DocsPageType[] = [];
    let parent = page;
    while (parent.parent_page_id) {
      parent = await this.get({
        projectId,
        bookId,
        id: parent.parent_page_id,
      });
      parents.push(parent);
    }

    return parents;
  }

  static async paginate({
    projectId,
    bookId,
    pageNumber = 1,
    perPage = 10,
    orderBy = 'updated_at',
    order = 'desc',
    condition = {},
  }: {
    projectId: string;
    bookId: string;
    pageNumber?: number;
    perPage?: number;
    orderBy?: string;
    order?: 'asc' | 'desc';
    condition?: any;
  }) {
    const knex = Noco.ncMeta.knex;
    const pages = await knex(Page.tableName({ projectId, bookId }))
      .where(condition)
      .orderBy(orderBy, order)
      .offset((pageNumber - 1) * perPage)
      .limit(perPage);

    const total = await knex(Page.tableName({ projectId, bookId }))
      .where(condition)
      .count('id as total')
      .first();

    return {
      pages,
      total: total.total,
    };
  }

  static async dropPageTable(
    { projectId, bookId }: { projectId: string; bookId: string },
    ncMeta = Noco.ncMeta
  ) {
    const knex = ncMeta.knex;
    await knex.schema.dropTable(Page.tableName({ projectId, bookId }));
  }
}
