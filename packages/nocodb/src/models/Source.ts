import { UITypes } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import type { DriverClient } from '~/utils/nc-config';
import type { BoolType, SourceType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { Base, Model, SyncSource } from '~/models';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
import { InstanceCommands } from '~/interface/Jobs';
import View from '~/models/View';
import {
  decryptPropIfRequired,
  deepMerge,
  encryptPropIfRequired,
  isEncryptionRequired,
  partialExtract,
} from '~/utils';

export default class Source implements SourceType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  alias?: string;
  type?: DriverClient;
  is_meta?: BoolType;
  is_local?: BoolType;
  is_schema_readonly?: BoolType;
  is_data_readonly?: BoolType;
  config?: string;
  inflection_column?: string;
  inflection_table?: string;
  order?: number;
  erd_uuid?: string;
  enabled?: BoolType;
  meta?: any;
  fk_integration_id?: string;
  integration_config?: string;
  integration_title?: string;
  is_encrypted?: boolean;

  // Ephemeral properties
  upgraderMode?: boolean;
  upgraderQueries?: string[] = [];

  constructor(source: Partial<SourceType>) {
    Object.assign(this, source);
  }

  protected static castType(source: Source): Source {
    return source && new Source(source);
  }

  protected static encryptConfigIfRequired(obj: Record<string, unknown>) {
    obj.config = encryptPropIfRequired({ data: obj });
    obj.is_encrypted = isEncryptionRequired();
  }

  public static async createBase(
    context: NcContext,
    source: SourceType & {
      baseId: string;
      created_at?;
      updated_at?;
      meta?: any;
      is_encrypted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(source, [
      'id',
      'alias',
      'config',
      'type',
      'is_meta',
      'is_local',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
      'meta',
      'is_schema_readonly',
      'is_data_readonly',
      'fk_integration_id',
      'is_encrypted',
    ]);

    this.encryptConfigIfRequired(insertObj);

    if ('meta' in insertObj) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.SOURCES, {
      base_id: source.baseId,
    });

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SOURCES,
      insertObj,
    );

    const returnBase = await this.get(context, id, false, ncMeta);

    await NocoCache.appendToList(
      CacheScope.SOURCE,
      [source.baseId],
      `${CacheScope.SOURCE}:${id}`,
    );

    return returnBase;
  }

  public static async update(
    context: NcContext,
    sourceId: string,
    source: SourceType & {
      meta?: any;
      deleted?: boolean;
      fk_sql_executor_id?: string;
      is_encrypted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const oldSource = await this.get(context, sourceId, false, ncMeta);

    if (!oldSource) NcError.sourceNotFound(sourceId);

    const updateObj = extractProps(source, [
      'alias',
      'config',
      'type',
      'is_meta',
      'is_local',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
      'meta',
      'deleted',
      'fk_sql_executor_id',
      'is_schema_readonly',
      'is_data_readonly',
      'fk_integration_id',
      'is_encrypted',
    ]);

    if (updateObj.config) {
      this.encryptConfigIfRequired(updateObj);
    }

    // type property is undefined even if not provided
    if (!updateObj.type) {
      updateObj.type = oldSource.type;
    }

    if ('meta' in updateObj) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // if order is missing (possible in old versions), get next order
    if (!oldSource.order && !updateObj.order) {
      updateObj.order = await ncMeta.metaGetNextOrder(MetaTable.SOURCES, {
        base_id: oldSource.base_id,
      });

      if (updateObj.order <= 1 && !oldSource.isMeta()) {
        updateObj.order = 2;
      }
    }

    // keep order 1 for default source
    if (oldSource.isMeta()) {
      updateObj.order = 1;
    }

    // keep order 1 for default source
    if (!oldSource.isMeta()) {
      if (updateObj.order <= 1) {
        NcError.badRequest('Cannot change order to 1 or less');
      }

      // if order is 1 for non-default source, move it to last
      if (oldSource.order <= 1 && !updateObj.order) {
        updateObj.order = await ncMeta.metaGetNextOrder(MetaTable.SOURCES, {
          base_id: oldSource.base_id,
        });
      }
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SOURCES,
      prepareForDb(updateObj),
      oldSource.id,
    );

    await NocoCache.update(
      `${CacheScope.SOURCE}:${sourceId}`,
      prepareForResponse(updateObj),
    );

    // trigger cache clear and don't wait
    this.updateRelatedCaches(context, sourceId, ncMeta).catch((e) => {
      console.error(e);
    });

    if (JobsRedis.available) {
      await JobsRedis.emitWorkerCommand(InstanceCommands.RELEASE, sourceId);
      await JobsRedis.emitPrimaryCommand(InstanceCommands.RELEASE, sourceId);
    }

    return await this.get(context, oldSource.id, false, ncMeta);
  }

  static async list(
    context: NcContext,
    args: { baseId: string; includeDeleted?: boolean },
    ncMeta = Noco.ncMeta,
  ): Promise<Source[]> {
    const cachedList = await NocoCache.getList(CacheScope.SOURCE, [
      args.baseId,
    ]);
    let { list: sourceDataList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !sourceDataList.length) {
      const qb = ncMeta
        .knex(MetaTable.SOURCES)
        .select(`${MetaTable.SOURCES}.*`)
        .where(`${MetaTable.SOURCES}.base_id`, context.base_id);

      if (!args.includeDeleted) {
        qb.where((whereQb) => {
          whereQb
            .where(`${MetaTable.SOURCES}.deleted`, false)
            .orWhereNull(`${MetaTable.SOURCES}.deleted`);
        });
      }

      qb.orderBy(`${MetaTable.SOURCES}.order`, 'asc');

      this.extendQb(qb, context);

      sourceDataList = await qb;

      // parse JSON metadata
      for (const source of sourceDataList) {
        source.meta = parseMetaProp(source, 'meta');
      }

      await NocoCache.setList(CacheScope.SOURCE, [args.baseId], sourceDataList);
    }

    sourceDataList.sort(
      (a, b) => (a?.order ?? Infinity) - (b?.order ?? Infinity),
    );

    return sourceDataList?.map((sourceData) => {
      return this.castType(sourceData);
    });
  }

  static async get(
    context: NcContext,
    id: string,
    force = false,
    ncMeta = Noco.ncMeta,
  ): Promise<Source> {
    let sourceData =
      id &&
      (await NocoCache.get(
        `${CacheScope.SOURCE}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!sourceData) {
      const qb = ncMeta
        .knex(MetaTable.SOURCES)
        .select(`${MetaTable.SOURCES}.*`)
        .where(`${MetaTable.SOURCES}.id`, id)
        .where(`${MetaTable.SOURCES}.base_id`, context.base_id);

      this.extendQb(qb, context);

      if (!force) {
        qb.where((whereQb) => {
          whereQb
            .where(`${MetaTable.SOURCES}.deleted`, false)
            .orWhereNull(`${MetaTable.SOURCES}.deleted`);
        });
      }

      sourceData = await qb.first();

      if (sourceData) {
        sourceData.meta = parseMetaProp(sourceData, 'meta');
      }

      await NocoCache.set(`${CacheScope.SOURCE}:${id}`, sourceData);
    }
    return this.castType(sourceData);
  }

  public async getConnectionConfig(): Promise<any> {
    if (this.is_meta || this.is_local) {
      const metaConfig = await NcConnectionMgrv2.getDataConfig();
      const config = { ...metaConfig };
      if (config.client === 'sqlite3') {
        config.connection = metaConfig;
      }
      return config;
    }

    const config = this.getConfig();

    // todo: update sql-client args
    if (config?.client === 'sqlite3') {
      config.connection.filename =
        config.connection.filename || config.connection?.connection.filename;
    }

    return config;
  }
  public getConfig(skipIntegrationConfig = false): any {
    if (this.is_meta) {
      const metaConfig = Noco.getConfig()?.meta?.db;
      const config = { ...metaConfig };
      if (config.client === 'sqlite3') {
        config.connection = metaConfig;
      }
      return config;
    }

    const config = decryptPropIfRequired({
      data: this,
    });

    if (skipIntegrationConfig) {
      return config;
    }

    if (!this.integration_config) {
      return config;
    }

    const integrationConfig = decryptPropIfRequired({
      data: this,
      prop: 'integration_config',
    });
    // merge integration config with source config
    // override integration config with source config if exists
    // only override database and searchPath
    return deepMerge(
      integrationConfig,
      partialExtract(config || {}, [
        ['connection', 'database'],
        ['searchPath'],
      ]),
    );
  }

  public getSourceConfig(): any {
    return this.getConfig(true);
  }

  getProject(context: NcContext, ncMeta = Noco.ncMeta): Promise<Base> {
    return Base.get(context, this.base_id, ncMeta);
  }

  async sourceCleanup(_ncMeta = Noco.ncMeta) {
    await NcConnectionMgrv2.deleteAwait(this);

    if (JobsRedis.available) {
      await JobsRedis.emitWorkerCommand(InstanceCommands.RELEASE, this.id);
      await JobsRedis.emitPrimaryCommand(InstanceCommands.RELEASE, this.id);
    }
  }

  async delete(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    { force }: { force?: boolean } = {},
  ) {
    const sources = await Source.list(
      context,
      { baseId: this.base_id },
      ncMeta,
    );

    if ((sources[0].id === this.id || this.isMeta()) && !force) {
      NcError.badRequest('Cannot delete first source');
    }

    const models = await Model.list(
      context,
      {
        source_id: this.id,
        base_id: this.base_id,
      },
      ncMeta,
    );

    const relColumns = [];
    const relRank = {
      [UITypes.Lookup]: 1,
      [UITypes.Rollup]: 2,
      [UITypes.ForeignKey]: 3,
      [UITypes.LinkToAnotherRecord]: 4,
    };

    for (const model of models) {
      for (const col of await model.getColumns(context, ncMeta)) {
        let colOptionTableName = null;
        let cacheScopeName = null;
        switch (col.uidt) {
          case UITypes.Rollup:
            colOptionTableName = MetaTable.COL_ROLLUP;
            cacheScopeName = CacheScope.COL_ROLLUP;
            break;
          case UITypes.Lookup:
            colOptionTableName = MetaTable.COL_LOOKUP;
            cacheScopeName = CacheScope.COL_LOOKUP;
            break;
          case UITypes.ForeignKey:
          case UITypes.LinkToAnotherRecord:
            colOptionTableName = MetaTable.COL_RELATIONS;
            cacheScopeName = CacheScope.COL_RELATION;
            break;
        }
        if (colOptionTableName && cacheScopeName) {
          relColumns.push({ col, colOptionTableName, cacheScopeName });
        }
      }
    }

    relColumns.sort((a, b) => {
      return relRank[a.col.uidt] - relRank[b.col.uidt];
    });

    for (const relCol of relColumns) {
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        relCol.colOptionTableName,
        {
          fk_column_id: relCol.col.id,
        },
      );
      await NocoCache.deepDel(
        `${relCol.cacheScopeName}:${relCol.col.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    for (const model of models) {
      await model.delete(context, ncMeta, true);
    }

    const syncSources = await SyncSource.list(
      context,
      this.base_id,
      this.id,
      ncMeta,
    );
    for (const syncSource of syncSources) {
      await SyncSource.delete(context, syncSource.id, ncMeta);
    }

    await this.sourceCleanup(ncMeta);

    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SOURCES,
      this.id,
    );

    await NocoCache.deepDel(
      `${CacheScope.SOURCE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return res;
  }

  async softDelete(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    { force }: { force?: boolean } = {},
  ) {
    const sources = await Source.list(
      context,
      { baseId: this.base_id },
      ncMeta,
    );

    if ((sources[0].id === this.id || this.isMeta()) && !force) {
      NcError.badRequest('Cannot delete first base');
    }

    await Source.update(context, this.id, { deleted: true }, ncMeta);

    await NocoCache.deepDel(
      `${CacheScope.SOURCE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  async getModels(context: NcContext, ncMeta = Noco.ncMeta) {
    return await Model.list(
      context,
      { base_id: this.base_id, source_id: this.id },
      ncMeta,
    );
  }

  async shareErd(context: NcContext, ncMeta = Noco.ncMeta) {
    if (!this.erd_uuid) {
      const uuid = uuidv4();
      this.erd_uuid = uuid;

      // set meta
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.SOURCES,
        {
          erd_uuid: this.erd_uuid,
        },
        this.id,
      );

      await NocoCache.update(`${CacheScope.SOURCE}:${this.id}`, {
        erd_uuid: this.erd_uuid,
      });
    }
    return this;
  }

  async disableShareErd(context: NcContext, ncMeta = Noco.ncMeta) {
    if (this.erd_uuid) {
      this.erd_uuid = null;

      // set meta
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.SOURCES,
        {
          erd_uuid: this.erd_uuid,
        },
        this.id,
      );

      await NocoCache.update(`${CacheScope.SOURCE}:${this.id}`, {
        erd_uuid: this.erd_uuid,
      });
    }
    return this;
  }

  isMeta(_only = false, _mode = 0) {
    if (_only) {
      if (_mode === 0) {
        return this.is_meta;
      }
      return this.is_local;
    } else {
      return this.is_meta || this.is_local;
    }
  }

  protected static extendQb(qb: any, _context: NcContext) {
    qb.select(
      `${MetaTable.INTEGRATIONS}.config as integration_config`,
      `${MetaTable.INTEGRATIONS}.title as integration_title`,
    ).leftJoin(
      MetaTable.INTEGRATIONS,
      `${MetaTable.SOURCES}.fk_integration_id`,
      `${MetaTable.INTEGRATIONS}.id`,
    );
  }

  private static async updateRelatedCaches(
    context: NcContext,
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // get models
    const models = await Model.list(
      context,
      { source_id: sourceId, base_id: context.base_id },
      ncMeta,
    );

    // clear single query caches for models
    for (const model of models) {
      await View.clearSingleQueryCache(context, model.id, null, ncMeta);
    }
  }
}
