import Noco from '../Noco';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import NocoCache from '../cache/NocoCache';
import slug from 'slug';

export default class DocsPage {
  public id: string;
  public title: string;
  public content: string;
  public slug: string;

  constructor(project: Partial<DocsPage>) {
    Object.assign(this, project);
  }

  public static async createPage(
    { id, title, content, projectId, parentPageId },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPage> {
    const { id: createdPageId } = await ncMeta.metaInsert2(
      projectId,
      null,
      MetaTable.DOCS_PAGE,
      {
        id: id,
        title: title,
        content: content,
        // todo: Handle the case when there is a slug duplicate
        slug: slug(title),
        parent_page_id: parentPageId,
      }
    );

    if (parentPageId) {
      await ncMeta.metaUpdate(
        projectId,
        null,
        MetaTable.DOCS_PAGE,
        {
          is_parent: true,
        },
        parentPageId
      );
    }

    return this.get(createdPageId, ncMeta);
  }

  public static async get(id, ncMeta = Noco.ncMeta): Promise<DocsPage> {
    let page =
      id &&
      (await NocoCache.get(
        `${CacheScope.DOCS_PAGE}:${id}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!page) {
      page = await ncMeta.metaGet2(null, null, MetaTable.DOCS_PAGE, id);
      if (page) {
        await NocoCache.set(`${CacheScope.DOCS_PAGE}:${id}`, page);
      }
    }

    return page;
  }

  public static listPages(
    { projectId, parentPageId },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPage[]> {
    return ncMeta.metaList2(projectId, null, MetaTable.DOCS_PAGE, {
      condition: {
        parent_page_id: parentPageId ?? null,
      },
    });
  }

  public static deletePage({ id }, ncMeta = Noco.ncMeta): Promise<void> {
    return ncMeta.metaDelete(null, null, MetaTable.DOCS_PAGE, {
      id,
    });
  }
}
