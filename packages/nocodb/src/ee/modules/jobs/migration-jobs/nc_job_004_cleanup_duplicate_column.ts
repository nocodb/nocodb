import debug from 'debug';
import { Injectable } from '@nestjs/common';
import { UITypes } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { Column, Model, Source } from '~/models';
import { MetaTable } from '~/utils/globals';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import getColumnUiType from '~/helpers/getColumnUiType';

// Old column list query was returning duplicate columns due to a bug in the query.
// This upgrader will remove the duplicates and keep only one column.
// Also handle the migration of filters associated with the duplicate columns.
// If column type mismatch is found, it will extract proer type using the sqlClient
@Injectable()
export class CleanupDuplicateColumnMigration {
  private readonly debugLog = debug(
    'nc:migration-jobs:cleanup-duplicate-column',
  );

  constructor() {}

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
        this.log(`Migrating filters of columns ${columnIds} => ${newColumnId}`);
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
        this.log(`Migrating sorts of columns ${columnIds} => ${newColumnId}`);
        return ncMeta
          .knex(MetaTable.SORT)
          .whereIn('fk_column_id', columnIds)
          .update({ fk_column_id: newColumnId });
      };

      // get columns with duplicate names
      const columns = await ncMeta
        .knex(`${MetaTable.COLUMNS} as c`)
        .select(
          'c.column_name',
          'c.fk_model_id',
          'c.source_id',
          'c.base_id',
          's.fk_workspace_id',
        )
        .count('c.id as count')
        .groupBy(
          'c.column_name',
          'c.fk_model_id',
          'c.source_id',
          'c.base_id',
          's.fk_workspace_id',
        )
        .where((qb) => {
          qb.where('s.is_local', false);
          qb.orWhereNull('s.is_local');
        })
        .where((qb) => {
          qb.where('s.is_meta', false);
          qb.orWhereNull('s.is_meta');
        })
        .whereNotIn(`c.uidt`, [
          UITypes.Formula,
          UITypes.Lookup,
          UITypes.LinkToAnotherRecord,
          UITypes.Links,
          UITypes.Rollup,
          UITypes.CreatedTime,
          UITypes.LastModifiedTime,
          UITypes.Button,
          UITypes.Barcode,
          UITypes.QrCode,
          UITypes.GeoData,
          UITypes.CreatedBy,
          UITypes.LastModifiedBy,
        ])
        .innerJoin(`${MetaTable.SOURCES} as s`, 's.id', 'c.source_id')
        .having(ncMeta.knex.raw('count(c.id) > 1'));

      // loop through columns
      for (const column of columns) {
        this.log(`Processing column '${column.column_name}'`);
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
          let columnList = [];

          try {
            // get sqlClient and extract columnList
            const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
            columnList =
              ((
                await sqlClient.columnList({
                  tn: model.table_name,
                  schema: source.getConfig()?.schema,
                })
              )?.data?.list as any[]) || [];
          } catch (e) {
            this.log(
              `Error getting column list, skipping type check for table: ${model.table_name}(ID: ${model.id})`,
            );
          }

          // extract the column uidt from the columnList
          const dbColumn = columnList.find(
            (c) => c.column_name === column_name,
          );

          if (dbColumn) {
            // extract the column type from the dbColumn
            const uidt = getColumnUiType(source, dbColumn);
            keepColumnId =
              columns.find((c) => c.uidt === uidt)?.id || keepColumnId;
            removeColumnIds = columns
              .filter((c) => c.id !== keepColumnId)
              .map((c) => c.id);
          }
        }

        // migrate all filters to the first column/the one with the correct type
        await migrateFilters({
          ncMeta,
          columnIds: removeColumnIds,
          newColumnId: keepColumnId,
          modelId: fk_model_id,
        });

        await migrateSorts({
          ncMeta,
          columnIds: removeColumnIds,
          newColumnId: keepColumnId,
          modelId: fk_model_id,
        });

        // remove the duplicate columns
        for (const removeColumnId of removeColumnIds) {
          this.log(`Removing duplicate column '${removeColumnId}'`);
          await Column.delete(context, removeColumnId, ncMeta);
        }
        this.log(`Column '${keepColumnId}' is kept`);
      }

      await ncMeta.commit();
      this.log('Completed duplicate cleanup');
    } catch (e) {
      await ncMeta.rollback(e);
      this.log('Error recovering links', e);
      return false;
    }
    return true;
  }
}
