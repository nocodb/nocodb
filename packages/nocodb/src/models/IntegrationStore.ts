import type { IntegrationType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import { isEE } from '~/utils';
import {
  IntegrationSlotTypes,
  STORE_DEFINITIONS,
} from '~/integrations/integration.store';

const prepareResponse = (
  obj: Record<string, any>,
  storeDefinition: (typeof STORE_DEFINITIONS)[keyof typeof STORE_DEFINITIONS],
) => {
  const keepKeys = [
    'id',
    'fk_integration_id',
    'type',
    'sub_type',
    'fk_workspace_id',
    'fk_user_id',
    'created_at',
    'updated_at',
    // slots occupied,
    ...Object.keys(storeDefinition),
  ];

  for (const [k, v] of Object.entries(storeDefinition)) {
    if (k !== v.id) {
      obj[k] = obj[v.id];
      delete obj[v.id];
    }
  }

  return extractProps(obj, keepKeys);
};

export default class IntegrationStore {
  id?: string;
  fk_integration_id?: string;
  type?: string;
  fk_workspace_id?: string;
  fk_user_id?: string;

  // TODO look for a way to define this dynamically
  [key: string]: any;

  constructor(data: Partial<IntegrationStore>) {
    Object.assign(this, data);
  }

  protected static castType(data: IntegrationStore): IntegrationStore {
    return data && new IntegrationStore(data);
  }

  public static async insert(
    context: Omit<NcContext, 'base_id'>,
    integration: IntegrationType,
    fk_user_id: string | null,
    data: IntegrationStore,
    ncMeta = Noco.ncMeta,
  ) {
    const storeDefinition = STORE_DEFINITIONS[integration.type];

    if (!storeDefinition) {
      NcError.badRequest('Invalid integration type');
    }

    const storeKeys = Object.keys(storeDefinition);

    const insertObj = extractProps(data, [...storeKeys]);

    if (isEE && !context.workspace_id) {
      NcError.badRequest('Missing required fields');
    }

    insertObj.fk_workspace_id = context.workspace_id;
    insertObj.fk_user_id = fk_user_id;
    insertObj.fk_integration_id = integration.id;
    insertObj.type = integration.type;
    insertObj.sub_type = integration.sub_type;

    for (const [k, v] of Object.entries(storeDefinition)) {
      if (v.required && !insertObj[k]) {
        NcError.badRequest(`Missing required field: ${v.id}`);
      }

      if (
        insertObj[k] &&
        v.type === IntegrationSlotTypes.NUMBER &&
        isNaN(Number(insertObj[k]))
      ) {
        NcError.badRequest(`Invalid type for field: ${v.id}`);
      }

      if (v.type === IntegrationSlotTypes.BOOLEAN) {
        insertObj[k] = !!insertObj[k];
      }

      if (insertObj[k] && v.type === IntegrationSlotTypes.ARRAY) {
        if (insertObj[k] && typeof insertObj[k] === 'string') {
          try {
            insertObj[k] = JSON.parse(insertObj[k]);
          } catch (e) {
            NcError.badRequest(`Invalid type for field: ${v.id}`);
          }
        }

        if (!Array.isArray(insertObj[k])) {
          NcError.badRequest(`Invalid type for field: ${v.id}`);
        }

        insertObj[k] = JSON.stringify(insertObj[k]);
      }

      if (insertObj[k] && v.type === IntegrationSlotTypes.OBJECT) {
        if (insertObj[k] && typeof insertObj[k] === 'string') {
          try {
            insertObj[k] = JSON.parse(insertObj[k]);
          } catch (e) {
            NcError.badRequest(`Invalid type for field: ${v.id}`);
          }
        }

        if (typeof insertObj[k] !== 'object') {
          NcError.badRequest(`Invalid type for field: ${v.id}`);
        }

        insertObj[k] = JSON.stringify(insertObj[k]);
      }

      if (
        insertObj[k] &&
        v.type === IntegrationSlotTypes.STRING &&
        typeof insertObj[k] !== 'string'
      ) {
        NcError.badRequest(`Invalid type for field: ${v.id}`);
      }

      if (k !== v.id) {
        insertObj[v.id] = insertObj[k];
        delete insertObj[k];
      }
    }

    const { id } = await ncMeta.metaInsert2(
      insertObj.fk_workspace_id
        ? insertObj.fk_workspace_id
        : RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS_STORE,
      insertObj,
    );

    return await this.get(
      {
        workspace_id: insertObj.fk_workspace_id,
      },
      id,
      ncMeta,
    );
  }

  static async get(
    context: Omit<NcContext, 'base_id'>,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<IntegrationStore> {
    const integrationStoreData = await ncMeta.metaGet2(
      context.workspace_id ? context.workspace_id : RootScopes.WORKSPACE,
      context.workspace_id === RootScopes.BYPASS
        ? RootScopes.BYPASS
        : RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS_STORE,
      !context.workspace_id || context.workspace_id === RootScopes.BYPASS
        ? id
        : { id, fk_workspace_id: context.workspace_id },
      null,
    );

    const storeDefinition = STORE_DEFINITIONS[integrationStoreData.type];

    if (!storeDefinition) {
      NcError.badRequest('Invalid integration type');
    }

    const data = prepareResponse(integrationStoreData, storeDefinition);

    return this.castType(data);
  }

  static async list(
    context: Omit<NcContext, 'base_id'>,
    integration: IntegrationType,
    args: {
      limit?: number;
      offset?: number;
      ignorePagination?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<{
    list: IntegrationStore[];
    pagination: { isLastPage: boolean; offset: number };
  }> {
    let integrationStoreData = await ncMeta.metaList2(
      context.workspace_id ? context.workspace_id : RootScopes.WORKSPACE,
      context.workspace_id === RootScopes.BYPASS
        ? RootScopes.BYPASS
        : RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS_STORE,
      {
        condition: { fk_integration_id: integration.id },
        ...(args.ignorePagination
          ? {}
          : { limit: (args.limit || 25) + 1, offset: args.offset || 0 }),
      },
    );

    const pagination = args.ignorePagination
      ? {
          isLastPage: true,
          offset: 0,
        }
      : {
          isLastPage: integrationStoreData.length <= (args.limit || 25),
          offset: args.offset || 0,
        };

    if (!args.ignorePagination) {
      integrationStoreData = integrationStoreData.slice(0, args.limit || 25);
    }

    const list = integrationStoreData.map((d: any) => {
      const storeDefinition = STORE_DEFINITIONS[d.type];

      if (!storeDefinition) {
        NcError.badRequest('Invalid integration type');
      }

      const data = prepareResponse(d, storeDefinition);

      return this.castType(data);
    });

    return {
      list,
      pagination,
    };
  }

  static async sum(
    context: Omit<NcContext, 'base_id'>,
    integration: IntegrationType,
    fields: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<Record<string, number>> {
    const storeDefinition = STORE_DEFINITIONS[integration.type];

    if (!storeDefinition) {
      NcError.badRequest('Invalid integration type');
    }

    for (const field of fields) {
      if (!storeDefinition[field]) {
        NcError.badRequest('Invalid field');
      }

      if (storeDefinition[field].type !== IntegrationSlotTypes.NUMBER) {
        NcError.badRequest(
          'This operation is only supported for number fields',
        );
      }
    }

    const qb = ncMeta.knexConnection(MetaTable.INTEGRATIONS_STORE);

    for (const field of fields) {
      const storeField = storeDefinition[field];
      qb.sum(storeField.id, { as: field });
    }

    qb.where({
      fk_integration_id: integration.id,
      ...(context.workspace_id === RootScopes.BYPASS
        ? {}
        : { fk_workspace_id: context.workspace_id }),
    });

    return await qb.first();
  }

  static async getLatest(
    context: Omit<NcContext, 'base_id'>,
    integration: IntegrationType,
    ncMeta = Noco.ncMeta,
  ): Promise<IntegrationStore> {
    const storeDefinition = STORE_DEFINITIONS[integration.type];

    if (!storeDefinition) {
      NcError.badRequest('Invalid integration type');
    }

    const result = await ncMeta
      .knexConnection(MetaTable.INTEGRATIONS_STORE)
      .select('*')
      .where({
        fk_integration_id: integration.id,
        ...(context.workspace_id === RootScopes.BYPASS
          ? {}
          : { fk_workspace_id: context.workspace_id }),
      })
      .orderBy('created_at', 'desc')
      .first();

    if (!result) {
      return null;
    }

    const data = prepareResponse(result, storeDefinition);

    return this.castType(data);
  }
}
