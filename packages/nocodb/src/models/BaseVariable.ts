import CryptoJS from 'crypto-js';
import type {
  BaseVariableMode,
  BaseVariableType,
  BaseVariableValueType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/ncError';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { getCredentialEncryptSecret } from '~/utils/encryptDecrypt';

const KEY_REGEX = /^[A-Z][A-Z0-9_]*$/;

export default class BaseVariable implements BaseVariableType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  key?: string;
  value?: string;
  description?: string;
  mode?: BaseVariableMode;
  type?: BaseVariableValueType;
  is_sensitive?: boolean;
  order?: number;

  constructor(data: Partial<BaseVariable>) {
    Object.assign(this, data);
  }

  private static encryptValue(value: string): string {
    const secret = getCredentialEncryptSecret();
    if (!secret || !value) return value;
    return CryptoJS.AES.encrypt(value, secret).toString();
  }

  private static decryptValue(value: string): string {
    const secret = getCredentialEncryptSecret();
    if (!secret || !value) return value;
    try {
      return CryptoJS.AES.decrypt(value, secret).toString(CryptoJS.enc.Utf8);
    } catch {
      return value;
    }
  }

  private static prepareForDb(
    data: Partial<BaseVariable>,
  ): Record<string, any> {
    const obj = { ...data };
    if (obj.is_sensitive && obj.value) {
      obj.value = BaseVariable.encryptValue(obj.value);
    }
    return obj;
  }

  private static prepareForRead(
    data: Record<string, any>,
  ): Record<string, any> {
    if (data.is_sensitive && data.value) {
      data.value = BaseVariable.decryptValue(data.value);
    }
    return data;
  }

  public static async get(
    context: NcContext,
    variableId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let data = await NocoCache.get(
      context,
      `${CacheScope.BASE_VARIABLE}:${variableId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!data) {
      data = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.BASE_VARIABLES,
        variableId,
      );

      if (data) {
        data = BaseVariable.prepareForRead(data);
        NocoCache.set(
          context,
          `${CacheScope.BASE_VARIABLE}:${variableId}`,
          data,
        );
      }
    }

    return data && new BaseVariable(data);
  }

  public static async list(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.BASE_VARIABLE,
      [baseId],
    );
    let { list } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !list.length) {
      list = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.BASE_VARIABLES,
        {
          condition: { base_id: baseId },
          orderBy: { order: 'asc' },
        },
      );

      if (list) {
        list = list.map((item) => BaseVariable.prepareForRead(item));
        await NocoCache.setList(
          context,
          CacheScope.BASE_VARIABLE,
          [baseId],
          list,
        );
      }
    }

    return (list || [])
      .sort((a, b) => (a?.order ?? Infinity) - (b?.order ?? Infinity))
      .map((item) => new BaseVariable(item));
  }

  /**
   * Returns a flat key→value map for webhook template resolution.
   * Sensitive values are decrypted. Empty values are skipped.
   */
  public static async listAsMap(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Record<string, string>> {
    const variables = await BaseVariable.list(context, baseId, ncMeta);
    const map: Record<string, string> = {};
    for (const v of variables) {
      if (v.key && v.value) {
        map[v.key] = v.value;
      }
    }
    return map;
  }

  public static async insert(
    context: NcContext,
    data: Partial<BaseVariable>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(data, [
      'id',
      'base_id',
      'key',
      'value',
      'description',
      'mode',
      'type',
      'is_sensitive',
      'order',
    ]);

    // Validate key format
    if (!insertObj.key || !KEY_REGEX.test(insertObj.key)) {
      NcError.badRequest(
        'Variable key must be UPPER_SNAKE_CASE (e.g., MY_VARIABLE)',
      );
    }

    if (insertObj.order === null || insertObj.order === undefined) {
      insertObj.order = await ncMeta.metaGetNextOrder(
        MetaTable.BASE_VARIABLES,
        { base_id: insertObj.base_id },
      );
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.BASE_VARIABLES,
      BaseVariable.prepareForDb(insertObj),
    );

    return this.get(context, id, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        context,
        CacheScope.BASE_VARIABLE,
        [data.base_id],
        `${CacheScope.BASE_VARIABLE}:${id}`,
      );
      return res;
    });
  }

  public static async update(
    context: NcContext,
    variableId: string,
    data: Partial<BaseVariable>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(data, [
      'value',
      'description',
      'mode',
      'type',
      'is_sensitive',
      'order',
    ]);

    // If updating a sensitive variable's value, encrypt it
    if (updateObj.value !== undefined) {
      // Need to check current is_sensitive or the incoming one
      const current = await BaseVariable.get(context, variableId, ncMeta);
      const isSensitive =
        updateObj.is_sensitive !== undefined
          ? updateObj.is_sensitive
          : current?.is_sensitive;

      if (isSensitive && updateObj.value) {
        updateObj.value = BaseVariable.encryptValue(updateObj.value);
      }
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.BASE_VARIABLES,
      updateObj,
      variableId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.BASE_VARIABLE}:${variableId}`,
      updateObj,
    );

    return this.get(context, variableId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    variableId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.BASE_VARIABLES,
      variableId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.BASE_VARIABLE}:${variableId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return res;
  }

  public static async deleteByBaseId(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.BASE_VARIABLES,
      { base_id: baseId },
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.BASE_VARIABLE}:${baseId}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );
  }
}
