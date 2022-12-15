import Noco from '../Noco';
import { CacheScope, MetaTable } from '../utils/globals';
import NocoCache from '../cache/NocoCache';
import slug from 'slug';
import { DocsPageType, UserType } from 'nocodb-sdk';

export default class DocsPage {
  public id: string;
  public title: string;
  public description: string;
  public content: string;
  public slug: string;
  public project_id: string;
  public parent_page_id: string;
  public order: number;

  constructor(project: Partial<DocsPage>) {
    Object.assign(this, project);
  }

  public static async createPage(
    {
      attributes: { title, description, content, parent_page_id, order },
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
      projectId: string;
      user: UserType;
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType> {
    const titleSlug = slug(title);
    const now = new Date().toString();

    const { id: createdPageId } = await ncMeta.metaInsert2(
      projectId,
      null,
      MetaTable.DOCS_PAGE,
      {
        title: title,
        description: description,
        content: content,
        parent_page_id: parent_page_id,
        slug: `${titleSlug}-${now}`,
        order: order,
        project_id: projectId,
        created_by_id: user.id,
      } as Partial<DocsPageType>
    );

    await this.updatePage({
      projectId,
      pageId: createdPageId,
      attributes: {
        slug: `${titleSlug}-${createdPageId}`,
      },
      user: user,
    });

    if (parent_page_id) {
      await ncMeta.metaUpdate(
        projectId,
        null,
        MetaTable.DOCS_PAGE,
        {
          is_parent: true,
        },
        parent_page_id
      );
    }

    await this.reorderPages(projectId, parent_page_id);
  
    return await this.get(createdPageId, ncMeta);
  }

  public static async get(id, ncMeta = Noco.ncMeta): Promise<DocsPageType> {
    // todo: Add cache
    let page = undefined;
    if (!page) {
      page = await ncMeta.metaGet2(null, null, MetaTable.DOCS_PAGE, id);
      if (page) {
        await NocoCache.set(`${CacheScope.DOCS_PAGE}:${id}`, page);
      }
    }

    return page;
  }

  public static async updatePage(
    {
      projectId,
      pageId,
      attributes,
      user,
    }: {
      projectId: string;
      pageId: string;
      attributes: Partial<DocsPageType>;
      user: UserType;
    },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPageType> {
    const previousPage = await this.get(pageId);
    if (!previousPage) throw new Error('Page not found');

    if (attributes.project_id) throw new Error('Cannot update project_id');

    attributes.last_updated_by_id = user.id;

    await ncMeta.metaUpdate(
      projectId,
      null,
      MetaTable.DOCS_PAGE,
      attributes,
      pageId
    );

    // if parent page is changed, update is_parent flag of previous parent page
    if (
      previousPage.parent_page_id &&
      attributes.parent_page_id !== previousPage.parent_page_id
    ) {
      const previousParentChildren = await this.getChildPages({
        projectId,
        parent_page_id: previousPage.parent_page_id,
      });
      if (previousParentChildren.length === 0) {
        await ncMeta.metaUpdate(
          projectId,
          null,
          MetaTable.DOCS_PAGE,
          {
            is_parent: false,
          },
          previousPage.parent_page_id
        );
      }
    }

    if (attributes.order) {
      await this.reorderPages(projectId, attributes.parent_page_id, pageId);
    }

    return await this.get(pageId, ncMeta);
  }

  public static async getChildPages({
    projectId,
    parent_page_id,
    ncMeta = Noco.ncMeta,
  }): Promise<DocsPage[]> {
    const pageList = await ncMeta.metaList2(projectId, null, MetaTable.DOCS_PAGE, {
      condition: {
        parent_page_id: parent_page_id,
      },
    });

    pageList.sort(
      (a, b) =>  (a.order ?? Infinity) - (b.order ?? Infinity)
    );

    return pageList;
  }

  public static async listPages(
    { projectId, parent_page_id },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPage[]> {
    const pageList = await ncMeta.metaList2(projectId, null, MetaTable.DOCS_PAGE, {
      condition: {
        parent_page_id: parent_page_id ?? null,
      },
    });

    pageList.sort(
      (a, b) =>  (a.order ?? Infinity) - (b.order ?? Infinity)
    );

    return pageList;
  }

  public static async deletePage({ id }, ncMeta = Noco.ncMeta): Promise<void> {
    return ncMeta.metaDelete(null, null, MetaTable.DOCS_PAGE, {
      id,
    });
  }

  static async reorderPages(
    projectId: string,
    parent_page_id?: string,
    keepPageId?: string,
    ncMeta = Noco.ncMeta
  ) {
    const pages = await this.listPages({ projectId: projectId, parent_page_id }, ncMeta);

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
        b.project_id,
        null,
        MetaTable.DOCS_PAGE,
        {
          order: b.order
        },
        b.id
      );
    }
  }
}
