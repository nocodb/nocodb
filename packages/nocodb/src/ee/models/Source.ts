import CryptoJS from 'crypto-js';
import { Source as SourceCE } from 'src/models';
import type { BoolType, SourceType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import NocoCache from '~/cache/NocoCache';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { stringifyMetaProp } from '~/utils/modelUtils';
import { NcError } from '~/helpers/catchError';
import { ModelStat } from '~/models';
import {encryptPropIfRequired} from "~/utils";

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
    ]);
    insertObj.config = encryptPropIfRequired({
      data: insertObj
      });

    if ('meta' in insertObj) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.BASES, {
      base_id: source.baseId,
    });

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.BASES,
      insertObj,
    );

    // call before reorder to update cache
    const returnBase = await this.get(context, id, false, ncMeta);

    await NocoCache.appendToList(
      CacheScope.BASE,
      [source.baseId],
      `${CacheScope.BASE}:${id}`,
    );

    return returnBase;
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

  async sourceCleanup(ncMeta = Noco.ncMeta) {
    // remove schema if NC_MINIMAL_DBS enabled
    if (
      process.env.NC_DISABLE_BASE_AS_PG_SCHEMA !== 'true' &&
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

    await NocoCache.deepDel(
      `${CacheScope.BASE}:${this.id}`,
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
      },
    );

    await Promise.all(
      models.map((model) =>
        ModelStat.delete(context, this.fk_workspace_id, model.id),
      ),
    );

    return super.delete(context, ncMeta, { force });
  }

  protected static extendQb(qb: any, context: NcContext) {
    qb.where(`${MetaTable.BASES}.fk_workspace_id`, context.workspace_id);
    return super.extendQb(qb, context);
  }
}
