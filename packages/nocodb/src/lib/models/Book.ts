import Noco from '../Noco';
import { CacheScope, MetaTable } from '../utils/globals';
import NocoCache from '../cache/NocoCache';
import { BookType, UserType } from 'nocodb-sdk';
import NcMetaIO from '../meta/NcMetaIO';
import Page from './Page';

export default class Book {
  public id: string;
  public project_id: string;
  public pages_table_name: string;

  constructor(attr: Partial<Book>) {
    Object.assign(this, attr);
  }

  static pages_table_name(projectId: string, bookId: string) {
    return `nc_pages_${projectId}_${bookId}`;
  }

  public static async create(
    {
      attributes: { title, description, is_published },
      projectId,
      user,
    }: {
      attributes: {
        title: string;
        description: string;
        is_published?: boolean;
      };
      projectId: string;
      user: UserType;
    },
    ncMeta = Noco.ncMeta
  ): Promise<BookType> {
    const order = (await this.count({ projectId })) + 1;

    const { id: createdBookId } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.BOOK,
      {
        title: title,
        description: description,
        slug: `v-${order}`,
        order: order,
        created_by_id: user.id,
        project_id: projectId,
        is_published: is_published,
        metaJson: '{}',
      } as Partial<BookType>
    );

    await this.update({
      id: createdBookId,
      projectId,
      attributes: {
        pages_table_name: this.pages_table_name(projectId, createdBookId),
      },
      user: user,
    });

    await this.reorder({ projectId, keepBookId: createdBookId });

    await Page.createPageTable({ bookId: createdBookId, projectId });

    return await this.get({ id: createdBookId, projectId });
  }

  public static async get(
    {
      id,
      projectId,
      slug,
    }: {
      id?: string;
      projectId: string;
      slug?: string;
    },
    ncMeta = Noco.ncMeta
  ): Promise<BookType> {
    // todo: Add cache
    let page = undefined;
    if (!page) {
      page = await ncMeta.metaGet2(
        projectId,
        null,
        MetaTable.BOOK,
        slug
          ? {
              slug: slug,
            }
          : id
      );
      if (page) {
        await NocoCache.set(`${CacheScope.BOOK}:${id}`, page);
      }
    }

    return page;
  }

  public static async update(
    {
      id,
      projectId,
      attributes,
      user,
    }: {
      id: string;
      projectId: string;
      attributes: Partial<BookType>;
      user: UserType;
    },
    ncMeta = Noco.ncMeta
  ): Promise<BookType> {
    const previousPage = await this.get({ id, projectId });
    if (!previousPage) throw new Error('Page not found');

    if (attributes.project_id) throw new Error('Cannot update project_id');

    // if (attributes.title) {
    //   attributes.slug = `${slug(attributes.title)}-${id}`;
    // }

    attributes.last_updated_by_id = user.id;

    if ('is_published' in attributes && attributes.is_published) {
      const now = new Date();
      attributes.last_published_date = now.toISOString();
    }

    await ncMeta.metaUpdate(null, null, MetaTable.BOOK, { ...attributes }, id);

    if (attributes.order) {
      await this.reorder({ projectId, keepBookId: id });
    }

    return await this.get({ id: id, projectId });
  }

  public static async count(
    { projectId },
    ncMeta = Noco.ncMeta
  ): Promise<number> {
    return await ncMeta.metaCount(null, null, MetaTable.BOOK, {
      condition: {
        project_id: projectId,
      },
    });
  }

  public static async list(
    { projectId },
    ncMeta = Noco.ncMeta
  ): Promise<BookType[]> {
    const list = await ncMeta.metaList2(null, null, MetaTable.BOOK, {
      condition: {
        project_id: projectId,
      },
    });

    list.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return list;
  }

  public static async last(
    { projectId },
    ncMeta = Noco.ncMeta
  ): Promise<BookType> {
    const list = await await ncMeta.metaList2(null, null, MetaTable.BOOK, {
      condition: {
        project_id: projectId,
      },
      orderBy: {
        order: 'desc',
      },
      limit: 1,
    });
    return list.length > 0 && list[0];
  }

  public static async delete(
    { id, projectId },
    ncMeta = Noco.ncMeta
  ): Promise<void> {
    await ncMeta.metaDelete(null, null, MetaTable.BOOK, {
      id,
    });
    return await Page.dropPageTable({ bookId: id, projectId });
  }

  static async reorder({
    projectId,
    keepBookId,
    ncMeta = Noco.ncMeta,
  }: {
    projectId: string;
    keepBookId?: string;
    ncMeta?: NcMetaIO;
  }) {
    const books = await this.list({ projectId }, ncMeta);

    if (keepBookId) {
      const kpPage = books.splice(
        books.indexOf(books.find((base) => base.id === keepBookId)),
        1
      );
      if (kpPage.length) {
        books.splice(kpPage[0].order - 1, 0, kpPage[0]);
      }
    }

    // update order for pages
    for (const [i, b] of Object.entries(books)) {
      b.order = parseInt(i) + 1;

      await ncMeta.metaUpdate(
        null,
        null,
        MetaTable.BOOK,
        {
          order: b.order,
        },
        b.id
      );
    }
  }
}
