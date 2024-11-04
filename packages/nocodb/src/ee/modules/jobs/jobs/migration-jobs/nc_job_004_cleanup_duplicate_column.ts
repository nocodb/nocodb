import debug from 'debug';
import { Injectable } from '@nestjs/common';
import Noco from '~/Noco';
import { ThumbnailGeneratorProcessor } from '~/modules/jobs/jobs/thumbnail-generator/thumbnail-generator.processor';

// Old column list query was returning duplicate columns due to a bug in the query.
// This upgrader will remove the duplicates and keep only one column.
// Also handle the migration of filters associated with the duplicate columns.
// If column type mismatch is found, it will extract proer type using the sqlClient
@Injectable()
export class CleanupDuplicateColumnMigration {
  private readonly debugLog = debug(
    'nc:migration-jobs:cleanup-duplicate-column',
  );

  constructor(
    private readonly thumbnailGeneratorProcessor: ThumbnailGeneratorProcessor,
  ) {}

  log = (...msgs: string[]) => {
    console.log('[nc_job_004_cleanup_duplicate_column]: ', ...msgs);
  };

  async job() {
    // start transaction
    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      const migrateFilters = ({
        ncMeta,
        columnIds,
        newColumnId,
      }: {
        ncMeta: MetaService;
        columnIds: string[];
        newColumnId: string;
        modelId: string;
      }) => {
        return ncMeta
          .knex(MetaTable.FILTER_EXP)
          .whereIn('fk_column_id', columnIds)
          .update({ fk_column_id: newColumnId });
      };

      const migrateSorts = ({
        ncMeta,
        columnIds,
        newColumnId,
      }: {
        ncMeta: MetaService;
        columnIds: string[];
        newColumnId: string;
        modelId: string;
      }) => {
        return ncMeta
          .knex(MetaTable.SORT)
          .whereIn('fk_column_id', columnIds)
          .update({ fk_column_id: newColumnId });
      };

      export default async function ({ ncMeta }: NcUpgraderCtx) {
        // check if postgres client
        if (ncMeta.knex.clientType !== 'pg') {
          return;
        }

        // get columns with duplicate names
        const columns = await ncMeta
          .knex(MetaTable.COLUMNS)
          .select(
            'c.column_name',
            'c.fk_model_id',
            'c.source_id',
            'c.base_id',
            's.fk_workspace_id',
          )
          .groupby(
            'c.column_name',
            'c.fk_model_id',
            'c.source_id',
            'c.base_id',
            's.fk_workspace_id',
          )

          .innerJoin(`${MetaTable.BASES} as b`, 'b.id', 'c.source_id')
          .having(ncMeta.knex.raw('count(id) > 1'));

        // loop through columns
        for (const column of columns) {
          const { column_name, fk_model_id } = column;

          const context: NcContext = {
            workspace_id: column.fk_workspace_id,
            base_id: column.base_id,
          };

          // get all columns with same name
          const columns = await ncMeta
            .knex(MetaTable.COLUMNS)
            .where('column_name', column_name)
            .where('fk_model_id', fk_model_id);

          const colIds = columns.map((c) => c.id);

          // variable to keep the id of the column which will be kept
          let keepColumnId = colIds[0];

          // array to keep the ids of the columns which will be removed
          let removeColumnIds = colIds.slice(1);

          // check if all columns have same type
          if (new Set(columns.map((c) => c.uidt)).size > 1) {
            const source = await Source.get(
              context,
              column.source_id,
              false,
              ncMeta,
            );
            const model = await Model.get(context, fk_model_id, ncMeta);
            // get sqlClient and extract columnList
            const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
            const columnList = (
              await sqlClient.columnList({
                tn: model.table_name,
                schema: source.getConfig()?.schema,
              })
            )?.data?.list;

            // extract the column uidt from the columnList
            const dbColumn = columnList.find(
              (c) => c.column_name === column_name,
            );

            // extract the column type from the dbColumn
            const uidt = getColumnUiType(source, dbColumn);
            keepColumnId =
              columns.find((c) => c.uidt === uidt)?.id || keepColumnId;
            removeColumnIds = columns
              .filter((c) => c.id !== keepColumnId)
              .map((c) => c.id);
          }

          // migrate all filters to the first column/the one with the correct type
          await migrateFilters({
            ncMeta,
            columnIds: keepColumnId,
            newColumnId: removeColumnIds,
            modelId: fk_model_id,
          });

          await migrateSorts({
            ncMeta,
            columnIds: keepColumnId,
            newColumnId: removeColumnIds,
            modelId: fk_model_id,
          });

          // remove the duplicate columns
          for (const removeColumnId of removeColumnIds) {
            await Column.delete(context, removeColumnId, ncMeta);
          }
        }
      }
      await (await ncMeta).commit();
    } catch (e) {
      await (await ncMeta).rollback(e);
      this.log('Error recovering links', e);
      return false;
    }
    return true;
  }
}
