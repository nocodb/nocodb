import type { DocType, NcContext } from 'nocodb-sdk';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

/**
 * Data model for Pages (table: nc_docs_v2).
 *
 * Pages store rich-text content as ProseMirror JSON in the `content` column.
 * JSON fields (content, meta) are stringified for DB storage and parsed on read
 * via `parseDoc()`. Cache invalidation uses `del` on update (not `update`) to
 * avoid storing stringified JSON in the cache layer.
 */
export default class Doc implements DocType {
  id: string;
  base_id: string;
  fk_workspace_id: string;
  title: string;
  content: Record<string, any>;
  meta: Record<string, any>;
  order: number;
  parent_id: string | null;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;

  constructor(doc: Doc | DocType) {
    Object.assign(this, doc);
  }

  public static async get(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const key = `${CacheScope.DOC}:${docId}`;
    let doc = await NocoCache.get(context, key, CacheGetType.TYPE_OBJECT);

    if (!doc) {
      doc = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.DOCS,
        docId,
      );

      if (doc) {
        await NocoCache.set(context, key, doc);
      }
    }

    // Always parse — cache may contain stringified content from update()
    if (doc) {
      doc = this.parseDoc(doc);
    }

    return doc && new Doc(doc);
  }

  public static async list(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(context, CacheScope.DOC, [
      baseId,
    ]);
    let { list: docList } = cachedList;

    if (!cachedList.isNoneList && !docList.length) {
      docList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.DOCS,
        {
          condition: {
            base_id: baseId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );

      await NocoCache.setList(
        context,
        CacheScope.DOC,
        [baseId],
        docList,
        ['id'],
      );
    }

    // Parse stringified JSON fields — DB rows and cache entries may
    // contain content/meta as strings. parseDoc is idempotent on
    // already-parsed objects.
    return docList.map((doc) => new Doc(this.parseDoc(doc)));
  }

  /**
   * Lightweight list for sidebar/list views — excludes `content` to
   * avoid transferring large ProseMirror JSON payloads for every page.
   * Full content is fetched separately via `get()` when opening the editor.
   */
  public static async listLite(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const docs = await this.list(context, baseId, ncMeta);

    // Strip content from each doc — sidebar only needs title, order, meta
    return docs.map((doc) => {
      const { content: _content, ...rest } = doc as any;
      return new Doc(rest);
    });
  }

  public static async insert(
    context: NcContext,
    doc: Partial<DocType>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj: Record<string, any> = extractProps(doc, [
      'title',
      'base_id',
      'fk_workspace_id',
      'content',
      'meta',
      'parent_id',
      'created_by',
      'updated_by',
    ]);

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.DOCS, {
      base_id: context.base_id,
    });

    // Stringify JSON fields (content + meta) for DB storage
    const insertResult = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      prepareForDb(insertObj, ['meta', 'content']),
    );

    const id = insertResult?.id;

    if (!id) {
      NcError.badRequest('Failed to create page');
    }

    const res = await this.get(context, id, ncMeta);

    if (res) {
      const key = `${CacheScope.DOC}:${id}`;
      await NocoCache.appendToList(
        context,
        CacheScope.DOC,
        [context.base_id],
        key,
      );
    }

    return res;
  }

  public static async update(
    context: NcContext,
    docId: string,
    doc: Partial<DocType>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(doc, [
      'title',
      'content',
      'meta',
      'order',
      'parent_id',
      'version',
      'updated_by',
    ]);

    // Stringify JSON fields (content + meta) for DB storage
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      prepareForDb(updateObj, ['meta', 'content']),
      docId,
    );

    // Invalidate cache — updateObj contains stringified JSON fields
    // that would corrupt the cache if written directly.
    // The subsequent get() will re-fetch from DB and cache the parsed result.
    const key = `${CacheScope.DOC}:${docId}`;
    await NocoCache.del(context, key);

    return await this.get(context, docId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      docId,
    );

    // Remove from both individual cache and parent list
    const key = `${CacheScope.DOC}:${docId}`;
    await NocoCache.deepDel(
      context,
      key,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return true;
  }

  /**
   * Parse stringified JSON fields (content, meta) from a DB row.
   *
   * Uses `prepareForResponse` which JSON.parse()s string-typed fields
   * and skips already-parsed objects (checks `typeof field === 'string'`),
   * making this safe to call on both raw DB rows and cached entries.
   */
  private static parseDoc(doc: any): any {
    if (!doc) return doc;
    return prepareForResponse(doc, ['meta', 'content']);
  }
}
