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
  fk_model_id: string;
  fk_column_id: string;
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
      'storage',
      'file_url',
      'file_size',
      'fk_user_id',
      'fk_model_id',
      'fk_column_id',
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

  public static async bulkInsert(
    context: NcContext,
    fileRefObjs: Partial<FileReference>[],
    ncMeta = Noco.ncMeta,
  ) {
    let insertObjs = fileRefObjs.map((fileRefObj) =>
      extractProps(fileRefObj, [
        'storage',
        'file_url',
        'file_size',
        'fk_user_id',
        'fk_model_id',
        'fk_column_id',
        'deleted',
      ]),
    );

    // insertObj.id = await ncMeta.genNanoid(MetaTable.FILE_REFERENCES);
    // use promise.all to populate the ids
    insertObjs = await Promise.all(
      insertObjs.map(async (insertObj) => {
        insertObj.id = await ncMeta.genNanoid(MetaTable.FILE_REFERENCES);
        return insertObj;
      }),
    );

    await ncMeta.bulkMetaInsert(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      insertObjs,
    );

    return insertObjs;
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
    fileReferenceId = Array.isArray(fileReferenceId)
      ? fileReferenceId
      : [fileReferenceId];

    await ncMeta.bulkMetaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      { deleted: true },
      fileReferenceId,
    );
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

  public static async hardDelete(
    context: NcContext,
    fileReferenceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.FILE_REFERENCES,
      fileReferenceId,
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
