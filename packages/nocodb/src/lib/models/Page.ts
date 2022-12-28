import Noco from '../Noco';
import { CacheScope, MetaTable } from '../utils/globals';
import NocoCache from '../cache/NocoCache';
import slug from 'slug';
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
      attributes: { title, description, content, parent_page_id, order },
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
      };
      bookId: string;
      projectId: string;
      user: UserType;
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType> {
    const titleSlug = slug(title);
    const now = new Date().toString();

    const { id: createdPageId } = await ncMeta.metaInsert2(
      null,
      null,
      Page.tableName({ projectId, bookId }),
      {
        title: title,
        description: description,
        content: content,
        parent_page_id: parent_page_id,
        slug: `${titleSlug}-${now}`,
        order: order,
        book_id: bookId,
        created_by_id: user.id,
      } as Partial<DocsPageType>
    );

    await this.update({
      bookId,
      pageId: createdPageId,
      attributes: {
        slug: `${titleSlug}-${createdPageId}`,
      },
      user: user,
      projectId,
    });

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
    const previousPage = await this.get({ id: pageId, bookId, projectId });
    if (!previousPage) throw new Error('Page not found');

    if (attributes.book_id) throw new Error('Cannot update project_id');

    if (attributes.title) {
      attributes.slug = `${slug(attributes.title)}-${pageId}`;
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

    if (!pageList || pageList.length > 0) return [];

    pageList.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return pageList;
  }

  public static async list(
    {
      bookId,
      parent_page_id,
      projectId,
    }: {
      bookId: string;
      parent_page_id?: string;
      projectId: string;
    },
    ncMeta = Noco.ncMeta
  ): Promise<Page[]> {
    const pageList = await ncMeta.metaList2(
      null,
      null,
      Page.tableName({ projectId, bookId }),
      {
        condition: {
          parent_page_id: parent_page_id ?? null,
        },
      }
    );

    pageList.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return pageList;
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
        table.text('description', 'longtext').defaultTo('');

        table.text('content', 'longtext').defaultTo('');
        table.text('published_content', 'longtext').defaultTo('');
        table.string('slug', 150).notNullable().unique();

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

        table.timestamps(true, true);
      }
    );
  }

  static async dropPageTable(
    { projectId, bookId }: { projectId: string; bookId: string },
    ncMeta = Noco.ncMeta
  ) {
    const knex = ncMeta.knex;
    await knex.schema.dropTable(Page.tableName({ projectId, bookId }));
  }
}
