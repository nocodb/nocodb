import { ModelTypes } from 'nocodb-sdk';
import {
  isBcryptHash,
  NC_VIEW_PASSWORD_PROTECTED_SENTINEL,
} from 'nocodb-sdk';
import { customAlphabet } from 'nanoid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import DocumentCE from 'src/models/Document';
import type { DocumentType, NcContext } from 'nocodb-sdk';
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
        fields: ['id'],
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
  // Docs are rows in nc_models_v2, which already carries uuid + password
  // columns (originally added for view share). Sharing a doc reuses those
  // columns directly — no migration needed.

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
   * Enable public share for a doc — assigns a UUID if one isn't already set.
   * Idempotent: calling on an already-shared doc returns the existing UUID.
   */
  public static async share(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Document> {
    const doc = await this.getMeta(context, docId, ncMeta);
    if (!doc) NcError.get(context).genericNotFound('Document', docId);

    if (!doc.uuid) {
      const uuid = uuidv4();
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        { uuid },
        { id: docId, type: ModelTypes.DOCUMENT },
      );
      doc.uuid = uuid;
      await NocoCache.del(context, `${CacheScope.DOCUMENT}:${docId}`);
    }

    return doc;
  }

  /** Disable public share — clears uuid and password. */
  public static async unshare(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      { uuid: null, password: null },
      { id: docId, type: ModelTypes.DOCUMENT },
    );
    await NocoCache.del(context, `${CacheScope.DOCUMENT}:${docId}`);
  }

  /**
   * Update share-time settings — password and meta.share.include_subtree.
   * Password rules mirror View.passwordUpdate (sentinel = no change, never
   * re-hash a bcrypt hash, plaintext gets hashed).
   */
  public static async updateShareSettings(
    context: NcContext,
    docId: string,
    body: { password?: string | null; include_subtree?: boolean },
    ncMeta = Noco.ncMeta,
  ): Promise<Document> {
    const doc = await this.getMeta(context, docId, ncMeta);
    if (!doc) NcError.get(context).genericNotFound('Document', docId);
    if (!doc.uuid) {
      NcError.get(context).badRequest('Document is not shared');
    }

    const updateObj: Record<string, any> = {};

    if (body.password !== undefined) {
      if (body.password === null || body.password === '') {
        updateObj.password = null;
      } else if (
        body.password !== NC_VIEW_PASSWORD_PROTECTED_SENTINEL &&
        !isBcryptHash(body.password)
      ) {
        updateObj.password = await bcrypt.hash(body.password, 10);
      }
    }

    if (body.include_subtree !== undefined) {
      const meta = { ...(doc.meta ?? {}) };
      const shareMeta = { ...((meta as any).share ?? {}) };
      shareMeta.include_subtree = !!body.include_subtree;
      (meta as any).share = shareMeta;
      updateObj.meta = meta;
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
    }

    return await this.getMeta(context, docId, ncMeta);
  }

  /**
   * Verify a plaintext password against the stored hash.
   *
   * Mirrors View.verifyPassword:
   * - No stored password → always passes.
   * - Bcrypt hash → bcrypt.compare.
   * - Legacy plaintext (rows that pre-date the bcrypt migration) → timing-safe
   *   string compare. Pads with a zeroed buffer on length mismatch so the
   *   timing cost is the same either way.
   */
  public static async verifyPassword(
    doc: { password?: string | null },
    inputPassword: string,
  ): Promise<boolean> {
    if (!doc.password) return true;
    if (!inputPassword) return false;

    if (isBcryptHash(doc.password)) {
      return bcrypt.compare(inputPassword, doc.password);
    }

    const a = Buffer.from(inputPassword, 'utf-8');
    const b = Buffer.from(doc.password, 'utf-8');
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, Buffer.alloc(a.length));
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Mask the stored password before returning a doc to an owner-facing client.
   * Bcrypt hashes get replaced with the sentinel; the hash never leaves the
   * backend. Returns a clone so callers can't mutate the cached instance.
   */
  public static maskPasswordForResponse<
    T extends { password?: string | null },
  >(doc: T): T {
    if (!doc || !doc.password) return doc;
    if (!isBcryptHash(doc.password)) return doc;
    return Object.assign(Object.create(Object.getPrototypeOf(doc)), doc, {
      password: NC_VIEW_PASSWORD_PROTECTED_SENTINEL,
    });
  }

  /**
   * Resolve the in-scope subtree for a public share root.
   *
   * Visibility rule:
   *  - The share root itself is always in scope.
   *  - Descendants are in scope iff `root.meta.share.include_subtree` is true.
   *
   * Returns a flat list of lightweight nodes (no content) ordered by parent,
   * then `order`. Caller is responsible for building the tree client-side.
   */
  public static async getPublicSubtree(
    context: NcContext,
    root: Document,
    ncMeta = Noco.ncMeta,
  ): Promise<
    Array<{
      id: string;
      title: string;
      parent_id: string | null;
      order: number;
      has_children: boolean;
    }>
  > {
    const rootNode = {
      id: root.id,
      title: root.title || 'Untitled',
      parent_id: null as string | null,
      order: root.order ?? 0,
      has_children: !!root.has_children,
    };

    const includeSubtree = !!(root.meta as any)?.share?.include_subtree;
    if (!includeSubtree) return [rootNode];

    // BFS over parent_id within the same base, soft-deleted excluded.
    const collected: Record<string, any>[] = [];
    let frontier: string[] = [root.id];

    while (frontier.length) {
      const children = await ncMeta.metaList2(
        root.fk_workspace_id,
        root.base_id,
        MetaTable.MODELS,
        {
          condition: {
            base_id: root.base_id,
            type: ModelTypes.DOCUMENT,
            deleted: false,
          },
          xcCondition: {
            parent_id: { in: frontier },
          },
          orderBy: { order: 'asc' },
          fields: [
            'id',
            'title',
            'parent_id',
            'order',
            'has_children',
          ],
        },
      );

      if (!children.length) break;
      collected.push(...children);
      frontier = children
        .filter((c) => c.has_children)
        .map((c) => c.id as string);
    }

    return [
      rootNode,
      ...collected.map((c) => ({
        id: c.id as string,
        title: (c.title as string) || 'Untitled',
        // Anchor descendants of the root under "null" so the root stays the
        // tree root from the consumer's perspective — the parent_id chain
        // above the root would otherwise leak.
        parent_id: c.parent_id === root.parent_id ? null : c.parent_id,
        order: (c.order as number) ?? 0,
        has_children: !!c.has_children,
      })),
    ];
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
