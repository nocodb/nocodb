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
  is_external: boolean;
  deleted: boolean;
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
        { deleted: true },
        fileReferenceObj.id,
      );
    } else {
      await ncMeta.bulkMetaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.FILE_REFERENCES,
        { deleted: true },
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
          `${CacheScope.STORAGE_STATS}:workspace:${context.workspace_id}`,
        );
      } else {
        await NocoCache.incrHashField(
          `${CacheScope.STORAGE_STATS}:workspace:${context.workspace_id}`,
          PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE,
          decrement ? -(size ?? 0) : size ?? 0,
        );
      }
    }
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
