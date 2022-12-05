import Noco from '../Noco';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import NocoCache from '../cache/NocoCache';

export default class DocsPage {
  public id: string;
  public title: string;
  public content: string;

  constructor(project: Partial<DocsPage>) {
    Object.assign(this, project);
  }

  public static async createPage(
    { id, title, content, projectId },
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
      }
    );

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
    { projectId },
    ncMeta = Noco.ncMeta
  ): Promise<DocsPage[]> {
    return ncMeta.metaList2(projectId, null, MetaTable.DOCS_PAGE);
  }

  public static deletePage({ id }, ncMeta = Noco.ncMeta): Promise<void> {
    return ncMeta.metaDelete(null, null, MetaTable.DOCS_PAGE, {
      id,
    });
  }
}
