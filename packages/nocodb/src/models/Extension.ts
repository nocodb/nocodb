import type { NcContext } from '~/interface/config';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

export default class Extension {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_user_id?: string;
  extension_id?: string;
  title?: string;
  kv_store?: any;
  meta?: any;
  order?: number;

  constructor(extension: Partial<Extension>) {
    Object.assign(this, extension);
  }

  public static async get(
    context: NcContext,
    extensionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let extension = await NocoCache.get(
      `${CacheScope.EXTENSION}:${extensionId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!extension) {
      extension = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.EXTENSIONS,
        extensionId,
      );

      if (extension) {
        extension = prepareForResponse(extension, ['kv_store', 'meta']);
        NocoCache.set(`${CacheScope.EXTENSION}:${extensionId}`, extension);
      }
    }

    return extension && new Extension(extension);
  }

  static async list(context: NcContext, baseId: string, ncMeta = Noco.ncMeta) {
    const cachedList = await NocoCache.getList(CacheScope.EXTENSION, [baseId]);
    let { list: extensionList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !extensionList.length) {
      extensionList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.EXTENSIONS,
        {
          condition: {
            base_id: baseId,
          },
          orderBy: {
            created_at: 'asc',
          },
        },
      );

      if (extensionList) {
        extensionList = extensionList.map((extension) =>
          prepareForResponse(extension, ['kv_store', 'meta']),
        );
        NocoCache.setList(CacheScope.EXTENSION, [baseId], extensionList);
      }
    }

    return extensionList
      ?.sort((a, b) => (a?.order ?? Infinity) - (b?.order ?? Infinity))
      .map((extension) => new Extension(extension));
  }

  public static async insert(
    context: NcContext,
    extension: Partial<Extension>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(extension, [
      'id',
      'base_id',
      'fk_user_id',
      'extension_id',
      'title',
      'kv_store',
      'meta',
      'order',
    ]);

    if (insertObj.order === null || insertObj.order === undefined) {
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.EXTENSIONS, {
        base_id: insertObj.base_id,
      });
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.EXTENSIONS,
      prepareForDb(insertObj, ['kv_store', 'meta']),
    );

    return this.get(context, id, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        CacheScope.EXTENSION,
        [extension.base_id],
        `${CacheScope.EXTENSION}:${id}`,
      );
      return res;
    });
  }

  public static async update(
    context: NcContext,
    extensionId: string,
    extension: Partial<Extension>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(extension, [
      'fk_user_id',
      'extension_id',
      'title',
      'kv_store',
      'meta',
      'order',
    ]);

    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.EXTENSIONS,
      prepareForDb(updateObj, ['kv_store', 'meta']),
      extensionId,
    );

    await NocoCache.update(
      `${CacheScope.EXTENSION}:${extensionId}`,
      prepareForResponse(updateObj, ['kv_store', 'meta']),
    );

    return this.get(context, extensionId, ncMeta);
  }

  static async delete(
    context: NcContext,
    extensionId: any,
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.EXTENSIONS,
      extensionId,
    );

    await NocoCache.deepDel(
      `${CacheScope.EXTENSION}:${extensionId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return res;
  }
}
