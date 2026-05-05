import CryptoJS from 'crypto-js';
import { BaseVariableValueType } from 'nocodb-sdk';
import type { BaseVariableInheritance, BaseVariableType } from 'nocodb-sdk';
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
const MAX_VALUE_LENGTH = 65536; // 64KB

export default class BaseVariable implements BaseVariableType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  key?: string;
  value?: string;
  description?: string;
  inheritance?: BaseVariableInheritance;
  type?: BaseVariableValueType;
  order?: number;
  default_value?: string;
  is_overridden?: boolean;
  is_inherited?: boolean;

  constructor(data: Partial<BaseVariable>) {
    Object.assign(this, data);
  }

  get isSecret(): boolean {
    return this.type === BaseVariableValueType.SECRET;
  }

  private static isSecretType(data: Record<string, any>): boolean {
    return data.type === BaseVariableValueType.SECRET;
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
    if (BaseVariable.isSecretType(obj)) {
      if (obj.value) {
        obj.value = BaseVariable.encryptValue(obj.value);
      }
      if (obj.default_value) {
        obj.default_value = BaseVariable.encryptValue(obj.default_value);
      }
    }
    return obj;
  }

  private static prepareForRead(
    data: Record<string, any>,
  ): Record<string, any> {
    if (BaseVariable.isSecretType(data)) {
      if (data.value) {
        data.value = BaseVariable.decryptValue(data.value);
      }
      if (data.default_value) {
        data.default_value = BaseVariable.decryptValue(data.default_value);
      }
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
        NocoCache.set(
          context,
          `${CacheScope.BASE_VARIABLE}:${variableId}`,
          data,
        );
      }
    }

    if (data) {
      data = BaseVariable.prepareForRead(data);
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
      .map((item) => new BaseVariable(BaseVariable.prepareForRead(item)));
  }

  /**
   * Returns a flat key→value map for webhook template resolution.
   * Secret values are decrypted. Empty values are skipped.
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
      'base_id',
      'key',
      'value',
      'description',
      'inheritance',
      'type',
      'order',
      'default_value',
      'is_overridden',
      'is_inherited',
    ]);

    // Replay-only: preserve sandbox / undo-redo entity ID for idempotent merge.
    if (context?.additionalContext?.is_replay && data.id) {
      insertObj.id = data.id;
    }

    // Validate key format
    if (!insertObj.key || !KEY_REGEX.test(insertObj.key)) {
      NcError.badRequest(
        'Variable key must be UPPER_SNAKE_CASE (e.g., MY_VARIABLE)',
      );
    }

    if (insertObj.value && insertObj.value.length > MAX_VALUE_LENGTH) {
      NcError.badRequest('Variable value exceeds 64KB limit');
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
      'inheritance',
      'type',
      'order',
      'default_value',
      'is_overridden',
      'is_inherited',
    ]);

    if (updateObj.value && updateObj.value.length > MAX_VALUE_LENGTH) {
      NcError.badRequest('Variable value exceeds 64KB limit');
    }

    // Resolve effective type after the patch and the existing row so we can
    // (a) encrypt new value/default_value when SECRET, and (b) re-encrypt or
    // decrypt the persisted row when type flips between PLAIN and SECRET.
    const current = await BaseVariable.get(context, variableId, ncMeta);
    const previousType = current?.type;
    const nextType = updateObj.type ?? previousType;
    const willBeSecret = nextType === BaseVariableValueType.SECRET;
    const typeFlipped = !!previousType && previousType !== nextType;

    // BaseVariable.get() returns decrypted values via prepareForRead, so when
    // type flips and a field is not in the patch we pull it from `current`
    // (already plaintext) and write it through under the new encryption state.
    if (typeFlipped) {
      if (updateObj.value === undefined && current?.value) {
        updateObj.value = current.value;
      }
      if (updateObj.default_value === undefined && current?.default_value) {
        updateObj.default_value = current.default_value;
      }
    }

    if (willBeSecret) {
      if (updateObj.value) {
        updateObj.value = BaseVariable.encryptValue(updateObj.value);
      }
      if (updateObj.default_value) {
        updateObj.default_value = BaseVariable.encryptValue(
          updateObj.default_value,
        );
      }
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.BASE_VARIABLES,
      updateObj,
      variableId,
    );

    // Cache mirrors the DB row exactly: SECRET stores ciphertext, PLAIN stores
    // plaintext. Reads route through prepareForRead, which decrypts based on
    // the row's current `type`.
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
