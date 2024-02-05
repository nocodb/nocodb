import slugify from 'slug';
import { Injectable } from '@nestjs/common';
import type { DocsPageSnapshotType, DocsPageType, UserType } from 'nocodb-sdk';
import { Base } from '~/models';

import NocoCache from '~/cache/NocoCache';
import { CacheDelDirection, CacheGetType, CacheScope } from '~/utils/globals';

import { MetaService } from '~/meta/meta.service';

@Injectable()
export class PageDao {
  constructor(private meta: MetaService) {}

  public async tableName({
    baseId,
    workspaceId,
  }: {
    baseId: string;
    workspaceId?: string;
  }) {
    const prefix = 'nc_d_page_';
    if (workspaceId) return `${prefix}${workspaceId}`;

    const base = await Base.get(baseId);
    return `${prefix}${(base as Base).fk_workspace_id}`;
  }

  public async create({
    attributes: {
      title,
      description,
      content,
      content_html,
      parent_page_id,
      order,
      published_content,
      is_published,
    },
    baseId,
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
      content_html?: string;
    };
    baseId: string;
    user: UserType;
  }): Promise<DocsPageType> {
    const { id: createdPageId } = await this.meta.metaInsert2(
      null,
      null,
      await this.tableName({ baseId }),
      {
        base_id: baseId,
        title: title,
        description: description,
        content: content,
        content_html: content_html,
        parent_page_id: parent_page_id,
        slug: await this.uniqueSlug({
          title,
          baseId,
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
        baseId,
      });

      await this.updatePage({
        pageId: parent_page_id,
        baseId,
        attributes: {
          is_parent: true,
        },
      });

      if (parentPage?.is_published) {
        await this.updatePage({
          pageId: createdPageId,
          baseId,
          attributes: {
            is_published: true,
            nested_published_parent_id: parentPage.nested_published_parent_id,
          },
        });
      }
    }

    await this.updateOrderAfterCreate({ parent_page_id, baseId });

    const createdPage = await this.meta.metaGet2(
      null,
      null,
      await this.tableName({ baseId }),
      createdPageId,
    );

    await NocoCache.set(
      `${CacheScope.DOCS_PAGE}:${baseId}:${createdPageId}`,
      createdPage,
    );
    await this.appendToAllPagesCacheList({
      pageId: createdPageId,
      baseId,
    });
    await this.appendToCacheChildList({
      parentPageId: parent_page_id,
      pageId: createdPageId,
      baseId,
    });

    return createdPage;
  }

  public async get({
    id,
    baseId,
    fields,
  }: {
    id: string;
    baseId: string;
    fields?: string[];
  }): Promise<DocsPageType | undefined> {
    if (!id) throw new Error('Page id is required');

    let page = await NocoCache.get(
      `${CacheScope.DOCS_PAGE}:${baseId}:${id}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (page && page?.base_id !== baseId) {
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
      await this.tableName({ baseId }),
      id,
      fields,
    );

    if (page) {
      const pageWithAllFields = await this.meta.metaGet2(
        null,
        null,
        await this.tableName({ baseId }),
        id,
      );

      if (pageWithAllFields?.base_id !== baseId) {
        return undefined;
      }

      await NocoCache.set(
        `${CacheScope.DOCS_PAGE}:${baseId}:${id}`,
        pageWithAllFields,
      );
    }

    return page as DocsPageType | undefined;
  }

  async updatePage({
    pageId,
    baseId,
    attributes,
  }: {
    pageId: string;
    baseId: string;
    attributes: Partial<DocsPageType>;
  }) {
    await this.meta.metaUpdate(
      null,
      null,
      await this.tableName({ baseId }),
      { ...attributes },
      pageId,
    );

    const updatedPage = await this.meta.metaGet2(
      null,
      null,
      await this.tableName({ baseId }),
      pageId,
    );

    // get existing cache
    const key = `${CacheScope.DOCS_PAGE}:${baseId}:${pageId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o = { ...o, ...updatedPage };

      // set cache
      await NocoCache.set(key, o);
    }

    if ('parent_page_id' in attributes) {
      await NocoCache.deepDel(
        `${CacheScope.DOCS_PAGE}:${baseId}:${pageId}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );

      await NocoCache.set(`${CacheScope.DOCS_PAGE}:${baseId}:${pageId}`, o);

      await this.appendToAllPagesCacheList({
        pageId,
        baseId,
      });
      await this.appendToCacheChildList({
        parentPageId: attributes.parent_page_id,
        pageId,
        baseId,
      });
    }

    return await this.get({ id: pageId, baseId });
  }

  public async addSnapshot({
    pageId,
    baseId,
    snapshot,
    lastSnapshotAt,
  }: {
    pageId: string;
    baseId: string;
    snapshot: DocsPageSnapshotType;
    lastSnapshotAt: string;
  }) {
    const snapshotSerialized = Buffer.from(JSON.stringify(snapshot)).toString(
      'base64',
    );

    await this.updatePage({
      pageId,
      baseId,
      attributes: {
        last_snapshot_at: lastSnapshotAt,
        last_snapshot_json: snapshotSerialized,
      },
    });
  }

  public deserializeSnapshot({ snapshotJson }: { snapshotJson: string }) {
    return JSON.parse(
      Buffer.from(snapshotJson, 'base64').toString(),
    ) as DocsPageSnapshotType;
  }

  public async getChildPages({
    baseId,
    parent_page_id,
    condition = {},
  }): Promise<DocsPageType[]> {
    const cachedList = await NocoCache.getList(
      `${CacheScope.DOCS_PAGE}:${baseId}`,
      [parent_page_id ?? 'root', 'children'],
    );
    let { list: pageList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !pageList.length && parent_page_id) {
      const parentPage = await this.get({ id: parent_page_id, baseId });
      if (!parentPage?.is_parent) {
        return [];
      }
    }

    if (pageList.length === 0) {
      pageList = await this.meta.metaList2(
        null,
        null,
        await this.tableName({ baseId }),
        {
          condition: {
            base_id: baseId,
            parent_page_id: parent_page_id,
            ...condition,
          },
        } as any,
      );

      await NocoCache.setList(
        `${CacheScope.DOCS_PAGE}:${baseId}`,
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
    baseId,
    onlyPublished,
    fields,
    ignoreCache,
  }: {
    parent_page_id?: string;
    fetchAll?: boolean;
    baseId: string;
    onlyPublished?: boolean;
    fields?: string[];
    ignoreCache?: boolean;
  }): Promise<DocsPageType[]> {
    const condition: any = {};
    condition.base_id = baseId;

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
          `${CacheScope.DOCS_PAGE}:${baseId}`,
          [],
        );
        pageList = cachedList;
      } else {
        const { list: cachedList } = await NocoCache.getList(
          `${CacheScope.DOCS_PAGE}:${baseId}`,
          [parent_page_id ?? 'root', 'children'],
        );
        pageList = cachedList;
      }

      if (pageList.length === 0 && !fetchAll && parent_page_id) {
        const parentPage = await this.get({ id: parent_page_id, baseId });
        if (!parentPage?.is_parent) return [];
      }
    }

    if (!pageList || pageList.length === 0) {
      pageList = await this.meta.metaList2(
        null,
        null,
        await this.tableName({ baseId }),
        {
          condition,
        } as any,
      );

      if (fetchAll) {
        await NocoCache.setList(
          `${CacheScope.DOCS_PAGE}:${baseId}`,
          [],
          pageList,
        );
      } else {
        await NocoCache.setList(
          `${CacheScope.DOCS_PAGE}:${baseId}`,
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
    baseId,
    parent_page_id,
    onlyPublished = false,
  }: // fields,

  {
    baseId: string;
    parent_page_id?: string;
    onlyPublished?: boolean;
    fields?: string[];
  }) {
    const children = await this.getChildPages({
      baseId,
      parent_page_id,
      condition: onlyPublished ? { is_published: true } : {},
    });

    if (!children || children.length === 0) return [];

    const nestedPagesWithChildren = await Promise.all(
      children.map(async (child) => {
        const children = await this.nestedChildren({
          baseId,
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
    baseId,
    fields,
  }: {
    baseId: string;
    fields?: string[];
  }) {
    const allPages = await this.list({
      baseId,
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
    baseId,
    parent_page_id,
    fields,
  }: {
    baseId: string;
    parent_page_id?: string;
    fields?: string[];
  }): Promise<Array<DocsPageType & { children: any[]; isLeaf: boolean }>> {
    const parentPage: DocsPageType & { children: any[]; isLeaf: boolean } =
      (await this.get({
        id: parent_page_id,
        baseId,
        fields: fields,
      })) as any;

    parentPage.children = await this.nestedChildren({
      baseId,
      fields,
      parent_page_id,
    });
    parentPage.isLeaf = parentPage.children.length === 0;

    return [parentPage];
  }

  public async count({ baseId }: { baseId: string }): Promise<number> {
    return await this.meta.metaCount(
      null,
      null,
      await this.tableName({ baseId }),
      {},
    );
  }

  public async delete({ id, baseId }): Promise<void> {
    const page = await this.get({ id, baseId });
    if (!page) throw new Error('Page not found');

    if (page.base_id !== baseId) throw new Error('Page not found');

    const childPages = await this.getChildPages({
      parent_page_id: id,
      baseId,
    });

    if (childPages?.length > 0) {
      await Promise.all(
        childPages.map((childPage) =>
          this.delete({ id: childPage.id, baseId }),
        ),
      );
    }

    await this.meta.metaDelete(null, null, await this.tableName({ baseId }), {
      id,
    });

    await NocoCache.deepDel(
      `${CacheScope.DOCS_PAGE}:${baseId}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  async updateOrderAfterCreate({
    parent_page_id,
    baseId,
  }: {
    baseId: string;
    parent_page_id?: string;
  }) {
    const pages = await this.list({
      parent_page_id,
      baseId,
      ignoreCache: true,
    });

    // update order for pages
    for (const [i, b] of Object.entries(pages)) {
      b.order = parseInt(i) + 1;

      await this.updatePage({
        pageId: b.id,
        baseId,
        attributes: {
          order: b.order,
        },
      });
    }
  }

  public async uniqueSlug({
    title,
    baseId,
    parent_page_id,
  }: {
    title: string;
    baseId: string;
    parent_page_id?: string;
  }) {
    const slug = slugify(title);
    const count = await this.meta.metaCount(
      null,
      null,
      await this.tableName({ baseId }),
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
        await this.tableName({ baseId }),
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

  async parents({ baseId, pageId }: { baseId: string; pageId: string }) {
    const page = await this.get({ baseId, id: pageId });

    if (!page) throw new Error('Page not found');

    const parents: DocsPageType[] = [];
    let parent = page;
    while (parent.parent_page_id) {
      parent = await this.get({
        baseId,
        id: parent.parent_page_id,
      });
      parents.push(parent);
    }

    return parents;
  }

  async hasParent({
    baseId,
    pageId,
    parentId,
  }: {
    baseId: string;
    pageId: string;
    parentId: string;
  }) {
    const page = await this.get({ baseId, id: pageId });

    if (!page) throw new Error('Page not found');

    let parent = page;
    while (parent.parent_page_id) {
      parent = await this.get({
        baseId,
        id: parent.parent_page_id,
      });
      if (parent.id === parentId) return true;
    }

    return false;
  }

  private async appendToCacheChildList({
    parentPageId,
    baseId,
    pageId,
  }: {
    parentPageId?: string;
    baseId: string;
    pageId: string;
  }) {
    const scope = `${CacheScope.DOCS_PAGE}:${baseId}`;
    const subKeys = [parentPageId ?? 'root', 'children'];

    const cachedList = await NocoCache.getList(scope, subKeys);
    const { list: existingList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !existingList.length) {
      const existingChildren = parentPageId
        ? await this.getChildPages({
            parent_page_id: parentPageId,
            baseId,
          })
        : await this.list({ baseId, parent_page_id: null });

      if (existingChildren.length !== 0) {
        await NocoCache.setList(scope, subKeys, existingChildren);
      }
    }

    await NocoCache.appendToList(
      scope,
      subKeys,
      `${CacheScope.DOCS_PAGE}:${baseId}:${pageId}`,
    );
  }

  async appendToAllPagesCacheList({
    baseId,
    pageId,
  }: {
    baseId: string;
    pageId: string;
  }) {
    await NocoCache.appendToList(
      `${CacheScope.DOCS_PAGE}:${baseId}`,
      [],
      `${CacheScope.DOCS_PAGE}:${baseId}:${pageId}`,
    );
  }

  async dropPageTable({ baseId }: { baseId: string }) {
    const knex = this.meta.knex;
    await knex.schema.dropTable(await this.tableName({ baseId }));
  }
}
