import { default as SourceCE } from 'src/models/Source';
import {
  type BoolType,
  ModelTypes,
  PlanLimitTypes,
  type SourceType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import NocoCache from '~/cache/NocoCache';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { stringifyMetaProp } from '~/utils/modelUtils';
import { NcError } from '~/helpers/catchError';
import { ModelStat } from '~/models';
import { getWorkspaceDbServer } from '~/utils/cloudDb';

export default class Source extends SourceCE implements SourceType {
  is_local?: BoolType;
  meta?: any;
  constructor(source: Partial<SourceType>) {
    super(source);
  }

  protected static castType(source: Source): Source {
    return source && new Source(source);
  }

  public static async createBase(
    context: NcContext,
    source: SourceType & {
      baseId: string;
      created_at?;
      updated_at?;
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

    if (!insertObj.is_meta && !insertObj.is_local) {
      await NocoCache.incrHashField(
        `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
        PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE,
        1,
      );
    }

    // call before reorder to update cache
    const returnBase = await this.get(context, id, false, ncMeta);

    await NocoCache.appendToList(
      CacheScope.SOURCE,
      [source.baseId],
      `${CacheScope.SOURCE}:${id}`,
    );

    return returnBase;
  }

  public async getConnectionConfig(): Promise<any> {
    if (this.isMeta() && this.fk_workspace_id) {
      const dbInstance = await getWorkspaceDbServer(this.fk_workspace_id);
      if (dbInstance) {
        return dbInstance.config;
      }
    }

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

  async sourceCleanup(ncMeta = Noco.ncMeta) {
    // remove schema if NC_MINIMAL_DBS enabled
    if (
      process.env.NC_DISABLE_PG_DATA_REFLECTION !== 'true' &&
      this.isMeta(true, 1)
    ) {
      const schema = this.getConfig().schema;
      await ncMeta.knex.raw(`DROP SCHEMA IF EXISTS ?? CASCADE`, [schema]);
    }

    return super.sourceCleanup(ncMeta);
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

    await Source.update(
      context,
      this.id,
      { deleted: true, fk_sql_executor_id: null },
      ncMeta,
    );

    if (!this.isMeta()) {
      await NocoCache.incrHashField(
        `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
        PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE,
        -1,
      );
    }

    await NocoCache.deepDel(
      `${CacheScope.SOURCE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  async delete(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    { force }: { force?: boolean } = {},
  ) {
    const models = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        condition: {
          base_id: this.base_id,
        },
        xcCondition: {
          _or: [
            {
              type: {
                eq: ModelTypes.TABLE,
              },
            },
            {
              type: {
                eq: ModelTypes.VIEW,
              },
            },
          ],
        },
      },
    );

    await Promise.all(
      models.map((model) =>
        ModelStat.delete(context, this.fk_workspace_id, model.id),
      ),
    );

    return super.delete(context, ncMeta, { force });
  }

  static async countSourcesInBase(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.SOURCES,
      {
        xcCondition: {
          _and: [
            {
              _or: [
                {
                  is_meta: {
                    eq: false,
                  },
                },
                {
                  is_meta: {
                    eq: null,
                  },
                },
              ],
            },
            {
              _or: [
                {
                  is_local: {
                    eq: false,
                  },
                },
                {
                  is_local: {
                    eq: null,
                  },
                },
              ],
            },
          ],
        },
      },
    );
  }

  static async clearFromStats(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const countsInBase = await this.countSourcesInBase(context, baseId, ncMeta);

    await NocoCache.incrHashField(
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE,
      -countsInBase,
    );

    return true;
  }

  protected static extendQb(qb: any, context: NcContext) {
    qb.where(`${MetaTable.SOURCES}.fk_workspace_id`, context.workspace_id);
    return super.extendQb(qb, context);
  }
}
