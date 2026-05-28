import { ClientType } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Column, FormulaColumn } from '~/models';
import type { FormulaDataMigrationDriver } from '~/services/formula-column-type-changer/index';
import {
  getIdOffsetTable,
  getPrimaryKeySelectColumns,
  getUpdatedRows,
} from '~/services/formula-column-type-changer/data-migration.helper';
import { ROOT_ALIAS } from '~/utils';
import { _wherePk } from '~/helpers/dbHelpers';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';

/*
 Mirrors the PG driver — T-SQL accepts the same
 `UPDATE T SET col = expr FROM (subquery) AS alias WHERE pk = alias.pk`
 shape pg uses, and knex's mssql dialect handles identifier quoting
 (`[name]`) and the OFFSET/FETCH pagination inside `idOffsetTable`
 transparently. Where mssql diverges from pg is purely in how
 `formulaQueryBuilderv2` renders individual formula functions — that
 lives in `functionMappings/mssql.ts`, not here.
*/

export class MssqlDataMigration implements FormulaDataMigrationDriver {
  constructor() {
    this.dbDriverName = ClientType.MSSQL;
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
  }) {
    const knex = baseModelSqlV2.dbDriver;
    const formulaColumnAlias = '__nc_formula_value';
    const idOffsetTableAlias = 'id_offset_tbl';
    const formulaValueTableAlias = 'formula_value_tbl';

    const idOffsetTable = getIdOffsetTable({
      baseModelSqlV2,
      alias: idOffsetTableAlias,
      limit,
      offset,
    });

    const formulaValueTable = knex(
      baseModelSqlV2.getTnPath(
        baseModelSqlV2.model.table_name,
        formulaValueTableAlias,
      ),
    )
      .select({
        [formulaColumnAlias]: (
          await formulaQueryBuilderv2({
            baseModel: baseModelSqlV2,
            tree: formulaColumnOption.formula_raw,
            model: baseModelSqlV2.model,
            column: formulaColumn,
            validateFormula: false,
            tableAlias: formulaValueTableAlias,
            parsedTree: formulaColumnOption.getParsedTree(),
          })
        ).builder,
        ...getPrimaryKeySelectColumns({
          model: baseModelSqlV2.model,
          sourceTable: formulaValueTableAlias,
        }),
      })
      .innerJoin(
        knex.raw(`?? as ${idOffsetTableAlias}`, [
          knex.raw(idOffsetTable).wrap('(', ')'),
        ]),
        function () {
          for (const primaryColName of Object.keys(
            getPrimaryKeySelectColumns({
              model: baseModelSqlV2.model,
            }),
          )) {
            this.on(
              `${idOffsetTableAlias}.${primaryColName}`,
              '=',
              `${formulaValueTableAlias}.${primaryColName}`,
            );
          }
        },
      );

    // knex qb doesn't compose `UPDATE … FROM` natively, so emit raw —
    // same shape as the PG driver because T-SQL accepts identical
    // syntax for this form (`UPDATE T SET col = expr FROM (…) AS alias
    // WHERE T.pk = alias.pk`).
    const qb = knex.raw(`update ?? set ?? = ?? from (??) ?? where ??`, [
      baseModelSqlV2.getTnPath(baseModelSqlV2.model, ROOT_ALIAS),
      knex.raw(knex.ref(destinationColumn.column_name)),
      knex.raw(knex.ref(`${formulaValueTableAlias}.${formulaColumnAlias}`)),
      knex.raw(formulaValueTable),
      knex.raw(`as ${formulaValueTableAlias}`),
      knex.raw(
        baseModelSqlV2.model.primaryKeys
          .map((col) => {
            return (
              knex.ref(`${ROOT_ALIAS}.${col.column_name}`).toQuery() +
              '=' +
              knex.ref(`${formulaValueTableAlias}.${col.column_name}`).toQuery()
            );
          })
          .join(' and '),
      ),
    ]);

    await baseModelSqlV2.execAndParse(qb.toQuery(), null, {
      raw: true,
    });

    return await getUpdatedRows({
      baseModelSqlV2,
      alias: idOffsetTableAlias,
      destinationColumn,
      limit,
      offset,
    });
  }
}
