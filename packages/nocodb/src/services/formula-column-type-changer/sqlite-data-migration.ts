import { ClientType } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Column, FormulaColumn } from '~/models';
import type { FormulaDataMigrationDriver } from '~/services/formula-column-type-changer/index';
import { ROOT_ALIAS } from '~/utils';
import { _wherePk } from '~/helpers/dbHelpers';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';

/*
 result from formula qb:
knex.raw(qb.builder).wrap('(',')').toSQL().toNative().sql
(select (CONCAT("Text1","Text2") as myColumn) from "p4oi1n99ziywqze"."formula-parent" where "p4oi1n99ziywqze"."formula-parent"."id" = "__nc_root"."formula-parent_id")
*/

export class SqliteDataMigration implements FormulaDataMigrationDriver {
  constructor() {
    this.dbDriverName = ClientType.SQLITE;
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
    const idOffsetTableAlias = 'id_offset_tbl';
    const formulaValueTableAlias = 'formula_value_tbl';

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
        idOffsetTableAlias,
      ),
    )
      .select(getPrimaryKeySelectColumns(idOffsetTableAlias))
      .whereRaw(
        Object.keys(getPrimaryKeySelectColumns())
          .map(() => '?? = ??')
          .join(' and '),
        Object.keys(getPrimaryKeySelectColumns()).reduce(
          (arr, primaryColName) => {
            arr.push(`${ROOT_ALIAS}.${primaryColName}`);
            arr.push(`${idOffsetTableAlias}.${primaryColName}`);
            return arr;
          },
          [],
        ),
      )
      .orderBy(getPrimaryKeySortColumns(idOffsetTableAlias))
      .limit(limit)
      .offset(offset);

    const formulaValueTable = knex(
      baseModelSqlV2.getTnPath(
        baseModelSqlV2.model.table_name,
        formulaValueTableAlias,
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
      })
      .whereRaw(
        Object.keys(getPrimaryKeySelectColumns())
          .map(() => '?? = ??')
          .join(' and '),
        Object.keys(getPrimaryKeySelectColumns()).reduce(
          (arr, primaryColName) => {
            arr.push(`${ROOT_ALIAS}.${primaryColName}`);
            arr.push(`${formulaValueTableAlias}.${primaryColName}`);
            return arr;
          },
          [],
        ),
      );

    // knex qb is not yet suppport update select / update join
    // so we need to compose them manually (sad)
    const qb = knex.raw(`update ?? set ?? = (??) where exists (??)`, [
      baseModelSqlV2.getTnPath(baseModelSqlV2.model, ROOT_ALIAS),
      knex.raw(knex.ref(destinationColumn.column_name)),
      knex.raw(formulaValueTable),
      knex.raw(idOffsetTable),
    ]);
    await baseModelSqlV2.execAndParse(qb.toQuery(), null, {
      raw: true,
    });
  }
}
