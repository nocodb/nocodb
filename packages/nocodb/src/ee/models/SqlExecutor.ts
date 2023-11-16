import AWS from 'aws-sdk';
import axios from 'axios';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  SqlExecutorStatus,
} from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import NocoCache from '~/cache/NocoCache';
import { Source } from '~/models';

const SE_SEAT_THRESHOLD_TO_TRIGGER_ACTIVATE =
  +process.env.SE_SEAT_THRESHOLD_TO_TRIGGER_ACTIVATE || 2;

export default class SqlExecutor {
  id?: string;
  domain?: string;
  status?: string;
  priority?: number;
  capacity?: number;
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
      );

      for (const sqlExecutor of sqlExecutorList) {
        sqlExecutor.sourceCount = await this.sourceCount(
          sqlExecutor.id,
          ncMeta,
        );
      }

      await NocoCache.setList(CacheScope.SQL_EXECUTOR, [], sqlExecutorList);
    }

    sqlExecutorList.sort((a, b) => a.priority - b.priority);

    return sqlExecutorList.map(
      (sqlExecutor) => sqlExecutor && new SqlExecutor(sqlExecutor),
    );
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

      if (SqlExecutorData) {
        SqlExecutorData.sourceCount = await this.sourceCount(
          SqlExecutorId,
          ncMeta,
        );

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
    const NC_SQL_EXECUTOR_MAX_DB_COUNT =
      +process.env.NC_SQL_EXECUTOR_MAX_DB_COUNT || 25;

    // extract props which is allowed to be inserted
    const insertObject = extractProps(SqlExecutor, [
      'domain',
      'status',
      'priority',
      'capacity',
    ]);

    if (!insertObject.domain) {
      NcError.badRequest('Domain is required');
    }

    if (!insertObject.status) {
      insertObject.status = SqlExecutorStatus.INACTIVE;
    }

    if (!insertObject.priority) {
      const sqlExecutors = await this.list(ncMeta);
      insertObject.priority = (sqlExecutors.length + 1) * 10;
    }

    if (!insertObject.capacity) {
      insertObject.capacity = NC_SQL_EXECUTOR_MAX_DB_COUNT;
    }

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

  public static async bulkUpdate(
    sqlExecutor: Partial<SqlExecutor>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObject = extractProps(sqlExecutor, ['capacity']);

    if (Object.keys(updateObject).length === 0) {
      NcError.badRequest('Nothing to update');
    }

    await ncMeta.metaUpdate(null, null, MetaTable.SQL_EXECUTOR, updateObject);

    await NocoCache.deepDel(
      CacheScope.SQL_EXECUTOR,
      `${CacheScope.SQL_EXECUTOR}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    return this.list(ncMeta);
  }

  public async getSources(ncMeta = Noco.ncMeta) {
    return await ncMeta.metaList2(null, null, MetaTable.BASES, {
      condition: {
        fk_sql_executor_id: this.id,
      },
    });
  }

  public async update(
    sqlExecutor: Partial<SqlExecutor>,
    ncMeta = Noco.ncMeta,
  ): Promise<{ se: SqlExecutor; sources: Source[] }> {
    const updateObject = extractProps(sqlExecutor, [
      'domain',
      'status',
      'priority',
      'capacity',
    ]);

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.SQL_EXECUTOR,
      updateObject,
      this.id,
    );

    await NocoCache.del(`${CacheScope.SQL_EXECUTOR}:${this.id}`);

    let sources: Source[] = [];

    if (updateObject.status === SqlExecutorStatus.INACTIVE) {
      sources = await this.getSources(ncMeta);

      await Promise.all([
        ...sources.map((source) =>
          Source.updateBase(
            source.id,
            {
              baseId: source.base_id,
              fk_sql_executor_id: null,
            },
            ncMeta,
          ),
        ),
        // Delete all connections for this SE on this instance
        ...sources.map((source) => NcConnectionMgrv2.deleteAwait(source)),
      ]);
    }

    // We return updated sources so that we can release them from other instances (both worker and primary)
    return {
      se: await SqlExecutor.get(this.id, ncMeta),
      sources: sources,
    };
  }

  public async delete(ncMeta = Noco.ncMeta) {
    // unbind all sources
    const sources = await ncMeta.metaList2(null, null, MetaTable.BASES, {
      condition: {
        fk_sql_executor_id: this.id,
      },
    });

    for (const source of sources) {
      await Source.updateBase(
        source.id,
        {
          baseId: source.base_id,
          fk_sql_executor_id: null,
        },
        ncMeta,
      );
    }

    await NocoCache.del(`${CacheScope.SQL_EXECUTOR}:${this.id}`);

    await NocoCache.deepDel(
      CacheScope.SQL_EXECUTOR,
      `${CacheScope.SQL_EXECUTOR}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return await ncMeta.metaDelete(null, null, MetaTable.SQL_EXECUTOR, this.id);
  }

  public async bindSource(sourceId: string, ncMeta = Noco.ncMeta) {
    if (!sourceId) NcError.badRequest('Source id is required');

    const source = await Source.get(sourceId, false, ncMeta);

    if (!source) NcError.notFound('Source not found');

    await Source.updateBase(
      sourceId,
      {
        baseId: source.base_id,
        fk_sql_executor_id: this.id,
      },
      ncMeta,
    );

    await NocoCache.del(`${CacheScope.SQL_EXECUTOR}:${this.id}`);

    return SqlExecutor.get(this.id, ncMeta);
  }

  public static async bindToSuitableSqlExecutor(
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const source = await Source.get(sourceId, false, ncMeta);

    if (!source) NcError.notFound('Source not found');

    let sqlExecutors = await this.list(ncMeta);

    let suitableSqlExecutor: SqlExecutor;

    if (!sqlExecutors.length) {
      if (process.env.TEST === 'true') {
        suitableSqlExecutor = await this.insert({
          domain: `http://localhost:9000`,
          status: SqlExecutorStatus.ACTIVE,
        });
      } else {
        NcError.badRequest('There is no SQL Executor available');
      }
    } else {
      if (process.env.TEST === 'true') {
        suitableSqlExecutor = sqlExecutors[0];
        if (suitableSqlExecutor.domain !== 'http://localhost:9000') {
          suitableSqlExecutor = (
            await suitableSqlExecutor.update({
              domain: 'http://localhost:9000',
              status: SqlExecutorStatus.ACTIVE,
            })
          ).se;
        }
      } else {
        for (const sqlExecutor of sqlExecutors) {
          if (sqlExecutor.sourceCount < sqlExecutor.capacity) {
            suitableSqlExecutor = sqlExecutor;
            break;
          }
        }
      }
    }

    if (!suitableSqlExecutor) {
      NcError.badRequest('There is no SQL Executor available');
    }

    await suitableSqlExecutor.bindSource(source.id, ncMeta);

    // check if sql executor is active
    if (suitableSqlExecutor.status === SqlExecutorStatus.INACTIVE) {
      const res = await axios.get(
        `${suitableSqlExecutor.domain}/api/v1/health`,
      );
      if (res.status === 200) {
        await suitableSqlExecutor.update({
          status: SqlExecutorStatus.ACTIVE,
        });

        sqlExecutors = await this.list(ncMeta);
      }
    }

    // check if we need to activate another sql executor
    const availableSeatCount = this.availableSeatCount(sqlExecutors) - 1;

    if (availableSeatCount <= SE_SEAT_THRESHOLD_TO_TRIGGER_ACTIVATE) {
      await this.activateFirstInactive(sqlExecutors);
    }

    return suitableSqlExecutor;
  }

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

  private static availableSeatCount(sqlExecutors: SqlExecutor[]) {
    let count = 0;

    for (const sqlExecutor of sqlExecutors) {
      if (sqlExecutor.status === SqlExecutorStatus.INACTIVE) continue;
      count += sqlExecutor.capacity - sqlExecutor.sourceCount;
    }

    return count;
  }

  private static async activate(sqlExecutor: SqlExecutor) {
    if (process.env.TEST === 'true') return;

    const appConfig = (await import('~/app.config')).default;

    const snsConfig = appConfig.sns;
    const sqlExecutorSnsTopic = appConfig.sqlExecutor.sns.topicArn;

    if (
      !sqlExecutorSnsTopic ||
      !snsConfig.credentials ||
      !snsConfig.credentials.secretAccessKey ||
      !snsConfig.credentials.accessKeyId
    ) {
      console.error('SNS is not configured');
      NcError.notImplemented('Not available');
    }

    if (!sqlExecutor) NcError.notFound('SqlExecutor not found');

    const serviceName = sqlExecutor.domain.replace(/https?:\/\//, '');

    // Create publish parameters
    const params = {
      Message: JSON.stringify({
        operation: 'activate',
        serviceName,
        sqlExecutorId: sqlExecutor.id,
      }) /* required */,
      TopicArn: sqlExecutorSnsTopic,
    };

    // Create promise and SNS service object
    const publishTextPromise = new AWS.SNS({
      apiVersion: snsConfig.apiVersion,
      region: snsConfig.region,
      credentials: {
        accessKeyId: snsConfig.credentials.accessKeyId,
        secretAccessKey: snsConfig.credentials.secretAccessKey,
      },
    })
      .publish(params)
      .promise();

    await sqlExecutor.update({
      status: SqlExecutorStatus.DEPLOYING,
    });

    try {
      // Handle promise's fulfilled/rejected states
      const data = await publishTextPromise;
      console.log(
        `Message ${params.Message} sent to the topic ${params.TopicArn}`,
      );
      console.log('MessageID is ' + data.MessageId);
    } catch (err) {
      console.error(err, err.stack);
      NcError.internalServerError('Error while activating SQL Executor');
    }
  }

  static async activateFirstInactive(sqlExecutors: SqlExecutor[]) {
    const firstInactiveSqlExecutor = sqlExecutors.find(
      (sqlExecutor) => sqlExecutor.status === SqlExecutorStatus.INACTIVE,
    );

    if (!firstInactiveSqlExecutor) return;

    await this.activate(firstInactiveSqlExecutor);
  }
}
