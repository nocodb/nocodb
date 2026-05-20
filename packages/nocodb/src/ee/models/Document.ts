import { ModelTypes } from 'nocodb-sdk';
import { PermissionEntity, PermissionKey } from 'nocodb-sdk';
import { customAlphabet } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';
import DocumentCE from 'src/models/Document';
import {
  getDocShareMeta,
  MAX_PUBLIC_SCOPE_WALK_DEPTH,
  PUBLIC_SHARE_SCOPE_TTL_SECONDS,
} from 'nocodb-sdk';
import type {
  DocumentType,
  NcContext,
  PublicDocChildNode,
  PublicDocLiteNode,
  PublicDocTreeNode,
} from 'nocodb-sdk';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import { notDeletedXcCondition } from '~/utils/trashUtils';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

const BASE_HAS_SHARES_TTL_SECONDS = 60 * 60;
const DOC_BY_UUID_TTL_SECONDS = 60 * 60;

// `reachableDocIds` is serialized as `string[]` and rehydrated into a Set
// on read; everything else round-trips through Redis as-is.
export interface CachedShareScope {
  root: Document;
  tree: PublicDocTreeNode[];
  includeSubtree: boolean;
  reachableDocIds: Set<string>;
}

// Metadata lives in nc_models_v2; content (ProseMirror JSON) lives in
// nc_doc_content_v2 — see Noco.ncDocsContent. `doc_version` column maps
// to `version` on the model.
export default class Document extends DocumentCE implements DocumentType {
  constructor(doc: Document | DocumentType) {
    super(doc);
    Object.assign(this, doc);
  }

  private static get typeCondition() {
    return { type: ModelTypes.DOCUMENT };
  }

  // Metadata only — does not query the satellite docs-content DB, so safe
  // inside transactions.
  public static async getMeta(
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
        MetaTable.MODELS,
        { id: docId, deleted: false, ...this.typeCondition },
      );

      if (doc) {
        await NocoCache.set(context, key, doc);
      }
    }

    if (doc) {
      doc = this.parseDocument(doc);
    }

    return doc && new Document(doc);
  }

  public static async get(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const doc = await this.getMeta(context, docId, ncMeta);

    if (doc) {
      const contentRow = await Noco.ncDocsContent.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.DOC_CONTENT,
        { fk_doc_id: docId },
        ['content'],
      );
      doc.content = contentRow?.content;
    }

    return doc;
  }

  // Full list (with content). For sidebar use listLite() instead.
  public static async list(
    context: NcContext,
    baseId: string,
    parentId: string | null = null,
    ncMeta = Noco.ncMeta,
  ) {
    const docList = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        condition: {
          base_id: baseId,
          deleted: false,
          parent_id: parentId,
          ...this.typeCondition,
        },
        orderBy: {
          order: 'asc',
        },
      },
    );

    // Batch-fetch content for all documents in a single query
    const docIds = docList.map((d) => d.id).filter(Boolean);
    if (docIds.length) {
      const contentRows = await Noco.ncDocsContent.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.DOC_CONTENT,
        {
          xcCondition: {
            fk_doc_id: { in: docIds },
          },
          fields: ['fk_doc_id', 'content'],
        },
      );
      const contentMap = new Map(
        contentRows.map((r) => [r.fk_doc_id, r.content]),
      );
      for (const doc of docList) {
        doc.content = contentMap.get(doc.id);
      }
    }

    return docList.map((doc) => new Document(this.parseDocument(doc)));
  }

  // Sidebar list — strips `content` but keeps `uuid` so the share toggle
  // state survives a sidebar refresh. parentId: null=root, string=children,
  // undefined=all levels.
  public static async listLite(
    context: NcContext,
    baseId: string,
    parentId: string | null | undefined = null,
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
      'doc_version',
      'uuid',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
    ];

    const condition: Record<string, any> = {
      base_id: baseId,
      deleted: false,
      ...this.typeCondition,
    };

    // undefined = all levels, null = root, string = children of that doc
    if (parentId !== undefined) {
      condition.parent_id = parentId;
    }

    const docList = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        condition,
        orderBy: {
          order: 'asc',
        },
        fields: liteFields,
      },
    );

    return docList.map((doc) => new Document(this.parseDocument(doc)));
  }

  public static async listLiteByParentIds(
    context: NcContext,
    baseId: string,
    parentIds: string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!parentIds.length) return [];

    const liteFields = [
      'id',
      'base_id',
      'fk_workspace_id',
      'title',
      'meta',
      'order',
      'parent_id',
      'has_children',
      'doc_version',
      'uuid',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
    ];

    const docList = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        condition: {
          base_id: baseId,
          deleted: false,
          ...this.typeCondition,
        },
        xcCondition: {
          _and: [
            {
              parent_id: {
                in: parentIds,
              },
            },
          ],
        },
        orderBy: {
          order: 'asc',
        },
        fields: liteFields,
      },
    );

    return docList.map((doc) => new Document(this.parseDocument(doc)));
  }

  // Flat list of every non-deleted doc in a base (no content). Used by the
  // permissions page to render the full doc tree in one request.
  public static async listAllLite(
    context: NcContext,
    baseId: string,
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
      'doc_version',
      'uuid',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
    ];

    const docList = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        condition: {
          base_id: baseId,
          deleted: false,
          ...this.typeCondition,
        },
        orderBy: {
          order: 'asc',
        },
        fields: liteFields,
      },
    );

    return docList.map((doc) => new Document(this.parseDocument(doc)));
  }

  // Pagination is the caller's responsibility — used by export to stream
  // through docs without buffering every ProseMirror payload at once.
  public static async listWithContent(
    context: NcContext,
    docIds: string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!docIds.length) return [];

    const docs = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        condition: {
          deleted: false,
          ...this.typeCondition,
        },
        xcCondition: {
          id: { in: docIds },
        },
        orderBy: {
          order: 'asc',
        },
      },
    );

    if (!docs.length) return [];

    const contentRows = await Noco.ncDocsContent.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_CONTENT,
      {
        xcCondition: {
          fk_doc_id: { in: docs.map((d) => d.id) },
        },
        fields: ['fk_doc_id', 'content'],
      },
    );
    const contentMap = new Map(
      (contentRows as any[]).map((r) => [r.fk_doc_id, r.content]),
    );

    return docs.map((doc) => {
      doc.content = contentMap.get(doc.id);
      return new Document(this.parseDocument(doc));
    });
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
      'order',
      'parent_id',
      'has_children',
      'created_by',
      'updated_by',
    ]);

    // Extract content before inserting metadata
    const content = insertObj.content;
    delete insertObj.content;

    // Pre-generate ID with doc prefix
    insertObj.id = `doc${nanoidv2()}`;
    insertObj.type = ModelTypes.DOCUMENT;
    insertObj.deleted = false;
    insertObj.doc_version = 1;

    if (insertObj.order === undefined || insertObj.order === null) {
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.MODELS, {
        base_id: context.base_id,
        parent_id: insertObj.parent_id ?? null,
      });
    }

    // Insert metadata (without content) into MODELS table
    const insertResult = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      prepareForDb(insertObj, ['meta']),
    );

    const id = insertResult?.id;

    if (!id) {
      NcError.badRequest('Failed to create document');
    }

    // Insert content into separate DOC_CONTENT table
    await Noco.ncDocsContent.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_CONTENT,
      prepareForDb({ fk_doc_id: id, content }, ['content']),
      true, // ignoreIdGeneration — fk_doc_id is the PK
    );

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

    // A new doc under a shared ancestor changes that ancestor's cached
    // children list (and the parent's has_children flag if it just flipped
    // from false to true) — bust the share-scope cache up the chain.
    await this.invalidateShareCacheUpTree(
      context,
      insertObj.parent_id ?? null,
      ncMeta,
    );

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

    // Map version -> doc_version for DB column
    if ('version' in updateObj) {
      updateObj.doc_version = updateObj.version;
      delete updateObj.version;
    }

    // Extract content for separate update
    const content = updateObj.content;
    delete updateObj.content;

    // Update metadata (without content) in MODELS table
    if (Object.keys(updateObj).length > 0) {
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        prepareForDb(updateObj, ['meta']),
        { id: docId, ...this.typeCondition },
      );
    }

    // Update content in separate DOC_CONTENT table if provided
    if (content !== undefined) {
      await Noco.ncDocsContent.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.DOC_CONTENT,
        prepareForDb({ content }, ['content']),
        { fk_doc_id: docId },
      );
    }

    // Invalidate, don't update — updateObj has stringified JSON fields.
    const key = `${CacheScope.DOCUMENT}:${docId}`;
    await NocoCache.del(context, key);

    await this.invalidateShareCacheUpTree(context, docId, ncMeta);

    return await this.get(context, docId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Snapshot uuid before the row goes away.
    const pre = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      { id: docId, ...this.typeCondition },
      ['uuid', 'parent_id'],
    );

    // Must walk while the parent chain is still readable.
    await this.invalidateShareCacheUpTree(context, docId, ncMeta);

    await Noco.ncDocsContent.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_CONTENT,
      { fk_doc_id: docId },
    );

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      { id: docId, ...this.typeCondition },
    );

    if (pre?.uuid) {
      await NocoCache.del('root', this.uuidCacheKey(pre.uuid as string));
    }

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
    const doc = await this.get(context, docId, ncMeta);
    const parentId = doc?.parent_id;
    const docUuid = doc?.uuid;

    // Must walk while the parent chain is still readable.
    await this.invalidateShareCacheUpTree(context, docId, ncMeta);

    await this.cascadeSoftDelete(context, docId, ncMeta);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      { deleted: true },
      { id: docId, ...this.typeCondition },
    );

    if (docUuid) {
      await NocoCache.del('root', this.uuidCacheKey(docUuid));
    }

    const key = `${CacheScope.DOCUMENT}:${docId}`;
    await NocoCache.deepDel(context, key, CacheDelDirection.CHILD_TO_PARENT);

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
      MetaTable.MODELS,
      {
        condition: {
          parent_id: parentId,
          deleted: false,
          ...this.typeCondition,
        },
        // uuid needed for share-cache invalidation on shared descendants.
        fields: ['id', 'uuid'],
      },
    );

    for (const child of children) {
      await this.cascadeSoftDelete(context, child.id, ncMeta);

      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        { deleted: true },
        { id: child.id, ...this.typeCondition },
      );

      const key = `${CacheScope.DOCUMENT}:${child.id}`;
      await NocoCache.deepDel(context, key, CacheDelDirection.CHILD_TO_PARENT);

      if (child.uuid) {
        await NocoCache.del(
          context,
          `${CacheScope.DOCUMENT}:share:${child.uuid}`,
        );
        await NocoCache.del('root', this.uuidCacheKey(child.uuid as string));
      }
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
        MetaTable.MODELS,
        {
          condition: {
            parent_id: parentId,
            deleted: false,
            ...this.typeCondition,
          },
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
      MetaTable.MODELS,
      updateObj,
      { id: docId, ...this.typeCondition },
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

    // Both old and new parent chains carry stale children lists.
    await this.invalidateShareCacheUpTree(context, oldParentId, ncMeta);
    if (targetParentId !== oldParentId) {
      await this.invalidateShareCacheUpTree(context, targetParentId, ncMeta);
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
      MetaTable.MODELS,
      { has_children: value },
      { id: docId, ...this.typeCondition },
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
      MetaTable.MODELS,
      {
        condition: {
          parent_id: docId,
          deleted: false,
          ...this.typeCondition,
        },
        fields: ['id'],
      },
    );

    await this.setHasChildren(context, docId, children.length > 0, ncMeta);
  }

  /** Count non-deleted documents in a base. */
  public static async countForBase(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const result = await ncMeta
      .knexConnection(MetaTable.MODELS)
      .where('base_id', baseId)
      .where('fk_workspace_id', context.workspace_id)
      .where('deleted', false)
      .where('type', ModelTypes.DOCUMENT)
      .count('id as count')
      .first();

    return +(result?.count || 0);
  }

  /**
   * Parse stringified JSON fields (content, meta) from a DB row and
   * map DB column names to model property names (doc_version -> version).
   */
  private static parseDocument(doc: any): any {
    if (!doc) return doc;

    if ('doc_version' in doc) {
      doc.version = doc.doc_version;
      delete doc.doc_version;
    }
    return prepareForResponse(doc, ['meta', 'content']);
  }

  // --- Public share ---
  // Reuses the existing uuid column on nc_models_v2 (added for view share).
  // No password protection.

  // Cached under 'root' scope because extract-ids has no base_id yet — that's
  // what this lookup is for.
  public static async getByUUID(
    _context: NcContext,
    uuid: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Document | null> {
    const key = this.uuidCacheKey(uuid);

    let row = await NocoCache.get('root', key, CacheGetType.TYPE_OBJECT);

    if (!row) {
      row = await ncMeta.metaGet2(
        RootScopes.FULL_BYPASS,
        RootScopes.FULL_BYPASS,
        MetaTable.MODELS,
        { uuid, type: ModelTypes.DOCUMENT },
        undefined,
        notDeletedXcCondition,
      );

      if (!row) return null;

      await NocoCache.setExpiring('root', key, row, DOC_BY_UUID_TTL_SECONDS);
    }

    return new Document(this.parseDocument(row));
  }

  private static uuidCacheKey(uuid: string): string {
    return `${CacheScope.DOCUMENT}:uuid:${uuid}`;
  }

  // Idempotent + race-safe: the UPDATE filters on `uuid IS NULL` so
  // concurrent shares can't clobber each other.
  public static async share(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Document> {
    const existing = await this.getMeta(context, docId, ncMeta);
    if (!existing) NcError.get(context).genericNotFound('Document', docId);

    // Public share would bypass an explicit DOCUMENT_VISIBILITY restriction.
    // Only checks the doc's own row — inherited restrictions from ancestors
    // map 1:1 to has_visibility_permission, which the UI also gates on.
    if (
      await this.hasVisibilityRestriction(
        context.workspace_id,
        context.base_id,
        docId,
        ncMeta,
      )
    ) {
      NcError.get(context).forbidden(
        'This document has custom visibility permissions. Reset visibility to default to enable public sharing.',
      );
    }

    if (!existing.uuid) {
      const uuid = uuidv4();
      const currentMeta = existing.meta ?? {};
      const currentShare = getDocShareMeta(currentMeta);
      const nextMeta = {
        ...currentMeta,
        share: {
          ...currentShare,
          include_subtree: currentShare.include_subtree ?? true,
        },
      };

      await ncMeta
        .knexConnection(MetaTable.MODELS)
        .where({
          id: docId,
          type: ModelTypes.DOCUMENT,
          fk_workspace_id: context.workspace_id,
          base_id: context.base_id,
        })
        .whereNull('uuid')
        .update({
          ...prepareForDb({ uuid, meta: nextMeta }, ['meta']),
          updated_at: ncMeta.now(),
        });

      await NocoCache.del(context, `${CacheScope.DOCUMENT}:${docId}`);
    }

    // Re-read so the returned doc reflects the winning uuid (ours, or a
    // concurrent caller's if we lost the race).
    const fresh = await this.getMeta(context, docId, ncMeta);
    if (!fresh) NcError.get(context).genericNotFound('Document', docId);

    if (fresh.uuid) {
      await NocoCache.del(
        context,
        `${CacheScope.DOCUMENT}:share:${fresh.uuid}`,
      );
    }

    await this.setBaseHasShare(context, true);

    return fresh;
  }

  public static async unshare(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const doc = await this.getMeta(context, docId, ncMeta);

    const updateObj: Record<string, any> = { uuid: null };

    // Drop meta.share so a future share() starts from the documented default.
    if (doc?.meta && (doc.meta as any).share) {
      const { share: _share, ...restMeta } = doc.meta as Record<string, any>;
      Object.assign(updateObj, prepareForDb({ meta: restMeta }, ['meta']));
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      updateObj,
      { id: docId, type: ModelTypes.DOCUMENT },
    );
    if (doc?.uuid) {
      await NocoCache.del(context, `${CacheScope.DOCUMENT}:share:${doc.uuid}`);
      await NocoCache.del('root', this.uuidCacheKey(doc.uuid));
    }
    await NocoCache.del(context, `${CacheScope.DOCUMENT}:${docId}`);

    // Lazy refill — avoids a SELECT-COUNT on the hot path.
    await NocoCache.del(context, this.baseSharesKey(context.base_id));
  }

  public static async updateShareSettings(
    context: NcContext,
    docId: string,
    body: { include_subtree?: boolean },
    ncMeta = Noco.ncMeta,
  ): Promise<Document> {
    const doc = await this.getMeta(context, docId, ncMeta);
    if (!doc) NcError.get(context).genericNotFound('Document', docId);
    if (!doc.uuid) {
      NcError.get(context).badRequest('Document is not shared');
    }

    const updateObj: Record<string, any> = {};

    if (body.include_subtree !== undefined) {
      const currentMeta = doc.meta ?? {};
      const nextShare = {
        ...getDocShareMeta(currentMeta),
        include_subtree: !!body.include_subtree,
      };
      updateObj.meta = { ...currentMeta, share: nextShare };
    }

    if (Object.keys(updateObj).length > 0) {
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        prepareForDb(updateObj, ['meta']),
        { id: docId, type: ModelTypes.DOCUMENT },
      );
      await NocoCache.del(context, `${CacheScope.DOCUMENT}:${docId}`);
      // Invalidate share-scope so subsequent /meta and /content calls see
      // the updated include_subtree without lag.
      if (doc.uuid) {
        await NocoCache.del(
          context,
          `${CacheScope.DOCUMENT}:share:${doc.uuid}`,
        );
      }
    }

    return await this.getMeta(context, docId, ncMeta);
  }

  // Direct children for the public reader. Pass reachableDocIds from
  // getCachedShareScope to drop docs blocked by visibility restrictions.
  public static async getPublicChildren(
    _context: NcContext,
    root: Document,
    parentDocId: string,
    reachableDocIds?: Set<string>,
    ncMeta = Noco.ncMeta,
  ): Promise<Array<PublicDocChildNode>> {
    const rows = await ncMeta.metaList2(
      root.fk_workspace_id,
      root.base_id,
      MetaTable.MODELS,
      {
        condition: {
          base_id: root.base_id,
          type: ModelTypes.DOCUMENT,
          parent_id: parentDocId,
          deleted: false,
        },
        orderBy: { order: 'asc' },
        fields: ['id', 'title', 'parent_id', 'order', 'has_children', 'meta'],
      },
    );

    const filtered = reachableDocIds
      ? rows.filter((r: any) => reachableDocIds.has(r.id as string))
      : rows;

    return filtered.map((c: any) => {
      const parsed = this.parseDocument({ ...c });
      const meta = (parsed.meta as Record<string, any> | null) ?? {};

      return {
        id: c.id as string,
        title: (c.title as string) || 'Untitled',
        parent_id: c.parent_id as string,
        order: (c.order as number) ?? 0,
        has_children: !!c.has_children,
        icon: meta?.icon ?? null,
      };
    });
  }

  // Lightweight ancestor lookup for the deep-link walker. Returns null when
  // the doc isn't reachable through `scope` (treat as 404).
  public static async getPublicLite(
    scope: CachedShareScope,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<PublicDocLiteNode | null> {
    if (!scope.reachableDocIds.has(docId)) return null;
    const isRoot = docId === scope.root.id;

    const row = await ncMeta.metaGet2(
      scope.root.fk_workspace_id,
      scope.root.base_id,
      MetaTable.MODELS,
      { id: docId, type: ModelTypes.DOCUMENT },
      ['id', 'title', 'parent_id', 'order', 'has_children', 'meta'],
      notDeletedXcCondition,
    );
    if (!row) return null;

    const parsed = this.parseDocument({ ...row });
    const meta = (parsed.meta as Record<string, any> | null) ?? {};

    return {
      id: row.id as string,
      title: (row.title as string) || 'Untitled',
      // Re-anchor the share root to null so the frontend tree walker stops
      // at the share boundary.
      parent_id: isRoot ? null : (row.parent_id as string | null) ?? null,
      order: (row.order as number) ?? 0,
      has_children: !!row.has_children,
      icon: meta?.icon ?? null,
    };
  }

  // Raw ncMeta query (no Permission model) to avoid the circular import.
  public static async hasVisibilityRestriction(
    workspaceId: string,
    baseId: string,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const row = await ncMeta.metaGet2(
      workspaceId,
      baseId,
      MetaTable.PERMISSIONS,
      {
        entity: PermissionEntity.DOCUMENT,
        entity_id: docId,
        permission: PermissionKey.DOCUMENT_VISIBILITY,
      },
    );
    return !!row;
  }

  // Per-base "has any shared doc" flag — lets doc mutations skip the
  // share-cache walk when no share exists. Lazily recomputed on miss; TTL
  // self-heals from drift.
  private static baseSharesKey(baseId: string): string {
    return `${CacheScope.DOCUMENT}:base-has-shares:${baseId}`;
  }

  private static async baseHasAnyShare(
    context: NcContext,
    ncMeta: typeof Noco.ncMeta,
  ): Promise<boolean> {
    const cached = await NocoCache.get(
      context,
      this.baseSharesKey(context.base_id),
      CacheGetType.TYPE_OBJECT,
    );
    if (cached === '1') return true;
    if (cached === '0') return false;

    const row = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      { type: ModelTypes.DOCUMENT },
      ['id'],
      { _and: [{ uuid: { neq: null } }, notDeletedXcCondition] },
    );
    const hasShare = !!row;
    await NocoCache.setExpiring(
      context,
      this.baseSharesKey(context.base_id),
      hasShare ? '1' : '0',
      BASE_HAS_SHARES_TTL_SECONDS,
    );
    return hasShare;
  }

  private static async setBaseHasShare(
    context: NcContext,
    value: boolean,
  ): Promise<void> {
    await NocoCache.setExpiring(
      context,
      this.baseSharesKey(context.base_id),
      value ? '1' : '0',
      BASE_HAS_SHARES_TTL_SECONDS,
    );
  }

  // Walk the parent chain from startDocId (inclusive) and drop the share-
  // scope cache for every shared ancestor. Short-circuits via
  // baseHasAnyShare; one metaGet2 per level, bounded by
  // MAX_PUBLIC_SCOPE_WALK_DEPTH.
  public static async invalidateShareCacheUpTree(
    context: NcContext,
    startDocId: string | null,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    if (!startDocId) return;
    if (!(await this.baseHasAnyShare(context, ncMeta))) return;

    let cursor: string | null = startDocId;
    for (let i = 0; i < MAX_PUBLIC_SCOPE_WALK_DEPTH && cursor; i++) {
      const row = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        { id: cursor, type: ModelTypes.DOCUMENT },
        ['uuid', 'parent_id'],
      );
      if (!row) return;
      if (row.uuid) {
        await NocoCache.del(
          context,
          `${CacheScope.DOCUMENT}:share:${row.uuid}`,
        );
      }
      cursor = (row.parent_id as string | null) ?? null;
    }
  }

  // BFS over the base's docs, pruning at any DOCUMENT_VISIBILITY restriction.
  // Returns just {root.id} when include_subtree is false.
  private static async computeReachableDocIds(
    root: Document,
    includeSubtree: boolean,
    ncMeta: typeof Noco.ncMeta,
  ): Promise<Set<string>> {
    if (!includeSubtree) return new Set([root.id]);

    const docs = await ncMeta.metaList2(
      root.fk_workspace_id,
      root.base_id,
      MetaTable.MODELS,
      {
        condition: {
          base_id: root.base_id,
          type: ModelTypes.DOCUMENT,
          deleted: false,
        },
        fields: ['id', 'parent_id'],
      },
    );

    const restrictedRows = await ncMeta.metaList2(
      root.fk_workspace_id,
      root.base_id,
      MetaTable.PERMISSIONS,
      {
        condition: {
          base_id: root.base_id,
          entity: PermissionEntity.DOCUMENT,
          permission: PermissionKey.DOCUMENT_VISIBILITY,
        },
        fields: ['entity_id'],
      },
    );
    const restricted = new Set(
      (restrictedRows as Array<{ entity_id: string }>).map((p) => p.entity_id),
    );

    // Build adjacency map and BFS from root, skipping restricted nodes.
    const childrenByParent = new Map<string, string[]>();
    for (const d of docs as Array<{ id: string; parent_id: string | null }>) {
      if (!d.parent_id) continue;
      let bucket = childrenByParent.get(d.parent_id);
      if (!bucket) {
        bucket = [];
        childrenByParent.set(d.parent_id, bucket);
      }
      bucket.push(d.id);
    }

    const reachable = new Set<string>();
    if (!restricted.has(root.id)) {
      const queue: string[] = [root.id];
      while (queue.length) {
        const current = queue.shift()!;
        reachable.add(current);
        const children = childrenByParent.get(current);
        if (!children) continue;
        for (const childId of children) {
          if (restricted.has(childId)) continue;
          if (reachable.has(childId)) continue;
          queue.push(childId);
        }
      }
    }

    return reachable;
  }

  // Resolve + cache the share scope for a UUID. Invalidated by share /
  // unshare / updateShareSettings, mutations within the share via
  // invalidateShareCacheUpTree, and DOCUMENT_VISIBILITY permission writes.
  // TTL is a defense-in-depth backstop.
  public static async getCachedShareScope(
    context: NcContext,
    uuid: string,
    ncMeta = Noco.ncMeta,
  ): Promise<CachedShareScope | null> {
    const key = `${CacheScope.DOCUMENT}:share:${uuid}`;

    const cached = await NocoCache.get(context, key, CacheGetType.TYPE_OBJECT);
    if (cached?.root) {
      return {
        root: new Document(cached.root),
        tree: cached.tree ?? [],
        includeSubtree: !!cached.includeSubtree,
        reachableDocIds: new Set<string>(cached.reachableDocIds ?? []),
      };
    }

    const root = await this.getByUUID(context, uuid, ncMeta);
    if (!root) return null;

    const includeSubtree = !!getDocShareMeta(root.meta).include_subtree;
    const reachableDocIds = await this.computeReachableDocIds(
      root,
      includeSubtree,
      ncMeta,
    );

    const rootNode: PublicDocTreeNode = {
      id: root.id,
      title: root.title || 'Untitled',
      parent_id: null,
      order: root.order ?? 0,
      has_children: !!root.has_children,
      icon: (root.meta as any)?.icon ?? null,
    };

    const children = includeSubtree
      ? await this.getPublicChildren(
          context,
          root,
          root.id,
          reachableDocIds,
          ncMeta,
        )
      : [];
    const tree: PublicDocTreeNode[] = [rootNode, ...children];

    // reachableDocIds → plain array; rehydrated to a Set on read.
    await NocoCache.setExpiring(
      context,
      key,
      {
        root,
        tree,
        includeSubtree,
        reachableDocIds: [...reachableDocIds],
      },
      PUBLIC_SHARE_SCOPE_TTL_SECONDS,
    );

    return { root, tree, includeSubtree, reachableDocIds };
  }
}
