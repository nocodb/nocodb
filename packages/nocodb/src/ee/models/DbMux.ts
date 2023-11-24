import AWS from 'aws-sdk';
import axios from 'axios';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  DbMuxStatus,
  MetaTable,
} from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import NocoCache from '~/cache/NocoCache';
import { Source } from '~/models';

const NC_MUX_SEAT_THRESHOLD = +process.env.NC_MUX_SEAT_THRESHOLD || 2;

export default class DbMux {
  id?: string;
  domain?: string;
  status?: string;
  priority?: number;
  capacity?: number;
  sourceCount?: number;

  constructor(DbMux: DbMux) {
    Object.assign(this, DbMux);
  }

  public static async list(ncMeta = Noco.ncMeta) {
    const cachedList = await NocoCache.getList(CacheScope.DB_MUX, []);
    let { list: dbMuxList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !dbMuxList.length) {
      dbMuxList = await ncMeta.metaList2(null, null, MetaTable.DB_MUX);

      for (const dbMux of dbMuxList) {
        dbMux.sourceCount = await this.sourceCount(dbMux.id, ncMeta);
      }

      await NocoCache.setList(CacheScope.DB_MUX, [], dbMuxList);
    }

    dbMuxList.sort(
      (a, b) => (a?.priority ?? Infinity) - (b?.priority ?? Infinity),
    );

    return dbMuxList.map((dbMux) => dbMux && new DbMux(dbMux));
  }

  public static async get(dbMuxId: string, ncMeta = Noco.ncMeta) {
    let dbMuxData = await NocoCache.get(
      `${CacheScope.DB_MUX}:${dbMuxId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!dbMuxData) {
      dbMuxData = await ncMeta.metaGet2(null, null, MetaTable.DB_MUX, {
        id: dbMuxId,
      });

      if (dbMuxData) {
        dbMuxData.sourceCount = await this.sourceCount(dbMuxId, ncMeta);

        await NocoCache.set(`${CacheScope.DB_MUX}:${dbMuxData.id}`, dbMuxData);
      }
    }

    return dbMuxData && new DbMux(dbMuxData);
  }

  public static async insert(DbMux: Partial<DbMux>, ncMeta = Noco.ncMeta) {
    const NC_MUX_MAX_DB_COUNT = +process.env.NC_MUX_MAX_DB_COUNT || 25;

    // extract props which is allowed to be inserted
    const insertObject = extractProps(DbMux, [
      'domain',
      'status',
      'priority',
      'capacity',
    ]);

    if (!insertObject.domain) {
      NcError.badRequest('Domain is required');
    }

    if (!insertObject.status) {
      insertObject.status = DbMuxStatus.INACTIVE;
    }

    if (!insertObject.priority) {
      const dbMuxs = await this.list(ncMeta);
      insertObject.priority = (dbMuxs.length + 1) * 10;
    }

    if (!insertObject.capacity) {
      insertObject.capacity = NC_MUX_MAX_DB_COUNT;
    }

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.DB_MUX,
      insertObject,
    );

    const dbMux = await this.get(id);

    await NocoCache.appendToList(
      CacheScope.DB_MUX,
      [],
      `${CacheScope.DB_MUX}:${id}`,
    );

    return dbMux;
  }

  public static async bulkUpdate(dbMux: Partial<DbMux>, ncMeta = Noco.ncMeta) {
    const updateObject = extractProps(dbMux, ['capacity']);

    if (Object.keys(updateObject).length === 0) {
      NcError.badRequest('Nothing to update');
    }

    await ncMeta.metaUpdate(null, null, MetaTable.DB_MUX, updateObject);

    await NocoCache.deepDel(
      CacheScope.DB_MUX,
      `${CacheScope.DB_MUX}:list`,
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
    dbMux: Partial<DbMux>,
    ncMeta = Noco.ncMeta,
  ): Promise<{ se: DbMux; sources: Source[] }> {
    const updateObject = extractProps(dbMux, [
      'domain',
      'status',
      'priority',
      'capacity',
    ]);

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.DB_MUX,
      updateObject,
      this.id,
    );

    await NocoCache.del(`${CacheScope.DB_MUX}:${this.id}`);

    let sources: Source[] = [];

    if (updateObject.status === DbMuxStatus.INACTIVE) {
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
      se: await DbMux.get(this.id, ncMeta),
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

    await NocoCache.del(`${CacheScope.DB_MUX}:${this.id}`);

    await NocoCache.deepDel(
      CacheScope.DB_MUX,
      `${CacheScope.DB_MUX}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return await ncMeta.metaDelete(null, null, MetaTable.DB_MUX, this.id);
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

    await NocoCache.del(`${CacheScope.DB_MUX}:${this.id}`);

    return DbMux.get(this.id, ncMeta);
  }

  public static async bindToSuitableDbMux(
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const source = await Source.get(sourceId, false, ncMeta);

    if (!source) NcError.notFound('Source not found');

    let dbMuxs = await this.list(ncMeta);

    let suitableDbMux: DbMux;

    if (!dbMuxs.length) {
      if (process.env.TEST === 'true') {
        suitableDbMux = await this.insert({
          domain: `http://localhost:9000`,
          status: DbMuxStatus.ACTIVE,
        });
      } else {
        NcError.badRequest('There is no DB Mux available');
      }
    } else {
      if (process.env.TEST === 'true') {
        suitableDbMux = dbMuxs[0];
        if (suitableDbMux.domain !== 'http://localhost:9000') {
          suitableDbMux = (
            await suitableDbMux.update({
              domain: 'http://localhost:9000',
              status: DbMuxStatus.ACTIVE,
            })
          ).se;
        }
      } else {
        for (const dbMux of dbMuxs) {
          if (dbMux.sourceCount < dbMux.capacity) {
            suitableDbMux = dbMux;
            break;
          }
        }
      }
    }

    if (!suitableDbMux) {
      NcError.badRequest('There is no DB Mux available');
    }

    await suitableDbMux.bindSource(source.id, ncMeta);

    // check if db mux is active
    if (suitableDbMux.status === DbMuxStatus.INACTIVE) {
      const res = await axios.get(`${suitableDbMux.domain}/api/v1/health`);
      if (res.status === 200) {
        await suitableDbMux.update({
          status: DbMuxStatus.ACTIVE,
        });

        dbMuxs = await this.list(ncMeta);
      }
    }

    // check if we need to activate another db mux
    const availableSeatCount = this.availableSeatCount(dbMuxs) - 1;

    if (availableSeatCount <= NC_MUX_SEAT_THRESHOLD) {
      await this.activateFirstInactive(dbMuxs);
    }

    return suitableDbMux;
  }

  public static async sourceCount(dbMuxId: string, ncMeta = Noco.ncMeta) {
    if (!dbMuxId) NcError.badRequest('DbMux id is required');

    return (
      ncMeta.metaCount(null, null, MetaTable.BASES, {
        condition: {
          fk_sql_executor_id: dbMuxId,
        },
      }) || 0
    );
  }

  private static availableSeatCount(dbMuxs: DbMux[]) {
    let count = 0;

    for (const dbMux of dbMuxs) {
      if (dbMux.status === DbMuxStatus.INACTIVE) continue;
      count += dbMux.capacity - dbMux.sourceCount;
    }

    return count;
  }

  private static async activate(dbMux: DbMux) {
    if (process.env.TEST === 'true') return;

    const appConfig = (await import('~/app.config')).default;

    const snsConfig = appConfig.sns;
    const dbMuxSnsTopic = appConfig.dbMux.sns.topicArn;

    if (
      !dbMuxSnsTopic ||
      !snsConfig.credentials ||
      !snsConfig.credentials.secretAccessKey ||
      !snsConfig.credentials.accessKeyId
    ) {
      console.error('SNS is not configured');
      NcError.notImplemented('Not available');
    }

    if (!dbMux) NcError.notFound('DbMux not found');

    const serviceName = dbMux.domain.replace(/https?:\/\//, '');

    // Create publish parameters
    const params = {
      Message: JSON.stringify({
        operation: 'activate',
        serviceName,
        dbMuxId: dbMux.id,
      }) /* required */,
      TopicArn: dbMuxSnsTopic,
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

    await dbMux.update({
      status: DbMuxStatus.DEPLOYING,
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
      NcError.internalServerError('Error while activating DB Mux');
    }
  }

  static async activateFirstInactive(dbMuxs: DbMux[]) {
    const firstInactiveDbMux = dbMuxs.find(
      (dbMux) => dbMux.status === DbMuxStatus.INACTIVE,
    );

    if (!firstInactiveDbMux) return;

    await this.activate(firstInactiveDbMux);
  }
}
