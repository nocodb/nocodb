import type { DocType, NcContext } from 'nocodb-sdk';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

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

      docList = docList.map((doc) => this.parseDoc(doc));

      await NocoCache.setList(
        context,
        CacheScope.DOC,
        [baseId],
        docList,
        ['id'],
      );
    }

    // Always parse — cache may contain stringified content
    return docList.map((doc) => new Doc(this.parseDoc(doc)));
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

    // Stringify JSON fields for storage
    if (insertObj.content && typeof insertObj.content === 'object') {
      insertObj.content = JSON.stringify(insertObj.content);
    }
    if (insertObj.meta && typeof insertObj.meta === 'object') {
      insertObj.meta = JSON.stringify(insertObj.meta);
    }

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.DOCS, {
      base_id: context.base_id,
    });

    const insertResult = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      insertObj,
    );

    const id = insertResult?.id;

    if (!id) {
      throw new Error('Failed to insert doc: no id returned');
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

    // Stringify JSON fields for storage
    if (updateObj.content && typeof updateObj.content === 'object') {
      updateObj.content = JSON.stringify(updateObj.content);
    }
    if (updateObj.meta && typeof updateObj.meta === 'object') {
      updateObj.meta = JSON.stringify(updateObj.meta);
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      prepareForDb(updateObj),
      docId,
    );

    const key = `${CacheScope.DOC}:${docId}`;
    await NocoCache.update(context, key, updateObj);

    return await this.get(context, docId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const doc = await this.get(context, docId, ncMeta);
    if (!doc) return false;

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      docId,
    );

    const key = `${CacheScope.DOC}:${docId}`;
    await NocoCache.del(context, key);

    return true;
  }

  /**
   * Parse stringified JSON fields (content, meta) from DB row
   */
  private static parseDoc(doc: any): any {
    if (!doc) return doc;

    if (doc.content && typeof doc.content === 'string') {
      try {
        doc.content = JSON.parse(doc.content);
      } catch {
        doc.content = null;
      }
    }

    prepareForResponse(doc);

    return doc;
  }
}
