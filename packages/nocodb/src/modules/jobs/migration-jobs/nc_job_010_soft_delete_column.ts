import { Injectable, Logger } from '@nestjs/common';
import debug from 'debug';
import PQueue from 'p-queue';
import {
  isDeletedCol,
  UITypes,
  VIEW_GRID_DEFAULT_WIDTH,
  ViewTypes,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type CustomKnex from '~/db/CustomKnex';
import { Column, Model, Source } from '~/models';
import { MetaTable } from '~/utils/globals';
import SimpleLRUCache from '~/utils/cache';
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
import { META_COL_NAME } from '~/constants';

// View-type → view-column table mapping for direct queued inserts, bypassing
// {Grid,Form,...}ViewColumn.insert which each do 3-4 live meta-DB reads
// (metaGetNextOrder, View.get for source_id + clearSingleQueryCache, return
// this.get) that we don't need in a migration. System columns are hidden in
// UI so ordering / visibility / width don't matter semantically.
const VIEW_TYPE_TO_COLUMN_TABLE: Partial<Record<ViewTypes, MetaTable>> = {
  [ViewTypes.GRID]: MetaTable.GRID_VIEW_COLUMNS,
  [ViewTypes.GALLERY]: MetaTable.GALLERY_VIEW_COLUMNS,
  [ViewTypes.KANBAN]: MetaTable.KANBAN_VIEW_COLUMNS,
  [ViewTypes.MAP]: MetaTable.MAP_VIEW_COLUMNS,
  [ViewTypes.CALENDAR]: MetaTable.CALENDAR_VIEW_COLUMNS,
  [ViewTypes.TIMELINE]: MetaTable.TIMELINE_VIEW_COLUMNS,
  [ViewTypes.FORM]: MetaTable.FORM_VIEW_COLUMNS,
  [ViewTypes.LIST]: MetaTable.LIST_VIEW_COLUMNS,
};

const PARALLEL_LIMIT =
  +process.env.NC_SOFT_DELETE_MIGRATION_PARALLEL_LIMIT || 10;
// TODO: Drop nc_temp_processed_soft_delete after migration is confirmed complete across all deployments
const TEMP_TABLE = 'nc_temp_processed_soft_delete';

const propsByClientType = {};

const memoizedGetColumnPropsFromUIDT = async (
  source: Source,
  uidt: UITypes,
  column_name: string,
) => {
  const cacheKey = `${source.type}:${uidt}`;

  if (!propsByClientType[cacheKey]) {
    propsByClientType[cacheKey] = await getColumnPropsFromUIDT(
      {
        uidt,
        column_name,
        title: column_name,
      },
      source,
    );
  }

  return propsByClientType[cacheKey];
};

@Injectable()
export class SoftDeleteColumnMigration {
  private readonly debugLog = debug('nc:migration-jobs:soft-delete-column');
  private readonly logger = new Logger(SoftDeleteColumnMigration.name);
  private readonly log = (...msgs: string[]) =>
    this.logger.log(`${msgs.join(' ')}`);

  private processingModels = [
    { fk_model_id: '__sentinel__', processing: true },
  ];
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

    // Remove incomplete models from previous run
    await Noco.ncMeta
      .knexConnection(TEMP_TABLE)
      .delete()
      .where('completed', false);

    // Reset processed models count
    this.processingModels = [{ fk_model_id: '__sentinel__', processing: true }];
    this.processedModelsCount = 0;

    // Clear cache
    this.cache.clear();

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
            builder.orWhere({ is_local: true });
          })
          .whereNotExists((qb) =>
            qb
              .select(1)
              .from(TEMP_TABLE)
              .whereRaw(`${TEMP_TABLE}.fk_model_id = ${MetaTable.MODELS}.id`),
          )
          .count('*', { as: 'count' })
          .first()
      )?.count;

      this.log(
        `Found ${numberOfModelsToBeProcessed} models to process for soft delete + meta column`,
      );

      // SQLite in scope → force serial; otherwise use PARALLEL_LIMIT.
      const hasSqlite = !!(await ncMeta
        .knexConnection(MetaTable.SOURCES)
        .where('type', 'sqlite3')
        .where((b) => b.where('is_meta', true).orWhere({ is_local: true }))
        .first());
      const concurrency = hasSqlite ? 1 : PARALLEL_LIMIT;
      this.log(`Concurrency: ${concurrency}`);

      const wrapper = async (model: {
        id: string;
        source_id: string;
        fk_workspace_id?: string;
        base_id: string;
      }) => {
        try {
          await this.processModel(model, ncMeta);
        } catch (e) {
          this.logger.error(
            `Error processing model ${model.id}: ${e.message}`,
            e.stack,
          );
          await this.updateModelStatus(Noco.ncMeta, model.id, false, e.message);
        } finally {
          const item = this.processingModels.find(
            (m) => m.fk_model_id === model.id,
          );

          if (item) {
            item.processing = false;
          }

          this.processedModelsCount++;
          this.log(
            `Processed ${this.processedModelsCount} of ${numberOfModelsToBeProcessed} models`,
          );
        }
      };

      const queue = new PQueue({ concurrency });

      // eslint-disable-next-line no-constant-condition
      while (true) {
        // PQueue.pending is capped at concurrency; waiting tasks accumulate
        // in .size. Guard on size to actually bound unprocessed backlog.
        if (queue.size > concurrency * 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        this.processingModels = this.processingModels.filter(
          (m) => m.processing,
        );

        const models = await this.getModelsQuery(ncMeta, concurrency);

        if (!models?.length) break;

        const processModels = models.splice(0);

        for (const model of processModels) {
          this.processingModels.push({
            fk_model_id: model.id,
            processing: true,
          });

          queue
            .add(() => wrapper(model))
            .catch((e) => {
              this.logger.error(
                `Error processing model ${model.fk_model_id}: ${e.message}`,
                e.stack,
              );
            });
        }
      }

      await queue.onIdle();

      await ncMeta.disableUpgraderMode();

      const [seconds] = process.hrtime(totalHrTime);
      this.log(`Migration job completed in ${seconds}s`);

      return true;
    } catch (error) {
      this.logger.error(`Migration failed: ${error.message}`, error.stack);
      await ncMeta.disableUpgraderMode();
      return false;
    }
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

    const originalSource = await this.cache.get(source_id, async () =>
      Source.get(context, source_id),
    );

    if (!originalSource || !originalSource.isMeta()) {
      await this.updateModelStatus(Noco.ncMeta, modelId, true);
      return;
    }

    const source = new Source({
      ...originalSource,
      upgraderMode: true,
      upgraderQueries: [],
    });

    source.upgraderMode = true;

    const dbDriver: CustomKnex = await NcConnectionMgrv2.get(source);

    // Skip Model.get — getModelsQuery already pre-fetched id, source_id,
    // base_id, fk_workspace_id, and table_name.
    const model: any = {
      id: modelData.id,
      source_id: modelData.source_id,
      base_id: modelData.base_id,
      fk_workspace_id: modelData.fk_workspace_id,
      table_name: (modelData as any).table_name,
      columns: [] as Column[],
    };

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      source,
      dbDriver,
    });

    // Load columns with a single SELECT — skips the N+1 getColOptions fetch
    // that model.getColumns() would run per LTAR/Lookup/Select/Formula col.
    const columnRows = await ncMeta
      .knexConnection(MetaTable.COLUMNS)
      .where('fk_workspace_id', context.workspace_id)
      .where('base_id', context.base_id)
      .where('fk_model_id', model.id)
      .select('*');
    model.columns = columnRows.map((c: any) => {
      if (c.meta && typeof c.meta === 'string') {
        try {
          c.meta = JSON.parse(c.meta);
        } catch {
          /* leave as-is */
        }
      }
      return new Column(c);
    });

    const tnPath = baseModel.getTnPath(model.table_name);

    const sqlMgr = ProjectMgrv2.getSqlMgr(
      context,
      { id: source.base_id },
      ncMeta,
    );

    const v1OoFkColIds = new Set<string>();
    const ltarCandidates = model.columns.filter(
      (c) => c.uidt === UITypes.LinkToAnotherRecord && c.meta?.bt,
    );
    if (ltarCandidates.length > 0) {
      const fkCols = await ncMeta
        .knexConnection(`${MetaTable.COL_RELATIONS} as rel`)
        .join(`${MetaTable.COLUMNS} as col`, 'col.id', 'rel.fk_child_column_id')
        .where('rel.fk_workspace_id', context.workspace_id)
        .where('rel.base_id', context.base_id)
        .whereIn(
          'rel.fk_column_id',
          ltarCandidates.map((c) => c.id),
        )
        .where('rel.type', 'oo')
        .whereRaw('rel.version IS DISTINCT FROM ?', [2])
        .where('col.fk_workspace_id', context.workspace_id)
        .where('col.base_id', context.base_id)
        .where('col.fk_model_id', model.id)
        .where('col.unique', true)
        .select('col.id');

      for (const fkCol of fkCols) {
        v1OoFkColIds.add(fkCol.id);
      }
    }

    const needsDeletedCol = !model.columns.find((c) => isDeletedCol(c));
    const needsMetaCol =
      isEE &&
      source.type === 'pg' &&
      !model.columns.find((c) => c.uidt === UITypes.Meta);
    const needsOoUniqueDrop = v1OoFkColIds.size > 0;

    // Check if any user-set unique columns need to be converted to partial unique indexes.
    // This handles tables that already have __nc_deleted but still have regular unique constraints.
    // Exclude PK and auto-increment columns — their unique constraints must stay unconditional.
    const hasUniqueColumns = model.columns.some(
      (c) => c.unique && !v1OoFkColIds.has(c.id) && !c.pk && !c.ai,
    );
    const needsUniqueConversion = hasUniqueColumns && !needsDeletedCol;

    if (
      !needsDeletedCol &&
      !needsMetaCol &&
      !needsOoUniqueDrop &&
      !needsUniqueConversion
    ) {
      await this.updateModelStatus(Noco.ncMeta, modelId, true);
      return;
    }

    let newDeletedColumn: any;
    let newMetaColumn: any;

    // For columns whose unique constraint needs to be recreated as a partial index,
    // set unique: false on the original so PgClient sees a false→true transition.
    // Exclude PK and auto-increment columns — their unique constraints must stay unconditional.
    const needsUniqueRecreate = (c: Column) =>
      (needsDeletedCol || needsUniqueConversion) &&
      c.unique &&
      !v1OoFkColIds.has(c.id) &&
      !c.pk &&
      !c.ai;

    const originalColumns = model.columns.map((c) => ({
      ...c,
      cn: c.column_name,
      ...(needsUniqueRecreate(c) ? { unique: false } : {}),
    }));

    const existingColumns = model.columns.map((c) => ({
      ...c,
      cn: c.column_name,
      cno: c.column_name,
      ...(v1OoFkColIds.has(c.id)
        ? { altered: Altered.UPDATE_COLUMN, unique: false }
        : // Re-process existing unique columns so PgClient recreates them as
        // partial unique indexes that exclude soft-deleted rows
        needsUniqueRecreate(c)
        ? { altered: Altered.UPDATE_COLUMN }
        : {}),
    }));

    // PgClient.tableUpdate emits SQL in column order, and partial unique
    // indexes on existing columns reference __nc_deleted in their WHERE
    // predicate — so NEW_COLUMN additions must come before UPDATE_COLUMN edits.
    const newColumns: any[] = [];

    if (needsDeletedCol) {
      newDeletedColumn = {
        ...(await memoizedGetColumnPropsFromUIDT(
          source,
          UITypes.Deleted,
          '__nc_deleted',
        )),
        column_name: getUniqueColumnName(model.columns, '__nc_deleted'),
        title: getUniqueColumnAliasName(model.columns, '__nc_deleted'),
        cdf:
          source.type === 'mysql2' ||
          source.type === 'mysql' ||
          source.type === 'sqlite3'
            ? '0'
            : 'false',
        system: true,
        altered: Altered.NEW_COLUMN,
      };
      newColumns.push({
        ...newDeletedColumn,
        cn: newDeletedColumn.column_name,
      });
    }

    if (needsMetaCol) {
      newMetaColumn = {
        ...(await memoizedGetColumnPropsFromUIDT(
          source,
          UITypes.Meta,
          META_COL_NAME,
        )),
        column_name: getUniqueColumnName(model.columns, META_COL_NAME),
        title: getUniqueColumnAliasName(model.columns, META_COL_NAME),
        system: true,
        altered: Altered.NEW_COLUMN,
      };
      newColumns.push({ ...newMetaColumn, cn: newMetaColumn.column_name });
    }

    const columns = [...newColumns, ...existingColumns];

    await sqlMgr.sqlOpPlus(source, 'tableUpdate', {
      ...model,
      tn: model.table_name,
      originalColumns,
      columns,
    });

    if (needsDeletedCol && newDeletedColumn) {
      const idxName = `nc_deleted_idx_${model.id}`;
      source.upgraderQueries.push(
        dbDriver
          .raw(`CREATE INDEX ?? ON ?? (??)`, [
            idxName,
            tnPath,
            newDeletedColumn.column_name,
          ])
          .toQuery(),
      );
    }

    const realDbDriver = await NcConnectionMgrv2.get(
      new Source({ ...originalSource, upgraderMode: false } as any),
    );

    await Upgrader.flushSourceQueries(source, realDbDriver);

    // Fast path: insert nc_columns_v2 row + all view-column rows as direct
    // queued metaInsert2 calls. Bypasses Column.insert / {Grid,Form,…}ViewColumn.insert
    // which each do 3-4 live meta-DB reads per call (metaGetNextOrder, View.get
    // for source_id / cache clear, return this.get). Since these are system
    // columns (system: true, hidden in UI regardless), ordering / visibility /
    // width don't matter semantically — we pick sane defaults instead of
    // reading the DB for them.
    //
    // Pre-fetch views + list-view levels ONCE (shared across both columns).
    // Both writes are then queued in the upgrader queue and flushed in a
    // single transaction.
    const [views, listViewLevels] = await Promise.all([
      ncMeta
        .knexConnection(MetaTable.VIEWS)
        .where('fk_workspace_id', context.workspace_id)
        .where('base_id', context.base_id)
        .where('fk_model_id', model.id)
        .select('id', 'type', 'source_id'),
      // LIST view-column rows need fk_level_id; fetch levels matching our model.
      ncMeta
        .knexConnection(MetaTable.LIST_VIEW_LEVELS)
        .where('fk_workspace_id', context.workspace_id)
        .where('base_id', context.base_id)
        .where('fk_model_id', model.id)
        .select('id', 'fk_view_id'),
    ]);
    const listLevelByViewId = new Map<string, string>(
      listViewLevels.map((l: any) => [l.fk_view_id, l.id]),
    );

    let columnOrderBase = (model.columns?.length ?? 0) + 1;

    // Queue both inserts: nc_columns_v2 row + one view-column row per view.
    // System columns default to show=false (hidden in UI regardless), order
    // appended to the end, grid width = default.
    const queuedWrites: Promise<any>[] = [];

    // Allowlist of real nc_columns_v2 columns (mirrors Column.insert's
    // extractProps). newCol carries migration-internal fields like `altered`
    // that must NOT be forwarded to the SQL INSERT.
    const NC_COLUMNS_V2_FIELDS = [
      'id',
      'fk_model_id',
      'column_name',
      'title',
      'uidt',
      'dt',
      'np',
      'ns',
      'clen',
      'cop',
      'pk',
      'rqd',
      'un',
      'ct',
      'ai',
      'unique',
      'cdf',
      'cc',
      'csn',
      'dtx',
      'dtxp',
      'dtxs',
      'au',
      'pv',
      'order',
      'base_id',
      'source_id',
      'system',
      'meta',
      'internal_meta',
      'virtual',
      'description',
      'readonly',
    ] as const;

    const queueSystemColumn = (newCol: any, order: number) => {
      // nc_columns_v2 row. metaInsert2 generates the id via genNanoid and
      // returns it; the view-column rows chain off that id.
      const metaVal =
        newCol.meta && typeof newCol.meta === 'object'
          ? JSON.stringify(newCol.meta)
          : newCol.meta;
      const columnInsertObj: Record<string, any> = {
        fk_model_id: model.id,
        source_id,
        system: true,
        order,
      };
      for (const k of NC_COLUMNS_V2_FIELDS) {
        if (
          k === 'fk_model_id' ||
          k === 'source_id' ||
          k === 'system' ||
          k === 'order' ||
          k === 'meta'
        )
          continue;
        if (newCol[k] !== undefined) columnInsertObj[k] = newCol[k];
      }
      if (metaVal !== undefined) columnInsertObj.meta = metaVal;

      queuedWrites.push(
        ncMeta
          .metaInsert2(
            context.workspace_id,
            context.base_id,
            MetaTable.COLUMNS,
            columnInsertObj,
          )
          .then(async (row) => {
            const insertedColId = row.id;
            // Group view-column rows by target table, then emit ONE multi-row
            // INSERT per table. Bypasses metaInsert2's per-row wire statement
            // in favor of a single `INSERT … VALUES (...), (...), (...)`
            const byTable = new Map<MetaTable, any[]>();
            const now = new Date();
            for (const view of views) {
              const table = VIEW_TYPE_TO_COLUMN_TABLE[view.type as ViewTypes];
              if (!table) continue;
              const rowObj: Record<string, any> = {
                id: await ncMeta.genNanoid(table),
                fk_workspace_id: context.workspace_id,
                base_id: context.base_id,
                fk_view_id: view.id,
                fk_column_id: insertedColId,
                source_id: view.source_id,
                show: false,
                order,
                created_at: now,
                updated_at: now,
              };
              if (view.type === ViewTypes.GRID) {
                rowObj.width = VIEW_GRID_DEFAULT_WIDTH + 'px';
              }
              if (view.type === ViewTypes.LIST) {
                const levelId = listLevelByViewId.get(view.id);
                if (levelId) rowObj.fk_level_id = levelId;
              }
              const list = byTable.get(table) ?? [];
              list.push(rowObj);
              byTable.set(table, list);
            }
            for (const [table, rows] of byTable) {
              if (!rows.length) continue;
              const sql = ncMeta.knexConnection(table).insert(rows).toQuery();
              ncMeta.pushUpgraderQuery(sql);
            }
          }),
      );
    };

    if (needsDeletedCol && newDeletedColumn) {
      queueSystemColumn(newDeletedColumn, columnOrderBase++);
    }

    if (needsMetaCol && newMetaColumn) {
      queueSystemColumn(newMetaColumn, columnOrderBase++);
    }
    if (queuedWrites.length) await Promise.all(queuedWrites);

    for (const fkColId of v1OoFkColIds) {
      await Column.update(context, fkColId, { unique: false }, ncMeta);
    }

    await ncMeta.runUpgraderQueries();

    await this.updateModelStatus(Noco.ncMeta, modelId, true);
  }

  private getModelsQuery(ncMeta: MetaService, concurrency: number) {
    return (
      ncMeta
        .knexConnection(MetaTable.MODELS)
        .select([
          `${MetaTable.MODELS}.id`,
          'source_id',
          `${MetaTable.MODELS}.base_id`,
          `${MetaTable.MODELS}.fk_workspace_id`,
          `${MetaTable.MODELS}.table_name`,
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
          builder.orWhere({ is_local: true });
        })
        // NOT EXISTS instead of NOT IN (subquery). At large temp-table
        // sizes (200k+), PG's NOT IN planner choked into 10+ minute
        // anti-joins; NOT EXISTS plans cleanly against the fk_model_id index.
        .whereNotExists((qb) =>
          qb
            .select(1)
            .from(TEMP_TABLE)
            .whereRaw(`${TEMP_TABLE}.fk_model_id = ${MetaTable.MODELS}.id`),
        )
        .whereNotIn(
          `${MetaTable.MODELS}.id`,
          this.processingModels.map((m) => m.fk_model_id),
        )
        .limit(concurrency * 10)
    );
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
