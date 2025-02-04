import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import { Base } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { NC_DATA_REFLECTION_SETTINGS } from '~/helpers/dataReflectionHelpers';

export default class DataReflection {
  id?: string;
  fk_workspace_id?: string;
  username?: string;
  password?: string;
  database?: string;

  // common variables
  host?: string;
  port?: number;

  constructor(dataReflection: Partial<DataReflection>) {
    Object.assign(this, dataReflection);
  }

  public static async init() {}

  protected static async insert(
    dataReflection: Partial<DataReflection>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertData = extractProps(dataReflection, [
      'fk_workspace_id',
      'username',
      'password',
      'database',
    ]);

    const insertedDataReflection = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.DATA_REFLECTION,
      insertData,
    );

    return this.get({ id: insertedDataReflection.id });
  }

  public static async get(
    params: {
      id?: string;
      fk_workspace_id?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const condition = extractProps(params, ['id', 'fk_workspace_id']);

    if (!condition.id && !condition.fk_workspace_id) {
      throw NcError.badRequest('id or fk_workspace_id is required');
    }

    let dataReflection = condition.id
      ? await NocoCache.get(
          `${CacheScope.DATA_REFLECTION}:${condition.id}`,
          CacheGetType.TYPE_OBJECT,
        )
      : condition.fk_workspace_id
      ? await NocoCache.get(
          `${CacheScope.DATA_REFLECTION}:${condition.fk_workspace_id}`,
          CacheGetType.TYPE_OBJECT,
        )
      : null;
    if (!dataReflection) {
      dataReflection = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.DATA_REFLECTION,
        condition,
      );

      if (!dataReflection) {
        return null;
      }

      dataReflection.host = NC_DATA_REFLECTION_SETTINGS.host;
      dataReflection.port = NC_DATA_REFLECTION_SETTINGS.port;

      if (dataReflection) {
        await NocoCache.set(
          `${CacheScope.DATA_REFLECTION}:${dataReflection.id}`,
          dataReflection,
        );

        await NocoCache.set(
          `${CacheScope.DATA_REFLECTION}:${dataReflection.fk_workspace_id}`,
          dataReflection,
        );
      }
    }

    return new DataReflection(dataReflection);
  }

  protected static async delete(
    params: {
      id?: string;
      fk_workspace_id?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const condition = extractProps(params, ['id', 'fk_workspace_id']);

    if (!condition.id && !condition.fk_workspace_id) {
      throw NcError.badRequest('id or fk_workspace_id is required');
    }

    const dataReflection = await this.get(condition, ncMeta);

    if (!dataReflection) {
      return;
    }

    await NocoCache.del(`${CacheScope.DATA_REFLECTION}:${dataReflection.id}`);
    await NocoCache.del(
      `${CacheScope.DATA_REFLECTION}:${dataReflection.fk_workspace_id}`,
    );

    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.DATA_REFLECTION,
      condition,
    );
  }

  public static async availableSchemas(
    fk_workspace_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const data = await Base.list(fk_workspace_id, ncMeta);

    return data.map((base) => base.id);
  }

  public static async create(
    fk_workspace_id: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<DataReflection> {
    throw NcError.notImplemented('Data Reflection');
  }

  public static async destroy(
    fk_workspace_id: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<void> {
    return;
  }

  public static async grantBase(
    fk_workspace_id: string,
    base_id: string,
    _ncMeta = Noco.ncMeta,
  ) {
    return;
  }

  public static async revokeBase(
    fk_workspace_id: string,
    base_id: string,
    _ncMeta = Noco.ncMeta,
  ) {
    return;
  }
}
