import { ModelTypes } from 'nocodb-sdk';
import { PermissionEntity, PermissionKey } from 'nocodb-sdk';
import { customAlphabet } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';
import DocumentCE from 'src/models/Document';
import { getDocShareMeta } from 'nocodb-sdk';
import type {
  DocumentType,
  NcContext,
  PublicDocChildNode,
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

/**
 * Defensive cap on the parent-chain walk used to validate that an arbitrary
 * docId is inside a public share. Real doc trees are nowhere near this deep;
 * the cap exists only to guarantee termination if a malformed cycle ever
 * makes it into the DB.
 */
const MAX_PUBLIC_SCOPE_WALK_DEPTH = 64;

/**
 * Data model for Documents (stored in nc_models_v2 with type='document').
 *
 * Document metadata lives in `nc_models_v2` (via ncMeta) while content
 * (ProseMirror JSON) lives in `nc_doc_content_v2` (via ncDocsContent).
 * When `NC_DOCS_DB` is not set, both resolve to the same meta connection.
 *
 * The DB column `doc_version` is mapped to `version` on the model/SDK side.
 *
 * JSON fields (content, meta) are stringified for DB storage and parsed on read
 * via `parseDocument()`. Cache invalidation uses `del` on update (not `update`) to
 * avoid storing stringified JSON in the cache layer.
 */
export default class Document extends DocumentCE implements DocumentType {
  constructor(doc: Document | DocumentType) {
    super(doc);
    Object.assign(this, doc);
  }

  /** Base condition to scope queries to documents only. */
  private static get typeCondition() {
    return { type: ModelTypes.DOCUMENT };
  }

  /**
   * Get document metadata only (no content). Safe to use inside transactions
   * because it does not query the satellite docs-content DB.
   */
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

    // Fetch content separately from content service
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

  /**
   * Full list — includes content fetched from the separate content table.
   * Used for tests and bulk export. For sidebar use `listLite()` instead.
   *
   * @param parentId — `null` (default) for root documents, doc ID for children.
   */
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

  /**
   * Lightweight list for sidebar — excludes `content` to avoid
   * transferring large ProseMirror JSON payloads.
   *
   * @param parentId — `null` for root documents, doc ID for children,
   *   `undefined` to list all documents across all hierarchy levels.
   */
  public static async listLite(
    context: NcContext,
    baseId: string,
    parentId: string | null | undefined = null,
    ncMeta = Noco.ncMeta,
  ) {
    // `uuid` is fetched here so the share-state survives a sidebar refresh.
    // The docs store rebuilds its in-memory map from these lite rows, and
    // SharePageDoc reads `activeDocument.uuid` to decide whether the public-
    // viewing toggle is on — without it, the toggle would flip back to off
    // every time the sidebar reloads even though the DB row still has the
    // uuid. Password stays out (bcrypt hash, not needed for UI state).
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

  /**
   * Batch-fetch lightweight docs for multiple parent IDs in a single query.
   * Used to check has_children visibility without N+1 listLite calls.
   */
  public static async listLiteByParentIds(
    context: NcContext,
    baseId: string,
    parentIds: string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!parentIds.length) return [];

    // `uuid` is fetched here so the share-state survives a sidebar refresh.
    // The docs store rebuilds its in-memory map from these lite rows, and
    // SharePageDoc reads `activeDocument.uuid` to decide whether the public-
    // viewing toggle is on — without it, the toggle would flip back to off
    // every time the sidebar reloads even though the DB row still has the
    // uuid. Password stays out (bcrypt hash, not needed for UI state).
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

  /**
   * List ALL documents for a base (lightweight — no content, no parent_id filter).
   * Returns a flat list of every non-deleted doc. Used by the permissions
   * settings page to render the full doc tree in a single request.
   */
  public static async listAllLite(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // `uuid` is fetched here so the share-state survives a sidebar refresh.
    // The docs store rebuilds its in-memory map from these lite rows, and
    // SharePageDoc reads `activeDocument.uuid` to decide whether the public-
    // viewing toggle is on — without it, the toggle would flip back to off
    // every time the sidebar reloads even though the DB row still has the
    // uuid. Password stays out (bcrypt hash, not needed for UI state).
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

  /**
   * Load the given docs (by id) with their content. Pagination is the
   * caller's responsibility — pass a bounded slice of ids so only that
   * slice's metadata + content is held in memory at a time. Used by export
   * to stream through all documents in a base without buffering every
   * ProseMirror payload at once.
   */
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

    // Invalidate cache — updateObj contains stringified JSON fields
    // that would corrupt the cache if written directly.
    // The subsequent get() will re-fetch from DB and cache the parsed result.
    const key = `${CacheScope.DOCUMENT}:${docId}`;
    await NocoCache.del(context, key);

    // Title / icon / order change → invalidate the share-scope cache of the
    // doc itself (if it is a share root) and its ancestors (since their
    // cached children list contains this doc's title/icon/order).
    await this.invalidateShareCacheUpTree(context, docId, ncMeta);

    return await this.get(context, docId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Delete content row first
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

    // Invalidate the share-scope cache before the rows go away — the walk
    // reads uuid + parent_id from the DB and the docs we're about to delete
    // still have those values set here.
    await this.invalidateShareCacheUpTree(context, docId, ncMeta);

    // Cascade: soft-delete all descendants first
    await this.cascadeSoftDelete(context, docId, ncMeta);

    // Soft-delete the document itself
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      { deleted: true },
      { id: docId, ...this.typeCondition },
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
      MetaTable.MODELS,
      {
        condition: {
          parent_id: parentId,
          deleted: false,
          ...this.typeCondition,
        },
        // uuid is needed to invalidate the share-scope cache when a
        // descendant is itself a share root — otherwise its public meta
        // call keeps returning the cached (now-deleted) row.
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

    // Moving a doc changes the children list of both the old and the new
    // parent — invalidate the share-scope cache up both chains so the public
    // reader picks up the new placement without disable/re-enable share.
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
  //
  // Docs are rows in nc_models_v2, which already carries a uuid column
  // (originally added for view share). Sharing a doc reuses the column
  // directly — no migration needed. Docs do not support password protection.

  /** Lookup by public-share UUID (no auth context required — global bypass). */
  public static async getByUUID(
    context: NcContext,
    uuid: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Document | null> {
    const row = await ncMeta.metaGet2(
      RootScopes.FULL_BYPASS,
      RootScopes.FULL_BYPASS,
      MetaTable.MODELS,
      { uuid, type: ModelTypes.DOCUMENT },
      undefined,
      notDeletedXcCondition,
    );

    if (!row) return null;
    return new Document(this.parseDocument(row));
  }

  /**
   * Enable public share for a doc. Atomically assigns a uuid and seeds the
   * default share settings (`meta.share.include_subtree=true`) in a single
   * write so the share is immediately useful without a follow-up settings
   * call.
   *
   * Race-safe: the underlying UPDATE filters on `uuid IS NULL`, so two
   * concurrent share calls can't clobber each other — exactly one wins, the
   * loser sees the winner's uuid on re-read. Idempotent: calling on an
   * already-shared doc is a no-op and returns the existing uuid.
   */
  public static async share(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Document> {
    const existing = await this.getMeta(context, docId, ncMeta);
    if (!existing) NcError.get(context).genericNotFound('Document', docId);

    // Refuse to share docs with custom visibility. An explicit
    // DOCUMENT_VISIBILITY row means the owner restricted who can see this
    // doc inside the workspace; publishing it publicly would bypass that
    // restriction by handing anyone-with-the-URL the same view the owner
    // tried to block. The check is direct (explicit row on this doc only)
    // — inherited restrictions from ancestors aren't tested here because
    // the user-facing flag (`has_visibility_permission`) maps 1:1 to the
    // explicit row, and the rule stays predictable: reset the doc's own
    // visibility to default, then share.
    //
    // Raw ncMeta query (no Permission model) is intentional — Permission
    // already imports Document, so importing it back would close a
    // circular reference. The lookup is one-shot per share toggle, so
    // skipping the cached list is fine.
    const visibilityPermission = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSIONS,
      {
        entity: PermissionEntity.DOCUMENT,
        entity_id: docId,
        permission: PermissionKey.DOCUMENT_VISIBILITY,
      },
    );
    if (visibilityPermission) {
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

    // Re-read so the returned doc reflects the winning uuid + seeded meta
    // (ours when no race, or another concurrent caller's when we lost).
    const fresh = await this.getMeta(context, docId, ncMeta);
    if (!fresh) NcError.get(context).genericNotFound('Document', docId);

    // Defensive: invalidate any stale share-scope cache for this uuid
    // (e.g. concurrent request seeded the cache between unshare and re-share).
    if (fresh.uuid) {
      await NocoCache.del(
        context,
        `${CacheScope.DOCUMENT}:share:${fresh.uuid}`,
      );
    }

    return fresh;
  }

  /** Disable public share — clears uuid. */
  public static async unshare(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // Read uuid before clearing so we can invalidate the share-scope cache.
    const doc = await this.getMeta(context, docId, ncMeta);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      { uuid: null },
      { id: docId, type: ModelTypes.DOCUMENT },
    );
    if (doc?.uuid) {
      await NocoCache.del(context, `${CacheScope.DOCUMENT}:share:${doc.uuid}`);
    }
    await NocoCache.del(context, `${CacheScope.DOCUMENT}:${docId}`);
  }

  /**
   * Update share-time settings — currently only `meta.share.include_subtree`.
   */
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

  /**
   * Direct children of a doc, shaped for the public reader. Mirrors the
   * in-app `Document.listLite(parentId)` pattern — one level at a time, no
   * recursion. The public reader uses this for both the initial tree (root
   * + its children) and lazy expansion of any descendant on click.
   *
   * Scope checks are the caller's responsibility — see
   * `Document.isInPublicScope` before invoking this for a non-root parent.
   */
  public static async getPublicChildren(
    context: NcContext,
    root: Document,
    parentDocId: string,
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

    // Drop children with explicit DOCUMENT_VISIBILITY permissions —
    // they're excluded from the public share, and so are their
    // descendants. The pruning happens naturally: the frontend only
    // calls /children/:parentId once a node appears in the tree, and
    // we never surface a restricted node here, so deeper levels are
    // never requested. The corresponding `isInPublicScope` guard on
    // /content + /attachment + /children prevents direct-URL bypass.
    //
    // Raw ncMeta query (no Permission model) to avoid the circular
    // import — Permission already imports Document. Permissions are
    // base-scoped and cheap to list per call; if this becomes a hot
    // path we can co-load into the share-scope cache.
    if (rows.length) {
      const visibilityRows = await ncMeta.metaList2(
        root.fk_workspace_id,
        root.base_id,
        MetaTable.PERMISSIONS,
        {
          condition: {
            base_id: root.base_id,
            entity: PermissionEntity.DOCUMENT,
            permission: PermissionKey.DOCUMENT_VISIBILITY,
          },
          xcCondition: {
            entity_id: { in: rows.map((r: any) => r.id as string) },
          },
          fields: ['entity_id'],
        },
      );
      if (visibilityRows.length) {
        const restricted = new Set<string>(
          (visibilityRows as Array<{ entity_id: string }>).map(
            (p) => p.entity_id,
          ),
        );
        for (let i = rows.length - 1; i >= 0; i--) {
          if (restricted.has(rows[i].id as string)) rows.splice(i, 1);
        }
      }
    }

    return rows.map((c: any) => {
      // metaList2 returns `meta` as a JSON string (raw column value); parse
      // defensively so callers can read fields directly.
      const meta =
        typeof c.meta === 'string'
          ? (() => {
              try {
                return JSON.parse(c.meta);
              } catch {
                return {};
              }
            })()
          : c.meta ?? {};

      return {
        id: c.id as string,
        title: (c.title as string) || 'Untitled',
        // Keep parent_id as-is. The share root is re-anchored to null in
        // `getPublicInitialTree`, so direct children point to the root's id
        // and the frontend tree walker (starts at parent_id=null → root →
        // descendants) reconstructs the tree correctly without further
        // rewriting.
        parent_id: c.parent_id as string,
        order: (c.order as number) ?? 0,
        has_children: !!c.has_children,
        icon: (meta as any)?.icon ?? null,
      };
    });
  }

  /**
   * Initial tree shown when the public reader page loads: root + its direct
   * children. Deeper descendants are fetched lazily via `getPublicChildren`
   * once the user expands a node. This matches the in-app sidebar shape so
   * a viral public link can't fan out into thousands of pre-loaded nodes.
   *
   * When `meta.share.include_subtree` is false, only the root is returned.
   */
  public static async getPublicInitialTree(
    context: NcContext,
    root: Document,
    ncMeta = Noco.ncMeta,
  ): Promise<Array<PublicDocTreeNode>> {
    const rootNode: PublicDocTreeNode = {
      id: root.id,
      title: root.title || 'Untitled',
      // Force the share root to the visible-tree root regardless of its DB
      // parent_id, so descendants' parent_id chain stops here rather than
      // leaking the doc's place under any non-shared ancestor.
      parent_id: null,
      order: root.order ?? 0,
      has_children: !!root.has_children,
      // Emoji / icon-name lives on doc.meta.icon — surface it so the
      // shared sidebar + topbar render the same icon as the in-app editor.
      icon: (root.meta as any)?.icon ?? null,
    };

    if (!getDocShareMeta(root.meta).include_subtree) return [rootNode];

    const children = await this.getPublicChildren(
      context,
      root,
      root.id,
      ncMeta,
    );
    return [rootNode, ...children];
  }

  /**
   * Whether `docId` is reachable through the public share rooted at `root`.
   *
   * Walks the parent_id chain bottom-up from `docId` until it hits the share
   * root (in scope) or runs out of parents (out of scope). Used to validate
   * `/content`, `/attachment`, and `/children/:parentId` requests against
   * arbitrary attacker-supplied ids — without this check, anyone holding the
   * share UUID could enumerate every doc in the base.
   *
   * Bounded to MAX_PUBLIC_SCOPE_WALK_DEPTH levels as a defensive guard
   * against malformed cycles; legitimate doc trees are nowhere near that
   * deep. Issues one metaGet2 per level (typically 1-5 queries for real
   * docs).
   */
  public static async isInPublicScope(
    context: NcContext,
    root: Document,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    if (docId === root.id) return true;

    if (!getDocShareMeta(root.meta).include_subtree) return false;

    let cursor: string | null = docId;
    for (let i = 0; i < MAX_PUBLIC_SCOPE_WALK_DEPTH && cursor; i++) {
      const row = await ncMeta.metaGet2(
        root.fk_workspace_id,
        root.base_id,
        MetaTable.MODELS,
        { id: cursor, type: ModelTypes.DOCUMENT },
        ['parent_id'],
        notDeletedXcCondition,
      );
      if (!row) return false;
      if (row.parent_id === root.id) return true;
      cursor = (row.parent_id as string | null) ?? null;
    }
    return false;
  }

  /**
   * Walk up the parent chain from `startDocId` (inclusive) and invalidate the
   * share-scope cache for every ancestor that has a `uuid` set. Called from
   * the mutation paths (insert / update / move / softDelete) so a viewer of
   * a shared root sees descendant additions, renames, moves, and deletions
   * without needing the owner to disable/re-enable sharing.
   *
   * Bounded to MAX_PUBLIC_SCOPE_WALK_DEPTH levels; legitimate doc trees never
   * come close. Issues one metaGet2 per level (typically 1–5 queries).
   */
  private static async invalidateShareCacheUpTree(
    context: NcContext,
    startDocId: string | null,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    if (!startDocId) return;
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

  /**
   * Resolve the share root + initial visible tree (root + its direct
   * children) for a UUID, cached.
   *
   * Cache key:  `${CacheScope.DOCUMENT}:share:${uuid}`
   * Invalidated on:  share, unshare, updateShareSettings, and any
   * insert / update / move / softDelete that touches a doc reachable from
   * the share root (via `invalidateShareCacheUpTree`). Walking up the parent
   * chain on every mutation is a few small metaGet2s — cheap next to a
   * stale public manifest.
   *
   * Only the initial tree is cached — `/children/:parentId` requests hit
   * the DB fresh so newly-added descendants appear without waiting for the
   * cache to bust.
   */
  public static async getCachedShareScope(
    context: NcContext,
    uuid: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{
    root: Document;
    tree: Array<PublicDocTreeNode>;
    includeSubtree: boolean;
  } | null> {
    const key = `${CacheScope.DOCUMENT}:share:${uuid}`;

    const cached = await NocoCache.get(context, key, CacheGetType.TYPE_OBJECT);
    if (cached?.root) {
      return {
        root: new Document(cached.root),
        tree: cached.tree ?? [],
        includeSubtree: !!cached.includeSubtree,
      };
    }

    const root = await this.getByUUID(context, uuid, ncMeta);
    if (!root) return null;

    const tree = await this.getPublicInitialTree(context, root, ncMeta);
    const includeSubtree = !!getDocShareMeta(root.meta).include_subtree;

    await NocoCache.set(context, key, {
      root,
      tree,
      includeSubtree,
    });

    return { root, tree, includeSubtree };
  }

  /**
   * Fetch just the content row for a doc. Used by the public reader so we
   * don't pay the metadata round-trip again on each navigation.
   */
  public static async getContentOnly(
    context: NcContext,
    docId: string,
  ): Promise<Record<string, any> | null> {
    const row = await Noco.ncDocsContent.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_CONTENT,
      { fk_doc_id: docId },
      ['content'],
    );
    if (!row) return null;
    const parsed = prepareForResponse(row, ['content']);
    return parsed.content ?? null;
  }
}
