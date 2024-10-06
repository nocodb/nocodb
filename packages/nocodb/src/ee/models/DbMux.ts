import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import axios from 'axios';
import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  DbMuxStatus,
  MetaTable,
  RootScopes,
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
      dbMuxList = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.DB_MUX,
      );

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
      dbMuxData = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.DB_MUX,
        {
          id: dbMuxId,
        },
      );

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
      RootScopes.ROOT,
      RootScopes.ROOT,
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

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.DB_MUX,
      updateObject,
      {},
    );

    await NocoCache.deepDel(
      `${CacheScope.DB_MUX}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    return this.list(ncMeta);
  }

  public async getSources(ncMeta = Noco.ncMeta) {
    return await ncMeta.knexConnection(MetaTable.SOURCES).where({
      fk_sql_executor_id: this.id,
    });
  }

  public async update(
    dbMux: Partial<DbMux>,
    ncMeta = Noco.ncMeta,
  ): Promise<DbMux> {
    const updateObj = extractProps(dbMux, [
      'domain',
      'status',
      'priority',
      'capacity',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.DB_MUX,
      updateObj,
      this.id,
    );

    await NocoCache.update(`${CacheScope.DB_MUX}:${this.id}`, updateObj);

    let sources: Source[] = [];

    if (updateObj.status === DbMuxStatus.INACTIVE) {
      sources = await this.getSources(ncMeta);

      await Promise.all([
        ...sources.map((source) =>
          Source.update(
            {
              workspace_id: source.fk_workspace_id,
              base_id: source.base_id,
            },
            source.id,
            {
              fk_sql_executor_id: null,
            },
            ncMeta,
          ),
        ),
        // Delete all connections for this SE on this instance
        ...sources.map((source) => NcConnectionMgrv2.deleteAwait(source)),
      ]);
    }

    return await DbMux.get(this.id, ncMeta);
  }

  public async delete(ncMeta = Noco.ncMeta) {
    // unbind all sources
    const sources = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SOURCES,
      {
        condition: {
          fk_sql_executor_id: this.id,
        },
      },
    );

    for (const source of sources) {
      await Source.update(
        {
          workspace_id: source.fk_workspace_id,
          base_id: source.base_id,
        },
        source.id,
        {
          fk_sql_executor_id: null,
        },
        ncMeta,
      );
    }

    await NocoCache.deepDel(
      `${CacheScope.DB_MUX}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.DB_MUX,
      this.id,
    );
  }

  public async bindSource(
    context: NcContext,
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    if (!sourceId) NcError.badRequest('Source id is required');

    const source = await Source.get(context, sourceId, false, ncMeta);

    if (!source) NcError.sourceNotFound(sourceId);

    await Source.update(
      context,
      sourceId,
      {
        fk_sql_executor_id: this.id,
      },
      ncMeta,
    );

    this.sourceCount = await DbMux.sourceCount(this.id, ncMeta);

    await NocoCache.update(`${CacheScope.DB_MUX}:${this.id}`, {
      sourceCount: this.sourceCount,
    });

    return DbMux.get(this.id, ncMeta);
  }

  public static async bindToSuitableDbMux(
    context: NcContext,
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const source = await Source.get(context, sourceId, false, ncMeta);

    if (!source) NcError.sourceNotFound(sourceId);

    let dbMuxs = await this.list(ncMeta);

    let suitableDbMux: DbMux;

    if (!dbMuxs.length) {
      if (process.env.TEST === 'true') {
        suitableDbMux = await this.insert({
          domain: `http://localhost:9000`,
          status: DbMuxStatus.ACTIVE,
        });
      } else {
        NcError.internalServerError('There is no DB Mux available');
      }
    } else {
      if (process.env.TEST === 'true') {
        suitableDbMux = dbMuxs[0];
        if (suitableDbMux.domain !== 'http://localhost:9000') {
          suitableDbMux = await suitableDbMux.update({
            domain: 'http://localhost:9000',
            status: DbMuxStatus.ACTIVE,
          });
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
      NcError.internalServerError('There is no suitable DB Mux available');
    }

    await suitableDbMux.bindSource(context, source.id, ncMeta);

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
      ncMeta.metaCount(
        RootScopes.BYPASS,
        RootScopes.BYPASS,
        MetaTable.SOURCES,
        {
          condition: {
            fk_sql_executor_id: dbMuxId,
          },
        },
      ) || 0
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
      NcError.internalServerError('SNS is not configured to activate DB Mux');
    }

    if (!dbMux) {
      NcError.internalServerError('DB Mux is not found to activate');
    }

    const serviceName = dbMux.domain.replace(/https?:\/\//, '');

    const params = {
      TopicArn: dbMuxSnsTopic,
      Message: JSON.stringify({
        operation: 'activate',
        serviceName,
        dbMuxId: dbMux.id,
      }),
    };

    const snsClient = new SNSClient({
      region: snsConfig.region,
      credentials: {
        accessKeyId: snsConfig.credentials.accessKeyId,
        secretAccessKey: snsConfig.credentials.secretAccessKey,
      },
    });

    await dbMux.update({
      status: DbMuxStatus.DEPLOYING,
    });

    try {
      // Handle promise's fulfilled/rejected states
      const data = await snsClient.send(new PublishCommand(params));
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
