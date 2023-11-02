import AWS from 'aws-sdk';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
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
    const NC_SQL_EXECUTOR_MAX_DB_COUNT =
      +process.env.NC_SQL_EXECUTOR_MAX_DB_COUNT || 10;

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

  public static async update(
    SqlExecutorId: string,
    SqlExecutor: Partial<SqlExecutor>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!SqlExecutorId) NcError.badRequest('SqlExecutor id is required');

    await NocoCache.del(`${CacheScope.SQL_EXECUTOR}:${SqlExecutorId}`);

    const updateObject = extractProps(SqlExecutor, [
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
      SqlExecutorId,
    );

    const sqlExecutor = await this.get(SqlExecutorId);

    return sqlExecutor;
  }

  public static async delete(id: string, ncMeta = Noco.ncMeta) {
    if (!id) NcError.badRequest('SqlExecutor id is required');

    const SqlExecutor = await this.get(id, ncMeta);

    if (!SqlExecutor) NcError.notFound('SqlExecutor not found');

    // unbind all sources
    const sources = await ncMeta.metaList2(null, null, MetaTable.BASES, {
      condition: {
        fk_sql_executor_id: id,
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
        baseId: source.base_id,
        fk_sql_executor_id: SqlExecutor.id,
      },
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
        baseId: source.base_id,
        fk_sql_executor_id: null,
      },
      ncMeta,
    );

    await NocoCache.del(`${CacheScope.SQL_EXECUTOR}:${SqlExecutor.id}`);

    return this.get(SqlExecutorId);
  }

  public static async bindToSuitableSqlExecutor(
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const source = await Source.get(sourceId, false, ncMeta);

    if (!source) NcError.notFound('Source not found');

    const sqlExecutors = await this.list(ncMeta);

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
          suitableSqlExecutor = await this.update(suitableSqlExecutor.id, {
            domain: 'http://localhost:9000',
            status: SqlExecutorStatus.ACTIVE,
          });
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

    await this.bindSource(suitableSqlExecutor.id, source.id, ncMeta);

    this.activateIfRequired(ncMeta);

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

  public static async availableSeatCount(ncMeta = Noco.ncMeta) {
    const sqlExecutors = await this.list(ncMeta);

    let count = 0;

    for (const sqlExecutor of sqlExecutors) {
      if (sqlExecutor.status === SqlExecutorStatus.INACTIVE) continue;
      count += sqlExecutor.capacity - sqlExecutor.sourceCount;
    }

    return count;
  }

  static async activate(param: { sqlExecutorId: string }) {
    const appConfig = (await import('~/app.config')).default;

    const snsConfig = appConfig.workspace.sns;

    if (
      !snsConfig.topicArn ||
      !snsConfig.credentials ||
      !snsConfig.credentials.secretAccessKey ||
      !snsConfig.credentials.accessKeyId
    ) {
      console.error('SNS is not configured');
      NcError.notImplemented('Not available');
    }

    const sqlExecutor = await this.get(param.sqlExecutorId);

    if (!sqlExecutor) NcError.notFound('SqlExecutor not found');

    const serviceName = sqlExecutor.domain.replace(/https?:\/\//, '');

    // Create publish parameters
    const params = {
      Message: JSON.stringify({
        operation: 'activate',
        serviceName,
        sqlExecutorId: sqlExecutor.id,
      }) /* required */,
      // TODO - get topic arn from config
      TopicArn:
        'arn:aws:sns:us-east-2:249717198246:nocohub-es-operator-staging',
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

  static async activateIfRequired(ncMeta = Noco.ncMeta) {
    if (process.env.TEST === 'true') return;

    const availableSeatCount = await this.availableSeatCount(ncMeta);

    if (availableSeatCount > SE_SEAT_THRESHOLD_TO_TRIGGER_ACTIVATE) {
      return;
    }

    const sqlExecutors = await this.list(ncMeta);

    const firstInactiveSqlExecutor = sqlExecutors.find(
      (sqlExecutor) => sqlExecutor.status === SqlExecutorStatus.INACTIVE,
    );

    if (!firstInactiveSqlExecutor) return;

    await this.update(firstInactiveSqlExecutor.id, {
      status: SqlExecutorStatus.DEPLOYING,
    });

    await this.activate({ sqlExecutorId: firstInactiveSqlExecutor.id });
  }
}
