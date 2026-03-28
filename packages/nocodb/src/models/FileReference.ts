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
  fk_doc_id: string;
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
      'fk_doc_id',
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
      'fk_doc_id',
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
   * Return all active FileReference IDs for a doc.
   * Uses nc_fr_doc_idx (base_id, fk_doc_id).
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
      .select('id');

    return rows.map((r: any) => r.id);
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
