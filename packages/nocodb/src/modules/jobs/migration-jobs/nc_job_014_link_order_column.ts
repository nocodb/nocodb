import { Injectable, Logger } from '@nestjs/common';
import debug from 'debug';
import PQueue from 'p-queue';
import { UITypes } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type CustomKnex from '~/db/CustomKnex';
import type SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import { Column, Model, Source } from '~/models';
import { CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import SimpleLRUCache from '~/utils/cache';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import { getUniqueColumnName } from '~/helpers/getUniqueName';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import { Altered } from '~/services/columns.service';
import Upgrader from '~/Upgrader';
import Noco from '~/Noco';

/**
 * PHASE-2 BACKFILL — per-link Order columns for EXISTING v2 junction tables.
 *
 * The nc_099 migration + junction-creation flow give NEW v2 links their two
 * junction Order columns; this job backfills the columns onto junctions that
 * already existed. For each NocoDB-managed (meta/local) junction (`mm = true`)
 * it: adds two system Order columns, seeds their values with a partitioned
 * ROW_NUMBER (one per FK group), creates the composite (fk, order) indexes, and
 * wires the column ids onto the relation rows (mirrors columns.service). Skips
 * external sources and already-migrated junctions. Mirrors nc_job_005 exactly.
 *
 * NOT REGISTERED YET. To enable, register like the other migration jobs:
 *   1. add `LinkOrderColumnCreation = 'link-order-column-creation'` to
 *      MigrationJobTypes (interface/Jobs.ts)
 *   2. provide + inject this class in InitMigrationJobs, push a new
 *      `{ version: '<next>', job, service }` entry into migrationJobsList
 *   3. bump NC_MIGRATION_JOBS_VERSION (init-meta-service.provider.ts)
 */
const PARALLEL_LIMIT =
  +process.env.NC_LINK_ORDER_MIGRATION_PARALLEL_LIMIT || 10;
const TEMP_TABLE = 'nc_temp_processed_link_order_models';

const propsByClientType: Record<string, any> = {};

// Partitioned ROW_NUMBER backfill. Placeholders (in order):
//   tn, ocol, keyA, keyB, partCol, sortCol, tn, keyA, keyA, keyB, keyB
const partitionedOrderSql = {
  mysql2: `UPDATE ?? t JOIN (SELECT ??, ??, ROW_NUMBER() OVER (PARTITION BY ?? ORDER BY ?? ASC) rn FROM ??) s ON t.?? = s.?? AND t.?? = s.?? SET t.?? = s.rn`,
  pg: `UPDATE ?? t SET ?? = s.rn FROM (SELECT ??, ??, ROW_NUMBER() OVER (PARTITION BY ?? ORDER BY ?? ASC) rn FROM ??) s WHERE t.?? = s.?? AND t.?? = s.??`,
  sqlite3: `WITH rn AS (SELECT ??, ??, ROW_NUMBER() OVER (PARTITION BY ?? ORDER BY ?? ASC) rn FROM ??) UPDATE ?? SET ?? = (SELECT rn FROM rn WHERE rn.?? = ??.?? AND rn.?? = ??.??)`,
};

const memoizedOrderProps = async (source: Source) => {
  if (!propsByClientType[source.type]) {
    propsByClientType[source.type] = await getColumnPropsFromUIDT(
      { uidt: UITypes.Order, column_name: 'nc_order', title: 'nc_order' } as any,
      source,
    );
  }
  return propsByClientType[source.type];
};

@Injectable()
export class LinkOrderColumnMigration {
  private readonly debugLog = debug('nc:migration-jobs:link-order-column');
  private readonly logger = new Logger(LinkOrderColumnMigration.name);
  private readonly log = (...msgs: string[]) =>
    this.logger.log(`${msgs.join(' ')}`);

  private processingModels = [{ fk_model_id: 'placeholder', processing: true }];
  private processedModelsCount = 0;
  private cache = new SimpleLRUCache(1000);

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

    await Noco.ncMeta
      .knexConnection(TEMP_TABLE)
      .delete()
      .where('completed', false);

    this.processingModels = [{ fk_model_id: 'placeholder', processing: true }];
    this.processedModelsCount = 0;
    this.cache.clear();

    const ncMeta = new Upgrader();

    try {
      ncMeta.enableUpgraderMode();

      const numberOfModelsToBeProcessed = +(
        await ncMeta
          .knexConnection(MetaTable.MODELS)
          .join(
            MetaTable.SOURCES,
            `${MetaTable.MODELS}.source_id`,
            '=',
            `${MetaTable.SOURCES}.id`,
          )
          .where(`${MetaTable.MODELS}.mm`, true)
          .where((builder) => {
            builder.where(`${MetaTable.SOURCES}.is_meta`, true);
            builder.orWhere({ is_local: true });
          })
          .whereNotIn(
            `${MetaTable.MODELS}.id`,
            ncMeta.knexConnection(TEMP_TABLE).select('fk_model_id'),
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
          await this.processJunction(model, ncMeta);
        } catch (e) {
          this.logger.error(
            `Error processing junction ${model.id}: ${e.message}`,
            e.stack,
          );
          await this.updateModelStatus(Noco.ncMeta, model.id, false, e.message);
        } finally {
          const item = this.processingModels.find(
            (m) => m.fk_model_id === model.id,
          );
          if (item) item.processing = false;
          this.processedModelsCount++;
          this.log(
            `Processed ${this.processedModelsCount} of ${numberOfModelsToBeProcessed} junctions`,
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

        this.processingModels = this.processingModels.filter(
          (m) => m.processing,
        );

        const models = await this.getModelsQuery(ncMeta);
        if (!models?.length) break;

        for (const model of models.splice(0)) {
          this.processingModels.push({ fk_model_id: model.id, processing: true });
          queue.add(() => wrapper(model)).catch((e) => {
            this.logger.error(
              `Error processing junction ${model.id}: ${e.message}`,
              e.stack,
            );
          });
        }
      }

      await queue.onIdle();
      await ncMeta.disableUpgraderMode();
      return true;
    } catch (error) {
      this.logger.error(`Migration failed: ${error.message}`, error.stack);
      await ncMeta.disableUpgraderMode();
      return false;
    }
  }

  private async processJunction(
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

    const originalSource = await this.cache.get(source_id, async () =>
      Source.get(context, source_id),
    );
    if (!originalSource || !originalSource.isMeta()) return;

    const model = await Model.get(context, modelId);
    await model.getColumns(context);

    // Already migrated (two Order columns present) → mark done, skip.
    const existingOrderCols = model.columns.filter(
      (c) => c.uidt === UITypes.Order,
    );
    if (existingOrderCols.length >= 2) {
      await this.updateModelStatus(Noco.ncMeta, modelId, true);
      return;
    }

    // The relation rows that use this junction (forward + reverse) carry the two
    // junction FK column ids and are where the order-column ids get wired.
    const relations = await ncMeta
      .knexConnection(MetaTable.COL_RELATIONS)
      .where('fk_mm_model_id', modelId);
    if (!relations.length) {
      // orphan junction with no relation rows — nothing to wire
      await this.updateModelStatus(Noco.ncMeta, modelId, true);
      return;
    }

    // Two distinct junction FK columns (composite PK). Resolve names.
    const keyColIdA = relations[0].fk_mm_child_column_id;
    const keyColIdB = relations[0].fk_mm_parent_column_id;
    const colA = model.columns.find((c) => c.id === keyColIdA);
    const colB = model.columns.find((c) => c.id === keyColIdB);
    if (!colA || !colB) {
      await this.updateModelStatus(Noco.ncMeta, modelId, true);
      return;
    }

    const source = new Source({
      ...originalSource,
      upgraderMode: true,
      upgraderQueries: [],
    } as any);
    source.upgraderMode = true;

    const dbDriver: CustomKnex = await NcConnectionMgrv2.get(source);
    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      source,
      dbDriver,
    });
    const tnPath = baseModel.getTnPath(model.table_name);
    const sqlMgr = ProjectMgrv2.getSqlMgr(context, { id: source.base_id }, ncMeta);

    // Build the two Order columns with distinct names.
    const orderProps = await memoizedOrderProps(source);
    const nameA = getUniqueColumnName(model.columns, 'nc_order');
    const nameB = getUniqueColumnName(
      [...model.columns, { column_name: nameA }] as any,
      'nc_order',
    );
    const mkOrderCol = (column_name: string) => ({
      ...orderProps,
      column_name,
      title: column_name,
      cdf: null,
      system: true,
      altered: Altered.NEW_COLUMN,
    });
    // orderColA groups by colA, orderColB groups by colB.
    const orderColA = mkOrderCol(nameA);
    const orderColB = mkOrderCol(nameB);

    // Schema: add both columns to the junction in one tableUpdate.
    const tableUpdateBody = {
      ...model,
      tn: model.table_name,
      originalColumns: model.columns.map((c) => ({ ...c, cn: c.column_name })),
      columns: [...model.columns, orderColA, orderColB].map((c) => ({
        ...c,
        cn: c.column_name,
      })),
    };
    await (sqlMgr as SqlMgrv2).sqlOpPlus(source, 'tableUpdate', tableUpdateBody);

    // Meta rows for the two columns.
    const insertedA = await Column.insert(
      context,
      { ...orderColA, fk_model_id: model.id, source_id },
      ncMeta,
    );
    const insertedB = await Column.insert(
      context,
      { ...orderColB, fk_model_id: model.id, source_id },
      ncMeta,
    );

    // Seed values: orderColA partitioned by colA (ordered by colB), and vice
    // versa — a deterministic initial arrangement per FK group.
    this.pushPartitionedOrder(source, dbDriver, tnPath, {
      orderCol: orderColA.column_name,
      partCol: colA.column_name,
      sortCol: colB.column_name,
      keyA: colA.column_name,
      keyB: colB.column_name,
    });
    this.pushPartitionedOrder(source, dbDriver, tnPath, {
      orderCol: orderColB.column_name,
      partCol: colB.column_name,
      sortCol: colA.column_name,
      keyA: colA.column_name,
      keyB: colB.column_name,
    });

    // Composite (fk, order) indexes — one per direction.
    source.upgraderQueries.push(
      dbDriver
        .raw(`CREATE INDEX ?? ON ?? (??, ??)`, [
          `nc_lo_a_${model.id}`,
          tnPath,
          colA.column_name,
          orderColA.column_name,
        ])
        .toQuery(),
    );
    source.upgraderQueries.push(
      dbDriver
        .raw(`CREATE INDEX ?? ON ?? (??, ??)`, [
          `nc_lo_b_${model.id}`,
          tnPath,
          colB.column_name,
          orderColB.column_name,
        ])
        .toQuery(),
    );

    // Wire the order-column ids onto each relation row, per the invariant:
    // fk_mm_child_order_column_id groups by fk_mm_child_column_id, and
    // fk_mm_parent_order_column_id groups by fk_mm_parent_column_id.
    for (const rel of relations) {
      const childOrderId =
        rel.fk_mm_child_column_id === colA.id ? insertedA.id : insertedB.id;
      const parentOrderId =
        rel.fk_mm_parent_column_id === colA.id ? insertedA.id : insertedB.id;
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_RELATIONS,
        {
          fk_mm_child_order_column_id: childOrderId,
          fk_mm_parent_order_column_id: parentOrderId,
        },
        { fk_column_id: rel.fk_column_id },
      );
      await NocoCache.del(
        context,
        `${CacheScope.COL_RELATION}:${rel.fk_column_id}`,
      );
    }

    await this.updateModelStatus(ncMeta, modelId, true);

    const realDbDriver = await NcConnectionMgrv2.get(
      new Source({ ...source, upgraderMode: false } as any),
    );
    await Upgrader.flushSourceQueries(source, realDbDriver);
    await ncMeta.runUpgraderQueries();
  }

  private pushPartitionedOrder(
    source: Source,
    dbDriver: CustomKnex,
    tnPath: string,
    p: {
      orderCol: string;
      partCol: string;
      sortCol: string;
      keyA: string;
      keyB: string;
    },
  ) {
    const params = {
      mysql2: [
        tnPath,
        p.keyA,
        p.keyB,
        p.partCol,
        p.sortCol,
        tnPath,
        p.keyA,
        p.keyA,
        p.keyB,
        p.keyB,
        p.orderCol,
      ],
      pg: [
        tnPath,
        p.orderCol,
        p.keyA,
        p.keyB,
        p.partCol,
        p.sortCol,
        tnPath,
        p.keyA,
        p.keyA,
        p.keyB,
        p.keyB,
      ],
      sqlite3: [
        p.keyA,
        p.keyB,
        p.partCol,
        p.sortCol,
        tnPath,
        tnPath,
        p.orderCol,
        p.keyA,
        tnPath,
        p.keyA,
        p.keyB,
        tnPath,
        p.keyB,
      ],
    };
    source.upgraderQueries.push(
      dbDriver.raw(partitionedOrderSql[source.type], params[source.type]).toQuery(),
    );
  }

  private getModelsQuery(ncMeta: MetaService) {
    return ncMeta
      .knexConnection(MetaTable.MODELS)
      .select([
        `${MetaTable.MODELS}.id`,
        'source_id',
        `${MetaTable.MODELS}.base_id`,
        `${MetaTable.MODELS}.fk_workspace_id`,
      ])
      .where(`${MetaTable.MODELS}.mm`, true)
      .join(
        MetaTable.SOURCES,
        `${MetaTable.MODELS}.source_id`,
        '=',
        `${MetaTable.SOURCES}.id`,
      )
      .where((builder) => {
        builder.where(`${MetaTable.SOURCES}.is_meta`, true);
        builder.orWhere({ is_local: true });
      })
      .whereNotIn(
        `${MetaTable.MODELS}.id`,
        ncMeta.knexConnection(TEMP_TABLE).select('fk_model_id'),
      )
      .whereNotIn(
        `${MetaTable.MODELS}.id`,
        this.processingModels.map((m) => m.fk_model_id),
      )
      .orderBy(`${MetaTable.MODELS}.source_id`)
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
