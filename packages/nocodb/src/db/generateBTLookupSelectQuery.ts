import { RelationTypes, UITypes } from 'nocodb-sdk';
import type LookupColumn from '../models/LookupColumn';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type {
  Column,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  Model,
  RollupColumn,
} from '~/models';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { NcError } from '~/helpers/catchError';

export default async function generateBTLookupSelectQuery({
  column,
  baseModelSqlv2,
  alias,
  model,
}: {
  column: Column;
  baseModelSqlv2: BaseModelSqlv2;
  alias: string;
  model: Model;
}): Promise<any> {
  const knex = baseModelSqlv2.dbDriver;

  const rootAlias = alias;

  {
    let aliasCount = 0,
      selectQb;
    const alias = `__nc_lk_${aliasCount++}`;
    const lookup = await column.getColOptions<LookupColumn>();
    {
      const relationCol = await lookup.getRelationColumn();
      const relation =
        await relationCol.getColOptions<LinkToAnotherRecordColumn>();

      // if not belongs to then throw error as we don't support
      if (relation.type !== RelationTypes.BELONGS_TO)
        NcError.badRequest('HasMany/ManyToMany lookup is not supported');

      const childColumn = await relation.getChildColumn();
      const parentColumn = await relation.getParentColumn();
      const childModel = await childColumn.getModel();
      await childModel.getColumns();
      const parentModel = await parentColumn.getModel();
      await parentModel.getColumns();

      selectQb = knex(
        `${baseModelSqlv2.getTnPath(parentModel.table_name)} as ${alias}`,
      ).where(
        `${alias}.${parentColumn.column_name}`,
        knex.raw(`??`, [
          `${rootAlias || baseModelSqlv2.getTnPath(childModel.table_name)}.${
            childColumn.column_name
          }`,
        ]),
      );
    }
    let lookupColumn = await lookup.getLookupColumn();
    let prevAlias = alias;
    while (lookupColumn.uidt === UITypes.Lookup) {
      const nestedAlias = `__nc_lk_nested_${aliasCount++}`;
      const nestedLookup = await lookupColumn.getColOptions<LookupColumn>();
      const relationCol = await nestedLookup.getRelationColumn();
      const relation =
        await relationCol.getColOptions<LinkToAnotherRecordColumn>();

      // if any of the relation in nested lookup is
      // not belongs to then throw error as we don't support
      if (relation.type !== RelationTypes.BELONGS_TO)
        NcError.badRequest('HasMany/ManyToMany lookup is not supported');

      const childColumn = await relation.getChildColumn();
      const parentColumn = await relation.getParentColumn();
      const childModel = await childColumn.getModel();
      await childModel.getColumns();
      const parentModel = await parentColumn.getModel();
      await parentModel.getColumns();

      selectQb.join(
        `${baseModelSqlv2.getTnPath(parentModel.table_name)} as ${nestedAlias}`,
        `${nestedAlias}.${parentColumn.column_name}`,
        `${prevAlias}.${childColumn.column_name}`,
      );

      lookupColumn = await nestedLookup.getLookupColumn();
      prevAlias = nestedAlias;
    }

    switch (lookupColumn.uidt) {
      case UITypes.Links:
      case UITypes.Rollup:
        {
          const builder = (
            await genRollupSelectv2({
              baseModelSqlv2,
              knex,
              columnOptions:
                (await lookupColumn.getColOptions()) as RollupColumn,
              alias: prevAlias,
            })
          ).builder;
          selectQb.select(builder);
        }
        break;
      case UITypes.LinkToAnotherRecord:
        {
          const nestedAlias = `__nc_sort${aliasCount++}`;
          const relation =
            await lookupColumn.getColOptions<LinkToAnotherRecordColumn>();
          if (relation.type !== 'bt') return;

          const colOptions =
            (await column.getColOptions()) as LinkToAnotherRecordColumn;
          const childColumn = await colOptions.getChildColumn();
          const parentColumn = await colOptions.getParentColumn();
          const childModel = await childColumn.getModel();
          await childModel.getColumns();
          const parentModel = await parentColumn.getModel();
          await parentModel.getColumns();

          selectQb
            .join(
              `${baseModelSqlv2.getTnPath(
                parentModel.table_name,
              )} as ${nestedAlias}`,
              `${nestedAlias}.${parentColumn.column_name}`,
              `${prevAlias}.${childColumn.column_name}`,
            )
            .select(parentModel?.displayValue?.column_name);
        }
        break;
      case UITypes.Formula:
        {
          const builder = (
            await formulaQueryBuilderv2(
              baseModelSqlv2,
              (
                await column.getColOptions<FormulaColumn>()
              ).formula,
              null,
              model,
              column,
            )
          ).builder;

          selectQb.select(builder);
        }
        break;
      default:
        {
          selectQb.select(`${prevAlias}.${lookupColumn.column_name}`);
        }

        break;
    }

    return { builder: selectQb };
  }
}
