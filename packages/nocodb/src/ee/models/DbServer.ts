import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';
import { decryptPropIfRequired } from '~/utils/encryptDecrypt';

export default class DbServer {
  id?: string;
  title?: string;
  is_shared?: boolean;
  max_tenant_count?: number;
  current_tenant_count?: number;
  config?: Record<string, any>;
  conditions?: string | Record<string, any>;
  created_at?: string;
  updated_at?: string;

  constructor(dbServer: Partial<DbServer>) {
    Object.assign(this, dbServer);
  }

  public static async get(dbServerId: string, ncMeta = Noco.ncMeta) {
    const key = `${CacheScope.DB_SERVERS}:${dbServerId}`;
    let dbServer = await NocoCache.get('root', key, CacheGetType.TYPE_OBJECT);

    if (!dbServer) {
      dbServer = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.DB_SERVERS,
        {
          id: dbServerId,
        },
      );

      if (!dbServer) return null;

      dbServer = prepareForResponse(dbServer, ['conditions']);
      await NocoCache.set('root', key, dbServer);
    }

    return new DbServer(dbServer);
  }

  public static async getWithConfig(dbServerId: string, ncMeta = Noco.ncMeta) {
    const dbServer = await this.get(dbServerId, ncMeta);
    if (!dbServer) return null;
    dbServer.config = decryptPropIfRequired({ data: dbServer });
    return dbServer;
  }

  public static async insert(
    dbServer: Partial<DbServer>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj: Record<string, any> = extractProps(dbServer, [
      'id',
      'title',
      'is_shared',
      'max_tenant_count',
      'current_tenant_count',
      'config',
      'conditions',
    ]);

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.DB_SERVERS,
      prepareForDb(insertObj, ['config', 'conditions']),
    );

    const dbServerResult = await this.get(id, ncMeta);

    // Append to list cache instead of clearing all
    await NocoCache.appendToList(
      'root',
      CacheScope.DB_SERVERS,
      [],
      `${CacheScope.DB_SERVERS}:${id}`,
    );

    return dbServerResult;
  }

  public static async update(
    dbServerId: string,
    dbServer: Partial<DbServer>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(dbServer, [
      'title',
      'is_shared',
      'max_tenant_count',
      'current_tenant_count',
      'conditions',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.DB_SERVERS,
      prepareForDb(updateObj, ['conditions']),
      dbServerId,
    );

    const key = `${CacheScope.DB_SERVERS}:${dbServerId}`;
    await NocoCache.update(
      'root',
      key,
      prepareForResponse(updateObj, ['conditions']),
    );

    return true;
  }

  public static async delete(dbServerId: string, ncMeta = Noco.ncMeta) {
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.DB_SERVERS,
      dbServerId,
    );

    await NocoCache.deepDel(
      'root',
      `${CacheScope.DB_SERVERS}:${dbServerId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return true;
  }

  public static async list(_param: any = {}, ncMeta = Noco.ncMeta) {
    const cachedList = await NocoCache.getList(
      'root',
      CacheScope.DB_SERVERS,
      [],
    );
    let { list: dbServers } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !dbServers.length) {
      dbServers = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.DB_SERVERS,
        {},
      );

      dbServers = dbServers.map((dbServer) => {
        return new DbServer(prepareForResponse(dbServer, ['conditions']));
      });

      await NocoCache.setList('root', CacheScope.DB_SERVERS, [], dbServers);
    }

    return dbServers;
  }

  public static async incrementTenantCount(
    dbServerId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.DB_SERVERS,
      {
        current_tenant_count: ncMeta.knexConnection.raw(
          'current_tenant_count + 1',
        ),
      },
      dbServerId,
    );

    const key = `${CacheScope.DB_SERVERS}:${dbServerId}`;
    await NocoCache.del('root', key);

    return this.get(dbServerId, ncMeta);
  }

  public static async decrementTenantCount(
    dbServerId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.DB_SERVERS,
      {
        current_tenant_count: ncMeta.knexConnection.raw(
          'GREATEST(current_tenant_count - 1, 0)',
        ),
      },
      dbServerId,
    );

    const key = `${CacheScope.DB_SERVERS}:${dbServerId}`;
    await NocoCache.del('root', key);

    return this.get(dbServerId, ncMeta);
  }
}
