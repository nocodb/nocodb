import { PlanLimitTypes } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { CacheScope, MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';

const logger = new Logger('FileReference');

export default class FileReference {
  id: string;
  storage: string;
  file_url: string;
  file_size: number;
  fk_user_id: string;
  fk_workspace_id: string;
  base_id: string;
  source_id: string;
  fk_model_id: string;
  fk_column_id: string;
  fk_row_id: string;
  fk_doc_id: string;
  fk_revision_id: string;
  fk_session_id: string;
  is_external: boolean;
  deleted: boolean;
  soft_deleted: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<FileReference>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    fileRefObj: Partial<FileReference>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(fileRefObj, [
      'id',
      'storage',
      'file_url',
      'file_size',
      'fk_user_id',
      'source_id',
      'fk_model_id',
      'fk_column_id',
      'fk_row_id',
      'fk_doc_id',
      'fk_revision_id',
      'fk_session_id',
      'is_external',
      'deleted',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      insertObj,
    );

    if (context.workspace_id && !insertObj.deleted) {
      await this.updateWorkspaceCache(context, insertObj.file_size);
    }

    return id;
  }

  /**
   * Bulk-insert FileReferences in a single query. Returns the inserted rows
   * with their generated IDs, in input order. Used by SmartText reconcile to
   * avoid N sequential inserts when a cell contains many attachments.
   */
  public static async bulkInsert(
    context: NcContext,
    fileRefObjs: Partial<FileReference>[],
    ncMeta = Noco.ncMeta,
  ): Promise<{ id: string }[]> {
    if (!fileRefObjs?.length) return [];

    const insertObjs = fileRefObjs.map((f) =>
      extractProps(f, [
        'id',
        'storage',
        'file_url',
        'file_size',
        'fk_user_id',
        'source_id',
        'fk_model_id',
        'fk_column_id',
        'fk_row_id',
        'fk_doc_id',
        'fk_revision_id',
        'fk_session_id',
        'is_external',
        'deleted',
      ]),
    );

    const inserted = await ncMeta.bulkMetaInsert(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      insertObjs,
    );

    if (context.workspace_id) {
      const totalSize = insertObjs
        .filter((o) => !o.deleted)
        .reduce((sum, o) => sum + (o.file_size ?? 0), 0);
      if (totalSize > 0) {
        await this.updateWorkspaceCache(context, totalSize);
      }
    }

    return inserted.map((r: any) => ({ id: r.id }));
  }

  // used when url downloaded
  public static async updateById(
    context: NcContext,
    id: string,
    fileRefObj: Partial<FileReference>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(fileRefObj, [
      'storage',
      'file_url',
      'file_size',
      'fk_user_id',
      'source_id',
      'fk_model_id',
      'fk_column_id',
      'fk_row_id',
      'fk_doc_id',
      'fk_revision_id',
      'fk_session_id',
      'is_external',
      'deleted',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      updateObj,
      id,
    );

    if (context.workspace_id && !updateObj.deleted) {
      await this.updateWorkspaceCache(context, updateObj.file_size);
    }

    return id;
  }

  public static async delete(
    context: NcContext,
    fileReferenceId: string | string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (
      !fileReferenceId ||
      (Array.isArray(fileReferenceId) && fileReferenceId.length === 0)
    ) {
      return;
    }

    const fileReferences = Array.isArray(fileReferenceId)
      ? fileReferenceId
      : [fileReferenceId];

    let fileReferencesSize = 0;

    try {
      fileReferencesSize = await FileReference.sumSize(
        context,
        {},
        fileReferences,
        ncMeta,
      );
    } catch (error) {
      fileReferencesSize = -1;
      logger.error('Error while summing file reference size');
      logger.error(error);
    }

    if (fileReferences.length === 1) {
      const fileReferenceObj = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILE_REFERENCES,
        fileReferences[0],
      );

      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.FILE_REFERENCES,
        { deleted: true, soft_deleted: false },
        fileReferenceObj.id,
      );
    } else {
      await ncMeta.bulkMetaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.FILE_REFERENCES,
        { deleted: true, soft_deleted: false },
        fileReferences,
      );
    }

    await this.updateWorkspaceCache(context, fileReferencesSize, true);
  }

  public static async bulkDelete(
    context: NcContext,
    condition: {
      workspace_id?: string;
      base_id?: string;
      fk_model_id?: string;
      fk_column_id?: string;
      fk_doc_id?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    let fileReferencesSize = 0;

    try {
      fileReferencesSize = await FileReference.sumSize(
        context,
        condition,
        undefined,
        ncMeta,
      );
    } catch (error) {
      fileReferencesSize = -1;
      logger.error('Error while summing file reference size');
      logger.error(error);
    }

    await ncMeta.bulkMetaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      { deleted: true },
      null,
      condition,
    );

    await this.updateWorkspaceCache(context, fileReferencesSize, true);
  }

  /**
   * Mark file references as soft-deleted (parent record moved to trash).
   * Physical files preserved; excluded from workspace storage count.
   */
  public static async softDelete(
    context: NcContext,
    fileReferenceId: string | string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (
      !fileReferenceId ||
      (Array.isArray(fileReferenceId) && fileReferenceId.length === 0)
    ) {
      return;
    }

    const fileReferences = Array.isArray(fileReferenceId)
      ? fileReferenceId
      : [fileReferenceId];

    let fileReferencesSize = 0;

    try {
      fileReferencesSize = await FileReference.sumSize(
        context,
        {},
        fileReferences,
        ncMeta,
      );
    } catch (error) {
      fileReferencesSize = -1;
      logger.error('Error while summing file reference size');
      logger.error(error);
    }

    await ncMeta.bulkMetaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      { soft_deleted: true },
      fileReferences,
    );

    await this.updateWorkspaceCache(context, fileReferencesSize, true);
  }

  /**
   * Restore soft-deleted file references (parent record restored from trash).
   * Re-counted in workspace storage.
   */
  public static async softRestore(
    context: NcContext,
    fileReferenceId: string | string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (
      !fileReferenceId ||
      (Array.isArray(fileReferenceId) && fileReferenceId.length === 0)
    ) {
      return;
    }

    const fileReferences = Array.isArray(fileReferenceId)
      ? fileReferenceId
      : [fileReferenceId];

    let fileReferencesSize = 0;

    try {
      fileReferencesSize = await FileReference.sumSize(
        context,
        {},
        fileReferences,
        ncMeta,
      );
    } catch (error) {
      fileReferencesSize = -1;
      logger.error('Error while summing file reference size');
      logger.error(error);
    }

    await ncMeta.bulkMetaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      { soft_deleted: false },
      fileReferences,
    );

    await this.updateWorkspaceCache(context, fileReferencesSize, false);
  }

  /**
   * Restore soft-deleted file references by condition (parent record restored from trash).
   */
  public static async bulkSoftRestore(
    context: NcContext,
    condition: {
      fk_model_id?: string;
      fk_column_id?: string;
      fk_doc_id?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    let fileReferencesSize = 0;

    try {
      fileReferencesSize =
        (
          await ncMeta
            .knexConnection(MetaTable.FILE_REFERENCES)
            .sum('file_size as total')
            .where(condition)
            .where('soft_deleted', true)
            .first()
        )?.total || 0;
    } catch (error) {
      fileReferencesSize = -1;
      logger.error('Error while summing file reference size');
      logger.error(error);
    }

    await ncMeta.bulkMetaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      { soft_deleted: false },
      null,
      { ...condition, soft_deleted: true },
    );

    await this.updateWorkspaceCache(context, fileReferencesSize, false);
  }

  public static async get(context: NcContext, id: any, ncMeta = Noco.ncMeta) {
    const fileReferenceData = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      id,
    );

    return fileReferenceData && new FileReference(fileReferenceData);
  }

  /**
   * Fetch multiple FileReferences in a single query. Used by SmartText
   * reconcile to validate pre-existing IDs without N round-trips.
   */
  public static async listByIds(
    context: NcContext,
    ids: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<FileReference[]> {
    if (!ids?.length) return [];
    const rows = await ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({ base_id: context.base_id })
      .whereIn('id', ids)
      .select('*');
    return rows.map((r: any) => new FileReference(r));
  }

  public static async updateWorkspaceCache(
    context: NcContext,
    size: number,
    decrement: boolean = false,
  ) {
    if (context.workspace_id) {
      if (size === -1) {
        await NocoCache.del(
          'root',
          `${CacheScope.STORAGE_STATS}:workspace:${context.workspace_id}`,
        );
      } else {
        await NocoCache.incrHashField(
          'root',
          `${CacheScope.STORAGE_STATS}:workspace:${context.workspace_id}`,
          PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE,
          decrement ? -(size ?? 0) : size ?? 0,
        );
      }
    }
  }

  /**
   * Active FileReference IDs for a doc's live content. Excludes revision
   * snapshots so reconcile only diffs against what's currently embedded.
   */
  public static async listIdsForDoc(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<string[]> {
    const rows = await ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({
        base_id: context.base_id,
        fk_doc_id: docId,
        deleted: false,
      })
      .whereNull('fk_revision_id')
      .select('id');

    return rows.map((r: any) => r.id);
  }

  /**
   * Like {@link listIdsForDoc} but also returns `created_at`, so the collab
   * prune can spare just-created (out-of-band / REST) refs.
   */
  public static async listIdRecordsForDoc(
    context: NcContext,
    docId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{ id: string; created_at: Date }[]> {
    return ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({
        base_id: context.base_id,
        fk_doc_id: docId,
        deleted: false,
      })
      .whereNull('fk_revision_id')
      .select('id', 'created_at');
  }

  /**
   * Sync the snapshot rows for a revision to match the attachments embedded
   * in its content. Snapshot rows are keyed by (revision_id, file_url) and
   * carry file_size=0 — the cleanup job groups by file_url and only purges
   * when every row in the group is deleted, so a live snapshot pins the
   * underlying file while the revision survives.
   *
   * Idempotent — safe on coalesce.
   */
  public static async syncSnapshotForRevision(
    context: NcContext,
    params: {
      docId: string;
      revisionId: string;
      attachmentIds: string[];
      fkUserId?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(params.attachmentIds ?? []));

    const [liveRows, existingSnapshots]: [
      { id: string; storage: string; file_url: string; fk_user_id: string }[],
      { id: string; file_url: string }[],
    ] = await Promise.all([
      uniqueIds.length
        ? ncMeta
            .knexConnection(MetaTable.FILE_REFERENCES)
            .where({ base_id: context.base_id, fk_doc_id: params.docId })
            .whereNull('fk_revision_id')
            .whereIn('id', uniqueIds)
            .select('id', 'storage', 'file_url', 'fk_user_id')
        : Promise.resolve([]),
      ncMeta
        .knexConnection(MetaTable.FILE_REFERENCES)
        .where({
          base_id: context.base_id,
          fk_revision_id: params.revisionId,
        })
        .select('id', 'file_url'),
    ]);

    const expectedFileUrls = new Set(liveRows.map((r) => r.file_url));
    const seen = new Set(existingSnapshots.map((r) => r.file_url));

    // Insert one row per new file_url. `seen` also dedupes when two live rows
    // share a file_url (re-upload of the same physical file).
    const snapshotObjs: Partial<FileReference>[] = [];
    for (const r of liveRows) {
      if (seen.has(r.file_url)) continue;
      seen.add(r.file_url);
      snapshotObjs.push({
        storage: r.storage,
        file_url: r.file_url,
        file_size: 0,
        fk_user_id: r.fk_user_id ?? params.fkUserId ?? 'anonymous',
        fk_doc_id: params.docId,
        fk_revision_id: params.revisionId,
        deleted: false,
      });
    }
    if (snapshotObjs.length) {
      await this.bulkInsert(context, snapshotObjs, ncMeta);
    }

    // Hard-delete orphans (attachments that never settled in the revision's
    // content). Soft-deleting would pin the file_url group forever.
    const orphanIds = existingSnapshots
      .filter((r) => !expectedFileUrls.has(r.file_url))
      .map((r) => r.id);
    if (orphanIds.length) {
      await ncMeta
        .knexConnection(MetaTable.FILE_REFERENCES)
        .where({ base_id: context.base_id })
        .whereIn('id', orphanIds)
        .del();
    }
  }

  /**
   * True if any non-deleted FileReference under this doc (live row or
   * revision snapshot) references the given file_url.
   */
  public static async existsActiveByFileUrlInDoc(
    context: NcContext,
    docId: string,
    fileUrl: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const row = await ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({
        base_id: context.base_id,
        fk_doc_id: docId,
        file_url: fileUrl,
        deleted: false,
      })
      .select(ncMeta.knexConnection.raw('1'))
      .first();
    return !!row;
  }

  /**
   * Return the id of an active (non-deleted, non-revision) FileReference for a
   * doc + file_url, or null. Used to make eager attachment-ref creation
   * idempotent in collaborative mode — re-uploading the same physical file or
   * a retried request must not create duplicate refs for the same node.
   */
  public static async getActiveIdByFileUrlInDoc(
    context: NcContext,
    docId: string,
    fileUrl: string,
    ncMeta = Noco.ncMeta,
  ): Promise<string | null> {
    const row = await ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({
        base_id: context.base_id,
        fk_doc_id: docId,
        file_url: fileUrl,
        deleted: false,
      })
      .whereNull('fk_revision_id')
      .select('id')
      .first();
    return row?.id ?? null;
  }

  /**
   * Un-delete doc-owned FileReferences whose IDs are being reintroduced by
   * a revision restore. Without this, reconcileFileReferences leaves
   * pre-existing IDs alone, so previously soft-deleted refs stay deleted
   * after restore and the proxy 404s.
   */
  public static async reviveForDoc(
    context: NcContext,
    docId: string,
    ids: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    if (!ids?.length) return;

    const query = () =>
      ncMeta
        .knexConnection(MetaTable.FILE_REFERENCES)
        .where({ base_id: context.base_id, fk_doc_id: docId, deleted: true })
        .whereNull('fk_revision_id')
        .whereIn('id', ids);

    let restoredSize = 0;
    try {
      restoredSize =
        (await query().sum('file_size as total').first())?.total || 0;
    } catch (error) {
      restoredSize = -1;
      logger.error('Error while summing file reference size');
      logger.error(error);
    }

    await query().update({ deleted: false, soft_deleted: false });

    await this.updateWorkspaceCache(context, restoredSize);
  }

  /**
   * Soft-delete snapshot rows owned by the given revisions. file_size=0 so no
   * workspace cache update needed.
   */
  public static async bulkDeleteForRevisions(
    context: NcContext,
    revisionIds: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    if (!revisionIds?.length) return;

    // Chunk to stay under PG's WHERE IN planner cliff (~32k).
    const BATCH = 1000;
    for (let i = 0; i < revisionIds.length; i += BATCH) {
      await ncMeta
        .knexConnection(MetaTable.FILE_REFERENCES)
        .where({ base_id: context.base_id, deleted: false })
        .whereIn('fk_revision_id', revisionIds.slice(i, i + BATCH))
        .update({ deleted: true });
    }
  }

  /**
   * List non-deleted FileReference IDs for a SmartText cell (model + column + row).
   * Uses nc_fr_row_idx (base_id, fk_column_id, fk_row_id).
   */
  public static async listIdsForCell(
    context: NcContext,
    modelId: string,
    columnId: string,
    rowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<string[]> {
    const rows = await ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({
        base_id: context.base_id,
        fk_model_id: modelId,
        fk_column_id: columnId,
        fk_row_id: rowId,
        deleted: false,
      })
      .select('id');

    return rows.map((r: any) => r.id);
  }

  /**
   * Bulk-delete FileReferences for SmartText cells when their parent rows are
   * deleted. Hard-deletes (matches the row-delete attachment cleanup contract
   * in BaseModelSqlv2/delete.ts which uses FileReference.delete, not soft).
   * Uses nc_fr_row_idx (base_id, fk_column_id, fk_row_id).
   */
  public static async bulkDeleteForCells(
    context: NcContext,
    modelId: string,
    columnIds: string[],
    rowIds: string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!columnIds.length || !rowIds.length) return;

    let totalSize = 0;
    try {
      const sizeResult = await ncMeta
        .knexConnection(MetaTable.FILE_REFERENCES)
        .where({
          base_id: context.base_id,
          fk_model_id: modelId,
          deleted: false,
        })
        .whereIn('fk_column_id', columnIds)
        .whereIn('fk_row_id', rowIds)
        .sum('file_size as totalSize')
        .first();
      totalSize = sizeResult?.totalSize ? +sizeResult.totalSize : 0;
    } catch (error) {
      totalSize = -1;
      logger.error(
        `Error while summing file reference size: ${error?.message}`,
        error?.stack,
      );
    }

    await ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({
        base_id: context.base_id,
        fk_model_id: modelId,
        deleted: false,
      })
      .whereIn('fk_column_id', columnIds)
      .whereIn('fk_row_id', rowIds)
      .update({ deleted: true });

    await this.updateWorkspaceCache(context, totalSize, true);
  }

  /**
   * Bulk soft-delete FileReferences for SmartText cells when their parent rows
   * are soft-deleted (sent to trash). Mirrors `softDelete` semantics —
   * `soft_deleted` flag set, `deleted` left intact, physical files preserved.
   */
  public static async bulkSoftDeleteForCells(
    context: NcContext,
    modelId: string,
    columnIds: string[],
    rowIds: string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!columnIds.length || !rowIds.length) return;

    let totalSize = 0;
    try {
      const sizeResult = await ncMeta
        .knexConnection(MetaTable.FILE_REFERENCES)
        .where({
          base_id: context.base_id,
          fk_model_id: modelId,
          soft_deleted: false,
          deleted: false,
        })
        .whereIn('fk_column_id', columnIds)
        .whereIn('fk_row_id', rowIds)
        .sum('file_size as totalSize')
        .first();
      totalSize = sizeResult?.totalSize ? +sizeResult.totalSize : 0;
    } catch (error) {
      totalSize = -1;
      logger.error(
        `Error while summing file reference size: ${error?.message}`,
        error?.stack,
      );
    }

    await ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({
        base_id: context.base_id,
        fk_model_id: modelId,
        deleted: false,
      })
      .whereIn('fk_column_id', columnIds)
      .whereIn('fk_row_id', rowIds)
      .update({ soft_deleted: true });

    await this.updateWorkspaceCache(context, totalSize, true);
  }

  /**
   * Bulk soft-delete FileReferences for multiple docs in a single query.
   * Uses nc_fr_doc_idx (base_id, fk_doc_id) with WHERE IN for doc tree cascade.
   */
  public static async bulkDeleteForDocs(
    context: NcContext,
    docIds: string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!docIds.length) return;

    let totalSize = 0;
    try {
      const sizeResult = await ncMeta
        .knexConnection(MetaTable.FILE_REFERENCES)
        .where({ base_id: context.base_id, deleted: false })
        .whereIn('fk_doc_id', docIds)
        .sum('file_size as totalSize')
        .first();
      totalSize = sizeResult?.totalSize ? +sizeResult.totalSize : 0;
    } catch (error) {
      totalSize = -1;
      logger.error('Error while summing file reference size');
      logger.error(error);
    }

    await ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({ base_id: context.base_id, deleted: false })
      .whereIn('fk_doc_id', docIds)
      .update({ deleted: true });

    await this.updateWorkspaceCache(context, totalSize, true);
  }

  /**
   * Return all active FileReferences for a chat session.
   * Uses nc_fr_session_idx (fk_workspace_id, fk_session_id).
   */
  public static async listBySessionId(
    context: NcContext,
    sessionId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<FileReference[]> {
    const rows = await ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({
        fk_workspace_id: context.workspace_id,
        fk_session_id: sessionId,
        deleted: false,
      })
      .select('*');

    return rows.map((r: any) => new FileReference(r));
  }

  /**
   * Soft-delete all FileReferences for a chat session.
   */
  public static async bulkDeleteBySessionId(
    context: NcContext,
    sessionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let totalSize = 0;

    try {
      const sizeResult = await ncMeta
        .knexConnection(MetaTable.FILE_REFERENCES)
        .where({
          fk_workspace_id: context.workspace_id,
          fk_session_id: sessionId,
          deleted: false,
        })
        .sum('file_size as totalSize')
        .first();
      totalSize = sizeResult?.totalSize ? +sizeResult.totalSize : 0;
    } catch (error) {
      totalSize = -1;
      logger.error('Error while summing file reference size');
      logger.error(error);
    }

    await ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({
        fk_workspace_id: context.workspace_id,
        fk_session_id: sessionId,
        deleted: false,
      })
      .update({ deleted: true });

    await this.updateWorkspaceCache(context, totalSize, true);
  }

  public static async sumSize(
    context: NcContext,
    condition: {
      workspace_id?: string;
      base_id?: string;
      fk_model_id?: string;
      fk_column_id?: string;
    },
    pkIn?: string[],
    ncMeta = Noco.ncMeta,
  ) {
    const fileReferenceQb = ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where({
        deleted: false,
        soft_deleted: false,
        fk_workspace_id: context.workspace_id,
        ...condition,
      });

    if (pkIn) {
      fileReferenceQb.whereIn('id', pkIn);
    }

    const fileReferenceData = await fileReferenceQb
      .sum('file_size as totalSize')
      .first();

    if (fileReferenceData) {
      return +fileReferenceData.totalSize;
    }
    return 0;
  }
}
