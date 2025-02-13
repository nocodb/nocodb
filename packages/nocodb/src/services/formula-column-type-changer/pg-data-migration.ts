import { _wherePk } from 'src/helpers/dbHelpers';
import { ROOT_ALIAS } from 'src/utils';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Column, FormulaColumn } from '~/models';
import type { FormulaDataMigrationDriver } from '~/services/formula-column-type-changer/index';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';

/*
 result from formula qb:
knex.raw(qb.builder).wrap('(',')').toSQL().toNative().sql
(select (CONCAT("Text1","Text2") as myColumn) from "p4oi1n99ziywqze"."formula-parent" where "p4oi1n99ziywqze"."formula-parent"."id" = "__nc_root"."formula-parent_id")
*/

export class PgDataMigration implements FormulaDataMigrationDriver {
  dbDriverName: 'pg';

  async migrate({
    baseModelSqlV2,
    formulaColumn,
    destinationColumn,
    formulaColumnOption,
    offset,
    limit,
  }: {
    baseModelSqlV2: BaseModelSqlv2;
    formulaColumn: Column<any>;
    destinationColumn: Column<any>;
    formulaColumnOption: FormulaColumn;
    offset: number;
    limit: number;
  }): Promise<void> {
    const knex = baseModelSqlV2.dbDriver;
    const formulaColumnAlias = '__nc_formula_value';

    const primaryKeySelectColumns =
      await baseModelSqlV2.model.primaryKeys.reduce(
        async (propsPromise, col) => {
          const props = await propsPromise;
          props[await knex.ref(col.column_name)] = await knex.ref(
            col.column_name,
          );
          return props;
        },
        Promise.resolve({}),
      );
    const primaryKeySortColumns = Object.keys(primaryKeySelectColumns).map(
      (colName) => {
        return {
          column: colName,
          order: 'asc',
        };
      },
    );

    const idOffsetTable = knex(
      baseModelSqlV2.getTnPath(
        baseModelSqlV2.model.table_name,
        'id_offset_tbl',
      ),
    )
      .select(primaryKeySelectColumns)
      .orderBy(primaryKeySortColumns)
      .limit(limit)
      .offset(offset);

    const formulaValueTable = knex(
      baseModelSqlV2.getTnPath(
        baseModelSqlV2.model.table_name,
        'formula_value_tbl',
      ),
    ).select({
      [formulaColumnAlias]: await formulaQueryBuilderv2(
        baseModelSqlV2,
        formulaColumnOption.formula_raw,
        undefined,
        baseModelSqlV2.model,
        formulaColumn,
        {},
        undefined,
        false,
        formulaColumnOption.getParsedTree,
        undefined,
      ),
      ...primaryKeySelectColumns,
    });

    await knex(
      baseModelSqlV2.getTnPath(baseModelSqlV2.model.table_name, ROOT_ALIAS),
    )
      .update(
        await knex.ref(destinationColumn.column_name),
        await knex.ref(`${formulaColumnAlias}`),
      )
      .from(
        idOffsetTable.innerJoin(formulaValueTable, function () {
          for (const primaryColName of Object.keys(primaryKeySelectColumns)) {
            this.on(
              `id_offset_tbl.${primaryColName}`,
              '=',
              `formula_value_tbl.${primaryColName}`,
            );
          }
        }),
      )
      .where(function () {
        for (const primaryColName of Object.keys(primaryKeySelectColumns)) {
          this.where(
            `${ROOT_ALIAS}.${primaryColName}`,
            '=',
            `id_offset_tbl.${primaryColName}`,
          );
        }
      });
  }
}
