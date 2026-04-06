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
  RootScopes,
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
  fk_integration_id?: string;
  integration_type?: string;
  integration_sub_type?: string;

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
      'id',
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
      'fk_integration_id',
      'integration_type',
      'integration_sub_type',
    ]);

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

    const res = await this.get(context, id, ncMeta);

    await NocoCache.appendToList(
      context,
      CacheScope.BASE_VARIABLE,
      [data.base_id],
      `${CacheScope.BASE_VARIABLE}:${id}`,
    );

    return res;
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
      'fk_integration_id',
      'integration_type',
      'integration_sub_type',
    ]);

    if (updateObj.value && updateObj.value.length > MAX_VALUE_LENGTH) {
      NcError.badRequest('Variable value exceeds 64KB limit');
    }

    // If updating value, check if it needs encryption
    if (updateObj.value !== undefined) {
      const current = await BaseVariable.get(context, variableId, ncMeta);
      const type = updateObj.type || current?.type;

      if (type === BaseVariableValueType.SECRET && updateObj.value) {
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

    // Cache stores encrypted values (same as DB). Reads always
    // decrypt via prepareForRead, so this is safe.
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

  /**
   * Clean up auto-created integrations for INTEGRATION variables on a base.
   * Called during base soft-delete to remove orphaned workspace integrations.
   * Only deletes integrations on inherited (child) bases — not the author's original.
   */
  public static async cleanupInheritableIntegrations(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const variables = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.BASE_VARIABLES,
      {
        condition: {
          base_id: baseId,
          type: BaseVariableValueType.INTEGRATION,
          is_inherited: true,
        },
      },
    );

    for (const v of variables || []) {
      if (!v.fk_integration_id) continue;

      // Hard-delete the auto-created integration — it's an empty stub
      // restricted to this base only, no user data to preserve
      try {
        await ncMeta.metaDelete(
          context.workspace_id,
          RootScopes.WORKSPACE,
          MetaTable.INTEGRATIONS,
          v.fk_integration_id,
        );
      } catch {
        // Integration may already be deleted — ignore
      }
    }
  }

  /**
   * Find a variable by its linked integration ID within a base.
   */
  public static async getByIntegrationId(
    context: NcContext,
    baseId: string,
    integrationId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseVariable | null> {
    const variables = await BaseVariable.list(context, baseId, ncMeta);
    const match = variables.find(
      (v) =>
        v.type === BaseVariableValueType.INTEGRATION &&
        v.fk_integration_id === integrationId,
    );
    return match || null;
  }

  /**
   * Given an integration ID, return the inheritable variable ID if one exists
   * for the current base, otherwise return the original ID unchanged.
   * Use this at write time to ensure references always store the variable ID.
   */
  public static async resolveInheritableId(
    context: NcContext,
    integrationId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<string> {
    if (!integrationId || !context.base_id) return integrationId;

    // Already a variable ID — nothing to resolve
    if (integrationId.startsWith('bv')) return integrationId;

    const variable = await BaseVariable.getByIntegrationId(
      context,
      context.base_id,
      integrationId,
      ncMeta,
    );
    return variable?.id ?? integrationId;
  }

  /**
   * Remap integration IDs across all referencing tables within a base.
   * Called after an installer sets their integration on an inheritable variable.
   */
  public static async remapIntegrationId(
    context: NcContext,
    baseId: string,
    oldIntegrationId: string,
    newIntegrationId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    if (!oldIntegrationId || !newIntegrationId) return;
    if (oldIntegrationId === newIntegrationId) return;

    const condition = {
      base_id: baseId,
      fk_integration_id: oldIntegrationId,
    };
    const update = { fk_integration_id: newIntegrationId };

    // Direct FK columns: COL_BUTTON, COL_LONG_TEXT, SYNC_CONFIGS
    for (const table of [
      MetaTable.COL_BUTTON,
      MetaTable.COL_LONG_TEXT,
      MetaTable.SYNC_CONFIGS,
    ]) {
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        table,
        update,
        condition,
      );
    }

    // JSON fields in AUTOMATIONS: nodes and draft contain config objects
    // with authIntegrationId / aiIntegrationId
    const automations = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATIONS,
      { condition: { base_id: baseId } },
    );

    for (const automation of automations || []) {
      let changed = false;

      const remapNodes = (raw: string | any[] | null): any => {
        if (!raw) return raw;
        let nodes: any[];
        try {
          nodes = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          return raw;
        }
        if (!Array.isArray(nodes)) return raw;

        for (const node of nodes) {
          const config = node?.data?.config;
          if (!config) continue;
          for (const key of [
            'authIntegrationId',
            'aiIntegrationId',
            'integrationId',
          ]) {
            if (config[key] === oldIntegrationId) {
              config[key] = newIntegrationId;
              changed = true;
            }
          }
        }
        return typeof raw === 'string' ? JSON.stringify(nodes) : nodes;
      };

      const updatedNodes = remapNodes(automation.nodes);
      const updatedDraft = remapNodes(automation.draft);

      if (changed) {
        await ncMeta.metaUpdate(
          context.workspace_id,
          context.base_id,
          MetaTable.AUTOMATIONS,
          {
            nodes: updatedNodes,
            draft: updatedDraft,
          },
          automation.id,
        );
      }
    }
  }
}
