import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';

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

    return id;
  }

  public static async update(
    context: NcContext,
    fileReferenceId: string | string[],
    fileReferenceObj: Partial<FileReference>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(fileReferenceObj, ['deleted']);

    fileReferenceId = Array.isArray(fileReferenceId)
      ? fileReferenceId
      : [fileReferenceId];

    return ncMeta.bulkMetaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      updateObj,
      fileReferenceId,
    );
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

    if (fileReferences.length === 1) {
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.FILE_REFERENCES,
        { deleted: true },
        fileReferences[0],
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
    await ncMeta.bulkMetaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      { deleted: true },
      null,
      condition,
    );
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
}
