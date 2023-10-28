import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import NocoCache from '~/cache/NocoCache';
import { Source } from '~/models';

export default class SqlExecutor {
  id?: string;
  domain?: string;
  status?: string;
  sourceCount?: number;

  constructor(SqlExecutor: SqlExecutor) {
    Object.assign(this, SqlExecutor);
  }

  public static async list(ncMeta = Noco.ncMeta) {
    const cachedList = await NocoCache.getList(CacheScope.SQL_EXECUTOR, []);
    let { list: sqlExecutorList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !sqlExecutorList.length) {
      sqlExecutorList = await ncMeta.metaList2(
        null,
        null,
        MetaTable.SQL_EXECUTOR,
        {
          orderBy: {
            domain: 'asc',
          },
        },
      );

      for (const sqlExecutor of sqlExecutorList) {
        sqlExecutor.sourceCount = await this.sourceCount(
          sqlExecutor.id,
          ncMeta,
        );
      }

      await NocoCache.setList(CacheScope.PROJECT, [], sqlExecutorList);
    }

    return sqlExecutorList;
  }

  public static async get(SqlExecutorId: string, ncMeta = Noco.ncMeta) {
    let SqlExecutorData = await NocoCache.get(
      `${CacheScope.SQL_EXECUTOR}:${SqlExecutorId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!SqlExecutorData) {
      SqlExecutorData = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.SQL_EXECUTOR,
        {
          id: SqlExecutorId,
        },
      );

      SqlExecutorData.sourceCount = await this.sourceCount(
        SqlExecutorId,
        ncMeta,
      );

      if (SqlExecutorData) {
        await NocoCache.set(
          `${CacheScope.SQL_EXECUTOR}:${SqlExecutorData.id}`,
          SqlExecutorData,
        );
      }
    }

    return SqlExecutorData && new SqlExecutor(SqlExecutorData);
  }

  public static async insert(
    SqlExecutor: Partial<SqlExecutor>,
    ncMeta = Noco.ncMeta,
  ) {
    // extract props which is allowed to be inserted
    const insertObject = extractProps(SqlExecutor, ['domain', 'status']);

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.SQL_EXECUTOR,
      insertObject,
    );

    const sqlExecutor = await this.get(id);

    await NocoCache.appendToList(
      CacheScope.SQL_EXECUTOR,
      [],
      `${CacheScope.SQL_EXECUTOR}:${id}`,
    );

    return sqlExecutor;
  }

  public static async update(
    SqlExecutorId: string,
    SqlExecutor: Partial<SqlExecutor>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!SqlExecutorId) NcError.badRequest('SqlExecutor id is required');

    await NocoCache.del(`${CacheScope.SQL_EXECUTOR}:${SqlExecutorId}`);

    const updateObject = extractProps(SqlExecutor, ['domain', 'status']);

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.SQL_EXECUTOR,
      updateObject,
      SqlExecutorId,
    );

    const sqlExecutor = await this.get(SqlExecutorId);

    return sqlExecutor;
  }

  public static async delete(id: string, ncMeta = Noco.ncMeta) {
    if (!id) NcError.badRequest('SqlExecutor id is required');

    const SqlExecutor = await this.get(id, ncMeta);

    if (!SqlExecutor) NcError.notFound('SqlExecutor not found');

    await NocoCache.del(`${CacheScope.SQL_EXECUTOR}:${id}`);

    await NocoCache.deepDel(
      CacheScope.SQL_EXECUTOR,
      `${CacheScope.SQL_EXECUTOR}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return await ncMeta.metaDelete(null, null, MetaTable.SQL_EXECUTOR, id);
  }

  public static async bindSource(
    SqlExecutorId: string,
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    if (!SqlExecutorId) NcError.badRequest('SqlExecutor id is required');
    if (!sourceId) NcError.badRequest('Source id is required');

    const SqlExecutor = await this.get(SqlExecutorId, ncMeta);

    if (!SqlExecutor) NcError.notFound('SqlExecutor not found');

    const source = await Source.get(sourceId, false, ncMeta);

    if (!source) NcError.notFound('Source not found');

    await Source.updateBase(
      sourceId,
      {
        fk_sql_executor_id: SqlExecutor.id,
      } as any,
      ncMeta,
    );

    await NocoCache.del(`${CacheScope.SQL_EXECUTOR}:${SqlExecutor.id}`);

    return this.get(SqlExecutorId);
  }

  public static async unbindSource(
    SqlExecutorId: string,
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    if (!SqlExecutorId) NcError.badRequest('SqlExecutor id is required');
    if (!sourceId) NcError.badRequest('Source id is required');

    const SqlExecutor = await this.get(SqlExecutorId, ncMeta);

    if (!SqlExecutor) NcError.notFound('SqlExecutor not found');

    const source = await Source.get(sourceId, false, ncMeta);

    if (!source) NcError.notFound('Source not found');

    await Source.updateBase(
      sourceId,
      {
        fk_sql_executor_id: null,
      } as any,
      ncMeta,
    );

    await NocoCache.del(`${CacheScope.SQL_EXECUTOR}:${SqlExecutor.id}`);

    return this.get(SqlExecutorId);
  }

  public static async bindToSuitableSqlExecutor(
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const NC_SQL_EXECUTOR_MAX_DB_COUNT =
      +process.env.NC_SQL_EXECUTOR_MAX_DB_COUNT || 10;

    const source = await Source.get(sourceId, false, ncMeta);

    if (!source) NcError.notFound('Source not found');

    const sqlExecutors = await this.list(ncMeta);

    let suitableSqlExecutor: SqlExecutor;

    if (!sqlExecutors.length) {
      if (process.env.TEST === 'true') {
        suitableSqlExecutor = await this.insert({
          domain: `http://localhost:9000`,
          status: 'active',
        });
      } else {
        NcError.badRequest('There is no SQL Executor available');
      }
      // suitableSqlExecutor = await this.createNextSqlExecutor(ncMeta);
    } else {
      if (process.env.TEST === 'true') {
        suitableSqlExecutor = sqlExecutors[0];
        if (suitableSqlExecutor.domain !== 'http://localhost:9000') {
          suitableSqlExecutor = await this.update(suitableSqlExecutor.id, {
            domain: 'http://localhost:9000',
            status: 'active',
          });
        }
      } else {
        for (const sqlExecutor of sqlExecutors) {
          if (sqlExecutor.sourceCount < NC_SQL_EXECUTOR_MAX_DB_COUNT) {
            suitableSqlExecutor = sqlExecutor;
            break;
          }
        }
      }
    }

    if (!suitableSqlExecutor) {
      NcError.badRequest('There is no SQL Executor available');
    }

    await this.bindSource(suitableSqlExecutor.id, source.id, ncMeta);

    return suitableSqlExecutor;
  }

  /*
  public static async createNextSqlExecutor(ncMeta = Noco.ncMeta) {
    const count = +(await ncMeta.metaCount(null, null, MetaTable.SQL_EXECUTOR));

    const sqlExecutor = await this.insert({
      domain: `http://staging-se-${(count + 1).toString().padStart(5, '0')}`,
      status: 'inactive',
    });

    // TODO - create sql executor instance

    return sqlExecutor;
  }
  */

  public static async sourceCount(sqlExecutorId: string, ncMeta = Noco.ncMeta) {
    if (!sqlExecutorId) NcError.badRequest('SqlExecutor id is required');

    return (
      ncMeta.metaCount(null, null, MetaTable.BASES, {
        condition: {
          fk_sql_executor_id: sqlExecutorId,
        },
      }) || 0
    );
  }
}
