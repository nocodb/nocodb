import { Injectable } from '@nestjs/common';
import debug from 'debug';
import PQueue from 'p-queue';
import { UITypes } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { NcContext } from '~/interface/config';
import { Column, Model, Source } from '~/models';
import { MetaTable } from '~/utils/globals';
import { isEE } from '~/utils';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import { Altered } from '~/services/columns.service';
import Upgrader from '~/Upgrader';

const PARALLEL_LIMIT = +process.env.NC_ORDER_MIGRATION_PARALLEL_LIMIT || 5;

const propsByClientType = {};
const entityCache: {
  source: { [key: string]: Source };
  dbDriver: { [key: string]: any };
} = {
  source: {},
  dbDriver: {},
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

@Injectable()
export class OrderColumnMigration {
  private readonly debugLog = debug('nc:migration-jobs:order-column');
  private readonly log = (...msgs: string[]) =>
    console.log('[nc_job_005_order_column]: ', ...msgs);

  logExecutionTime(message: string, hrTime) {
    const [seconds, nanoseconds] = process.hrtime(hrTime);
    const elapsedSeconds = seconds + nanoseconds / 1e9;
    this.log(`${message} in ${elapsedSeconds}s`);
  }

  private async populateOrderValues(
    context: NcContext,
    dbDriver: any,
    baseModel: any,
    model: any,
    source: any,
    newColumn: any,
  ) {
    const aiColumn = model.columns.find((c) => c.ai);
    const pkColumn = model.primaryKeys[0]?.column_name;

    if (aiColumn) {
      const q = dbDriver
        .raw(`UPDATE ?? SET ?? = ??`, [
          baseModel.getTnPath(model.table_name),
          newColumn.column_name,
          aiColumn.column_name,
        ])
        .toQuery();
      await Upgrader.addDataQuery(context, source.id, q);
      return;
    }

    if (!pkColumn) return;

    const sql = {
      mysql2: `UPDATE ?? SET ?? = ROW_NUMBER() OVER (ORDER BY ?? ASC)`,
      pg: `UPDATE ?? t SET ?? = s.rn FROM (SELECT ??, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) s WHERE t.?? = s.??`,
      sqlite3: `WITH rn AS (SELECT ??, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) UPDATE ?? SET ?? = (SELECT rn FROM rn WHERE rn.?? = ??.??)`,
    };

    const params = {
      mysql2: [
        baseModel.getTnPath(model.table_name),
        newColumn.column_name,
        pkColumn,
      ],
      pg: [
        baseModel.getTnPath(model.table_name),
        newColumn.column_name,
        pkColumn,
        pkColumn,
        baseModel.getTnPath(model.table_name),
        pkColumn,
        pkColumn,
      ],
      sqlite3: [
        pkColumn,
        pkColumn,
        baseModel.getTnPath(model.table_name),
        baseModel.getTnPath(model.table_name),
        newColumn.column_name,
        pkColumn,
        baseModel.getTnPath(model.table_name),
        pkColumn,
      ],
    };

    const q = dbDriver.raw(sql[source.type], params[source.type]);

    await Upgrader.addDataQuery(context, source.id, q);
  }

  private async cleanupFailedColumn(
    context: NcContext,
    sqlMgr: any,
    source: Source,
    model: Model,
    newColumn: any,
  ) {
    const columns = model.columns;
    const orderColumn = columns.find((c) => c.uidt === UITypes.Order);
    const deleteUpdateBody = {
      ...model,
      tn: model.table_name,
      originalColumns: columns.map((c) => ({
        ...c,
        cn: c.column_name,
        cno: c.column_name,
      })),
      columns: columns.map((c) => {
        if (c.column_name === newColumn.column_name) {
          return {
            ...c,
            cn: c.column_name,
            cno: c.column_name,
            altered: Altered.DELETE_COLUMN,
          };
        }
        (c as any).cn = c.column_name;
        return c;
      }),
    };

    await sqlMgr.sqlOpPlus(source, 'tableUpdate', deleteUpdateBody);

    await Column.delete(context, orderColumn.id);
  }

  private async addOrderColumn(
    model: Model,
    source: any,
    context: any,
    ncMeta: MetaService,
    sqlMgr: any,
  ) {
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
    ncMeta: MetaService,
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

      this.logExecutionTime(`Source fetched ${source_id}`, hrtime);

      source.upgraderMode = true;

      const dbDriver =
        entityCache.dbDriver[source_id] ||
        (entityCache.dbDriver[source_id] = await NcConnectionMgrv2.get(source));

      this.logExecutionTime(`DB Driver created`, hrtime);

      const model = await Model.get(context, modelId);

      this.logExecutionTime(`Model fetched`, hrtime);

      const baseModel = await Model.getBaseModelSQL(context, {
        model,
        source,
        dbDriver,
      });

      this.logExecutionTime(`Base Model created`, hrtime);

      await model.getColumns(context);

      this.logExecutionTime(`Columns fetched`, hrtime);

      this.log(
        `Generating queries for model ${modelId} - Table: ${model.table_name} - BaseId ${base_id} - WorkspaceId ${context.workspace_id}`,
      );

      const sqlMgr = ProjectMgrv2.getSqlMgr(
        context,
        { id: source.base_id },
        ncMeta,
      );

      let orderColumn = model.columns.find((c) => c.uidt === UITypes.Order);
      if (!orderColumn) {
        orderColumn = await this.addOrderColumn(
          model,
          source,
          context,
          ncMeta,
          sqlMgr,
        );

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
      } else {
        this.log(
          `Order column already exists for model ${modelId}, Table: ${model.table_name}, BaseId ${base_id}, WorkspaceId ${context.workspace_id}`,
        );
      }
      try {
        await this.populateOrderValues(
          context,
          dbDriver,
          baseModel,
          model,
          source,
          orderColumn,
        );

        this.logExecutionTime(`Populate order values query generated`, hrtime);
      } catch (err) {
        this.log(
          `Error populating order values. Proceeding with Cleanup for model ${modelId}:`,
        );
        this.log(err);
        await this.cleanupFailedColumn(
          context,
          sqlMgr,
          source,
          model,
          orderColumn,
        );

        this.logExecutionTime(`Cleanup failed column query generated`, hrtime);

        throw err;
      }
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
      });
  }

  async job() {
    const ncMeta = Noco.ncMeta;

    try {
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
          .count('*', { as: 'count' })
          .first()
      )?.count;

      let processedModelsCount = 0;

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
        } finally {
          processedModelsCount++;
          this.log(
            `Processed ${processedModelsCount} of ${numberOfModelsToBeProcessed} models`,
          );
        }
      };

      const queue = new PQueue({ concurrency: PARALLEL_LIMIT });

      const models = await this.getModelsQuery(ncMeta);

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (queue.pending > PARALLEL_LIMIT) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        if (!models?.length) break;

        const processModels = models.splice(0, PARALLEL_LIMIT * 10);

        for (const model of processModels) {
          queue
            .add(() => wrapper(model))
            .catch((e) => {
              this.log(`Error processing model ${model.fk_model_id}`);
              this.log(e);
            });
        }
      }

      await queue.onIdle();
      // TODO: Drop temp table manually for now
      // await ncMeta.knexConnection.schema.dropTableIfExists(TEMP_TABLE);

      return true;
    } catch (error) {
      this.log('Migration failed:');
      return false;
    }
  }
}
