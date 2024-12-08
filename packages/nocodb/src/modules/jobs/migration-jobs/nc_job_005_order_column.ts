import { Injectable } from '@nestjs/common';
import debug from 'debug';
import PQueue from 'p-queue';
import { UITypes } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { Knex } from 'knex';
import type SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import type CustomKnex from '~/db/CustomKnex';
import { Column, Model, Source } from '~/models';
import { MetaTable } from '~/utils/globals';
import { isEE } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import { Altered } from '~/services/columns.service';
import Upgrader from '~/Upgrader';
import Noco from '~/Noco';

const PARALLEL_LIMIT = +process.env.NC_ORDER_MIGRATION_PARALLEL_LIMIT || 10;
const TEMP_TABLE = 'nc_temp_processed_order_models';

const propsByClientType = {};
const entityCache: {
  source: { [key: string]: Source };
  dbDriver: { [key: string]: CustomKnex };
  upgraderDbDriver: { [key: string]: CustomKnex };
  sqlMgr: { [key: string]: SqlMgrv2 };
} = {
  source: {},
  dbDriver: {},
  upgraderDbDriver: {},
  sqlMgr: {},
};

const sql = {
  mysql2: `UPDATE ?? SET ?? = ROW_NUMBER() OVER (ORDER BY ?? ASC)`,
  pg: `UPDATE ?? t SET ?? = s.rn FROM (SELECT ??, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) s WHERE t.?? = s.??`,
  sqlite3: `WITH rn AS (SELECT ??, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) UPDATE ?? SET ?? = (SELECT rn FROM rn WHERE rn.?? = ??.??)`,
};

const memoizedGetColumnPropsFromUIDT = async (source: Source) => {
  const clientType = source.type;

  if (!propsByClientType[clientType]) {
    propsByClientType[clientType] = await getColumnPropsFromUIDT(
      {
        uidt: UITypes.Order,
        column_name: 'nc_order',
        title: 'nc_order',
      },
      source,
    );
  }

  return propsByClientType[clientType];
};

const skipModels = new Set(['placeholder']);
let processingModels = [{ fk_model_id: 'placeholder', processing: true }];
let processedModelsCount = 0;

@Injectable()
export class OrderColumnMigration {
  private readonly debugLog = debug('nc:migration-jobs:order-column');
  private readonly log = (...msgs: string[]) =>
    console.log('[nc_job_005_order_column]: ', ...msgs);

  logExecutionTime(message: string, hrTime) {
    const [seconds, nanoseconds] = process.hrtime(hrTime);

    // reset hrTime
    hrTime = process.hrtime();

    const elapsedSeconds = seconds + nanoseconds / 1e9;
    this.log(`${message} in ${elapsedSeconds}s`);
  }

  async job() {
    if (!(await Noco.ncMeta.knexConnection.schema.hasTable(TEMP_TABLE))) {
      await Noco.ncMeta.knexConnection.schema.createTable(
        TEMP_TABLE,
        (table) => {
          table.increments('id').primary();
          table.string('fk_model_id').notNullable();
          table.boolean('completed').defaultTo(false);
          table.text('error').nullable();
          table.index('fk_model_id');
        },
      );
    }

    const ncMeta = new Upgrader();

    try {
      ncMeta.enableUpgraderMode();

      const totalHrTime = process.hrtime();

      const numberOfModelsToBeProcessed = +(
        await ncMeta
          .knexConnection(MetaTable.MODELS)
          .join(
            MetaTable.SOURCES,
            `${MetaTable.MODELS}.source_id`,
            '=',
            `${MetaTable.SOURCES}.id`,
          )
          .where(`${MetaTable.MODELS}.mm`, false)
          .where((builder) => {
            builder.where(`${MetaTable.SOURCES}.is_meta`, true);
            if (isEE) builder.orWhere({ is_local: true });
          })
          .whereNotIn(
            `${MetaTable.MODELS}.id`,
            ncMeta
              .knexConnection(TEMP_TABLE)
              .select('fk_model_id')
              .where('completed', true),
          )
          .count('*', { as: 'count' })
          .first()
      )?.count;

      const wrapper = async (model: {
        id: string;
        source_id: string;
        fk_workspace_id?: string;
        base_id: string;
      }) => {
        try {
          await this.processModel(model, ncMeta);
        } catch (e) {
          this.log(`Error processing model ${model.id}:`);
          console.error(e);
          skipModels.add(model.id);
          await this.updateModelStatus(Noco.ncMeta, model.id, false, e.message);
        } finally {
          const item = processingModels.find((m) => m.fk_model_id === model.id);

          if (item) {
            item.processing = false;
          }

          processedModelsCount++;
          this.log(
            `Processed ${processedModelsCount} of ${numberOfModelsToBeProcessed} models`,
          );
        }
      };

      const queue = new PQueue({ concurrency: PARALLEL_LIMIT });

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (queue.pending > PARALLEL_LIMIT * 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        processingModels = processingModels.filter((m) => m.processing);

        const models = await this.getModelsQuery(ncMeta);

        if (!models?.length) break;

        const processModels = models.splice(0);

        for (const model of processModels) {
          processingModels.push({ fk_model_id: model.id, processing: true });

          queue
            .add(() => wrapper(model))
            .catch((e) => {
              this.log(`Error processing model ${model.fk_model_id}`);
              console.error(e);
            });
        }
      }

      await queue.onIdle();
      // TODO: Drop temp table manually for now
      // await ncMeta.knexConnection.schema.dropTableIfExists(TEMP_TABLE);

      await ncMeta.disableUpgraderMode();

      this.logExecutionTime('Migration job completed', totalHrTime);

      return true;
    } catch (error) {
      this.log('Migration failed:');
      console.error(error);
      return false;
    }
  }

  private async populateOrderValues(
    dbDriver: CustomKnex,
    tnPath: string | Knex.Raw<any>,
    model: Model,
    source: Source,
    newColumn: { column_name: string },
  ) {
    const aiColumn = model.columns.find((c) => c.ai);
    const pkColumn = model.primaryKeys[0]?.column_name;

    if (aiColumn) {
      const q = dbDriver.raw(`UPDATE ?? SET ?? = ??`, [
        tnPath,
        newColumn.column_name,
        aiColumn.column_name,
      ]);

      source.upgraderQueries.push(q.toQuery());

      const createIndexQuery = dbDriver.raw(`CREATE INDEX ?? ON ?? (??)`, [
        `${model.table_name}_order_idx`,
        tnPath,
        `${newColumn.column_name}`,
      ]);

      source.upgraderQueries.push(createIndexQuery.toQuery());

      return;
    }

    if (!pkColumn) return;

    const params = {
      mysql2: [tnPath, newColumn.column_name, pkColumn],
      pg: [
        tnPath,
        newColumn.column_name,
        pkColumn,
        pkColumn,
        tnPath,
        pkColumn,
        pkColumn,
      ],
      sqlite3: [
        pkColumn,
        pkColumn,
        tnPath,
        tnPath,
        newColumn.column_name,
        pkColumn,
        tnPath,
        pkColumn,
      ],
    };

    const q = dbDriver.raw(sql[source.type], params[source.type]);

    source.upgraderQueries.push(q.toQuery());

    const createIndexQuery = dbDriver.raw(`CREATE INDEX ?? ON ?? (??)`, [
      `${model.table_name}_order_idx`,
      tnPath,
      `${newColumn.column_name}`,
    ]);

    source.upgraderQueries.push(createIndexQuery.toQuery());
  }

  private async addOrderColumn(model: Model, source: Source, sqlMgr: SqlMgrv2) {
    const newColumn = {
      ...(await memoizedGetColumnPropsFromUIDT(source)),
      column_name: getUniqueColumnName(model.columns, 'nc_order'),
      title: getUniqueColumnAliasName(model.columns, 'nc_order'),
      cdf: null,
      system: true,
      altered: Altered.NEW_COLUMN,
    };

    const tableUpdateBody = {
      ...model,
      tn: model.table_name,
      originalColumns: model.columns.map((c) => ({ ...c, cn: c.column_name })),
      columns: [...model.columns, newColumn].map((c) => ({
        ...c,
        cn: c.column_name,
      })),
    };

    await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
    return newColumn;
  }

  private async processModel(
    modelData: {
      id: string;
      source_id: string;
      fk_workspace_id?: string;
      base_id: string;
    },
    ncMeta: Upgrader,
  ) {
    const { id: modelId, source_id, base_id } = modelData;
    const context = { workspace_id: modelData?.fk_workspace_id, base_id };

    try {
      const hrtime = process.hrtime();

      const source =
        entityCache.source[source_id] ||
        (entityCache.source[source_id] = await Source.get(context, source_id));
      if (!source || (!source.isMeta() && (!isEE || !source.is_local))) {
        return;
      }

      source.upgraderMode = true;

      const dbDriver: CustomKnex =
        entityCache.upgraderDbDriver[source_id] ||
        (entityCache.upgraderDbDriver[source_id] = await NcConnectionMgrv2.get(
          source,
        ));

      const model = await Model.get(context, modelId);

      const baseModel = await Model.getBaseModelSQL(context, {
        model,
        source,
        dbDriver,
      });

      await model.getColumns(context);

      const tnPath = baseModel.getTnPath(model.table_name);

      this.log(
        `Generating queries for model ${modelId} - Table: ${model.table_name} - BaseId ${base_id} - WorkspaceId ${context.workspace_id}`,
      );

      const sqlMgr =
        entityCache.sqlMgr[source.base_id] ||
        (entityCache.sqlMgr[source.base_id] = ProjectMgrv2.getSqlMgr(
          context,
          { id: source.base_id },
          ncMeta,
        ));

      let orderColumn = model.columns.find((c) => c.uidt === UITypes.Order);
      if (!orderColumn) {
        orderColumn = await this.addOrderColumn(model, source, sqlMgr);

        this.logExecutionTime(`Add order column query generated`, hrtime);

        await Column.insert(
          context,
          {
            ...orderColumn,
            system: true,
            fk_model_id: model.id,
            source_id,
          },
          ncMeta,
        );

        this.logExecutionTime(`Add order column meta query generated`, hrtime);

        await this.populateOrderValues(
          dbDriver,
          tnPath,
          model,
          source,
          orderColumn,
        );

        this.logExecutionTime(`Populate order values query generated`, hrtime);
      } else {
        this.log(
          `Order column already exists for model ${modelId}, Table: ${model.table_name}, BaseId ${base_id}, WorkspaceId ${context.workspace_id}`,
        );
        await this.updateModelStatus(Noco.ncMeta, modelId, true);
        return;
      }

      const realDbDriver =
        entityCache.dbDriver[source_id] ||
        (entityCache.dbDriver[source_id] = await NcConnectionMgrv2.get(
          new Source({
            ...source,
            upgraderMode: false,
          } as any),
        ));

      const queries = source.upgraderQueries.splice(0);

      await realDbDriver.raw(queries.join(';'));
      await ncMeta.runUpgraderQueries();
    } catch (error) {
      throw error;
    }
  }

  private getModelsQuery(ncMeta: MetaService) {
    return ncMeta
      .knexConnection(MetaTable.MODELS)
      .select([
        `${MetaTable.MODELS}.id`,
        'source_id',
        `${MetaTable.MODELS}.base_id`,
        ...(isEE ? [`${MetaTable.MODELS}.fk_workspace_id`] : []),
      ])
      .where(`${MetaTable.MODELS}.mm`, false)
      .join(
        MetaTable.SOURCES,
        `${MetaTable.MODELS}.source_id`,
        '=',
        `${MetaTable.SOURCES}.id`,
      )
      .where((builder) => {
        builder.where(`${MetaTable.SOURCES}.is_meta`, true);
        if (isEE) builder.orWhere({ is_local: true });
      })
      .whereNotIn(
        `${MetaTable.MODELS}.id`,
        ncMeta
          .knexConnection(TEMP_TABLE)
          .select('fk_model_id')
          .where('completed', true),
      )
      .whereNotIn(
        `${MetaTable.MODELS}.id`,
        Array.from(skipModels)
          .map((m) => m)
          .concat(processingModels.map((m) => m.fk_model_id)),
      )
      .limit(PARALLEL_LIMIT * 10);
  }

  private async updateModelStatus(
    ncMeta: MetaService,
    modelId: string,
    status: boolean,
    error?: string,
  ) {
    await ncMeta
      .knexConnection(TEMP_TABLE)
      .insert({ fk_model_id: modelId, completed: status, error });
  }
}
