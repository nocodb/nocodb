import type { DocumentType, NcContext } from 'nocodb-sdk';
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
 * Data model for Documents (table: nc_docs_v2).
 *
 * Documents store rich-text content as ProseMirror JSON in the `content` column.
 * JSON fields (content, meta) are stringified for DB storage and parsed on read
 * via `parseDocument()`. Cache invalidation uses `del` on update (not `update`) to
 * avoid storing stringified JSON in the cache layer.
 */
export default class Document implements DocumentType {
  id: string;
  base_id: string;
  fk_workspace_id: string;
  title: string;
  content: Record<string, any>;
  meta: Record<string, any>;
  order: number;
  parent_id: string | null;
  has_children: boolean;
  deleted: boolean;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;

  constructor(doc: Document | DocumentType) {
    Object.assign(this, doc);
  }

  public static async get(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const key = `${CacheScope.DOCUMENT}:${docId}`;
    let doc = await NocoCache.get(context, key, CacheGetType.TYPE_OBJECT);

    if (!doc) {
      doc = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.DOCS,
        { id: docId, deleted: false },
      );

      if (doc) {
        await NocoCache.set(context, key, doc);
      }
    }

    // Always parse — cache may contain stringified content from update()
    if (doc) {
      doc = this.parseDocument(doc);
    }

    return doc && new Document(doc);
  }

  /**
   * Lightweight list for sidebar — excludes `content` to avoid
   * transferring large ProseMirror JSON payloads.
   *
   * @param parentId — `null` for root documents, doc ID for children of that doc.
   */
  public static async listLite(
    context: NcContext,
    baseId: string,
    parentId: string | null,
    ncMeta = Noco.ncMeta,
  ) {
    const liteFields = [
      'id',
      'base_id',
      'fk_workspace_id',
      'title',
      'meta',
      'order',
      'parent_id',
      'has_children',
      'version',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
    ];

    const docList = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      {
        condition: {
          base_id: baseId,
          deleted: false,
          parent_id: parentId,
        },
        orderBy: {
          order: 'asc',
        },
        fields: liteFields,
      },
    );

    return docList.map((doc) => new Document(this.parseDocument(doc)));
  }

  public static async insert(
    context: NcContext,
    doc: Partial<DocumentType>,
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
      parent_id: insertObj.parent_id ?? null,
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
      NcError.badRequest('Failed to create document');
    }

    // Mark parent as having children
    if (insertObj.parent_id) {
      await this.setHasChildren(context, insertObj.parent_id, true, ncMeta);
    }

    const res = await this.get(context, id, ncMeta);

    if (res) {
      const key = `${CacheScope.DOCUMENT}:${id}`;
      await NocoCache.appendToList(
        context,
        CacheScope.DOCUMENT,
        [context.base_id],
        key,
      );
    }

    return res;
  }

  public static async update(
    context: NcContext,
    docId: string,
    doc: Partial<DocumentType>,
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
    const key = `${CacheScope.DOCUMENT}:${docId}`;
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
    const key = `${CacheScope.DOCUMENT}:${docId}`;
    await NocoCache.deepDel(context, key, CacheDelDirection.CHILD_TO_PARENT);

    return true;
  }

  public static async softDelete(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Read parent_id before deleting
    const doc = await this.get(context, docId, ncMeta);
    const parentId = doc?.parent_id;

    // Cascade: soft-delete all descendants first
    await this.cascadeSoftDelete(context, docId, ncMeta);

    // Soft-delete the document itself
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      { deleted: true },
      docId,
    );

    const key = `${CacheScope.DOCUMENT}:${docId}`;
    await NocoCache.deepDel(context, key, CacheDelDirection.CHILD_TO_PARENT);

    // Update parent's has_children if it no longer has active children
    if (parentId) {
      await this.refreshHasChildren(context, parentId, ncMeta);
    }
  }

  private static async cascadeSoftDelete(
    context: NcContext,
    parentId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const children = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      {
        condition: { parent_id: parentId, deleted: false },
        fields: ['id'],
      },
    );

    for (const child of children) {
      await this.cascadeSoftDelete(context, child.id, ncMeta);

      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.DOCS,
        { deleted: true },
        child.id,
      );

      const key = `${CacheScope.DOCUMENT}:${child.id}`;
      await NocoCache.deepDel(context, key, CacheDelDirection.CHILD_TO_PARENT);
    }
  }

  public static async getDescendantIds(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<string[]> {
    const result: string[] = [];

    const collect = async (parentId: string) => {
      const children = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.DOCS,
        {
          condition: { parent_id: parentId, deleted: false },
          fields: ['id'],
        },
      );

      for (const child of children) {
        result.push(child.id);
        await collect(child.id);
      }
    };

    await collect(docId);
    return result;
  }

  public static async move(
    context: NcContext,
    docId: string,
    targetParentId: string | null,
    order: number,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Read old parent before moving
    const doc = await this.get(context, docId, ncMeta);
    const oldParentId = doc?.parent_id;

    const updateObj = {
      parent_id: targetParentId,
      order,
      updated_by: userId,
    };

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      updateObj,
      docId,
    );

    const key = `${CacheScope.DOCUMENT}:${docId}`;
    await NocoCache.del(context, key);

    // Update has_children on new parent
    if (targetParentId) {
      await this.setHasChildren(context, targetParentId, true, ncMeta);
    }

    // Update has_children on old parent (may no longer have children)
    if (oldParentId && oldParentId !== targetParentId) {
      await this.refreshHasChildren(context, oldParentId, ncMeta);
    }

    return await this.get(context, docId, ncMeta);
  }

  /** Set has_children on a document (unconditional). */
  private static async setHasChildren(
    context: NcContext,
    docId: string,
    value: boolean,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      { has_children: value },
      docId,
    );

    const key = `${CacheScope.DOCUMENT}:${docId}`;
    await NocoCache.del(context, key);
  }

  /** Recompute has_children for a document by checking if it has active children. */
  private static async refreshHasChildren(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const children = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOCS,
      {
        condition: { parent_id: docId, deleted: false },
        fields: ['id'],
      },
    );

    await this.setHasChildren(context, docId, children.length > 0, ncMeta);
  }

  /**
   * Parse stringified JSON fields (content, meta) from a DB row.
   *
   * Uses `prepareForResponse` which JSON.parse()s string-typed fields
   * and skips already-parsed objects (checks `typeof field === 'string'`),
   * making this safe to call on both raw DB rows and cached entries.
   */
  private static parseDocument(doc: any): any {
    if (!doc) return doc;
    return prepareForResponse(doc, ['meta', 'content']);
  }
}
