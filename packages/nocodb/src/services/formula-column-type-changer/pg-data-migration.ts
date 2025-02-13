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
  constructor() {
    this.dbDriverName = 'pg';
  }
  dbDriverName: string;

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

    const getPrimaryKeySelectColumns = (sourceTable?: string) => {
      return baseModelSqlV2.model.primaryKeys.reduce((props, col) => {
        const prefix = sourceTable ? `${sourceTable}.` : '';
        props[col.column_name] = `${prefix}${col.column_name}`;
        return props;
      }, {});
    };
    const getPrimaryKeySortColumns = (sourceTable?: string) =>
      Object.keys(getPrimaryKeySelectColumns(sourceTable)).map((colName) => {
        return {
          column: colName,
          order: 'asc',
        };
      });

    const idOffsetTable = knex(
      baseModelSqlV2.getTnPath(
        baseModelSqlV2.model.table_name,
        'id_offset_tbl',
      ),
    )
      .select(getPrimaryKeySelectColumns('id_offset_tbl'))
      .orderBy(getPrimaryKeySortColumns('id_offset_tbl'))
      .limit(limit)
      .offset(offset);

    const formulaValueTable = knex(
      baseModelSqlV2.getTnPath(
        baseModelSqlV2.model.table_name,
        'formula_value_tbl',
      ),
    )
      .select({
        [formulaColumnAlias]: (
          await formulaQueryBuilderv2(
            baseModelSqlV2,
            formulaColumnOption.formula_raw,
            undefined,
            baseModelSqlV2.model,
            formulaColumn,
            {},
            undefined,
            false,
            formulaColumnOption.getParsedTree(),
            undefined,
          )
        ).builder,
        ...getPrimaryKeySelectColumns('formula_value_tbl'),
      })
      .innerJoin(
        knex.raw('?? as id_offset_tbl', [
          knex.raw(idOffsetTable).wrap('(', ')'),
        ]),
        function () {
          for (const primaryColName of Object.keys(
            getPrimaryKeySelectColumns(),
          )) {
            this.on(
              `id_offset_tbl.${primaryColName}`,
              '=',
              `formula_value_tbl.${primaryColName}`,
            );
          }
        },
      );

    try {
      // knex qb is not yet suppport update select / update join
      // so we need to compose them manually (sad)
      const qb = knex.raw(`update ?? set ?? = ?? from (??) ?? where ??`, [
        baseModelSqlV2.getTnPath(baseModelSqlV2.model, ROOT_ALIAS),
        knex.raw(knex.ref(destinationColumn.column_name)),
        knex.raw(knex.ref(`formula_value_tbl.${formulaColumnAlias}`)),
        knex.raw(formulaValueTable),
        knex.raw('as formula_value_tbl'),
        knex.raw(
          baseModelSqlV2.model.primaryKeys
            .map((col) => {
              return (
                knex.ref(`${ROOT_ALIAS}.${col.column_name}`).toQuery() +
                '=' +
                knex.ref(`formula_value_tbl.${col.column_name}`).toQuery()
              );
            })
            .join(' and '),
        ),
      ]);
      console.log(qb.toQuery());
      await qb;
    } catch (ex) {
      console.log(ex);
      throw ex;
    }
  }
}
