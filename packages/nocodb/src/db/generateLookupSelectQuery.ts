import { RelationTypes, UITypes } from 'nocodb-sdk';
import type LookupColumn from '../models/LookupColumn';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type {
  BarcodeColumn,
  Column,
  FormulaColumn,
  LinksColumn,
  LinkToAnotherRecordColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import { Model } from '~/models';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { getAliasGenerator } from '~/utils';
import { NcError } from '~/helpers/catchError';

const LOOKUP_VAL_SEPARATOR = '___';

export async function getDisplayValueOfRefTable(
  relationCol: Column<LinkToAnotherRecordColumn | LinksColumn>,
) {
  return await relationCol
    .getColOptions()
    .then((colOpt) => colOpt.getRelatedTable())
    .then((model) => model.getColumns())
    .then((cols) => cols.find((col) => col.pv));
}

export default async function generateLookupSelectQuery({
  column,
  baseModelSqlv2,
  alias,
  model: _model,
  getAlias = getAliasGenerator('__lk_slt_'),
}: {
  column: Column;
  baseModelSqlv2: BaseModelSqlv2;
  alias: string;
  model: Model;
  getAlias?: ReturnType<typeof getAliasGenerator>;
}): Promise<any> {
  const knex = baseModelSqlv2.dbDriver;

  const rootAlias = alias;

  {
    let selectQb;
    const alias = getAlias();
    let lookupColOpt: LookupColumn;
    let isBtLookup = true;

    if (column.uidt === UITypes.Lookup) {
      lookupColOpt = await column.getColOptions<LookupColumn>();
    } else if (column.uidt !== UITypes.LinkToAnotherRecord) {
      NcError.badRequest('Invalid column type');
    }

    await column.getColOptions<LookupColumn>();
    {
      const relationCol = lookupColOpt
        ? await lookupColOpt.getRelationColumn()
        : column;
      const relation =
        await relationCol.getColOptions<LinkToAnotherRecordColumn>();

      // if not belongs to then throw error as we don't support
      if (relation.type === RelationTypes.BELONGS_TO) {
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

      // if not belongs to then throw error as we don't support
      else if (relation.type === RelationTypes.HAS_MANY) {
        isBtLookup = false;
        const childColumn = await relation.getChildColumn();
        const parentColumn = await relation.getParentColumn();
        const childModel = await childColumn.getModel();
        await childModel.getColumns();
        const parentModel = await parentColumn.getModel();
        await parentModel.getColumns();

        selectQb = knex(
          `${baseModelSqlv2.getTnPath(childModel.table_name)} as ${alias}`,
        ).where(
          `${alias}.${childColumn.column_name}`,
          knex.raw(`??`, [
            `${rootAlias || baseModelSqlv2.getTnPath(parentModel.table_name)}.${
              parentColumn.column_name
            }`,
          ]),
        );
      }

      // if not belongs to then throw error as we don't support
      else if (relation.type === RelationTypes.MANY_TO_MANY) {
        isBtLookup = false;
        const childColumn = await relation.getChildColumn();
        const parentColumn = await relation.getParentColumn();
        const childModel = await childColumn.getModel();
        await childModel.getColumns();
        const parentModel = await parentColumn.getModel();
        await parentModel.getColumns();

        selectQb = knex(
          `${baseModelSqlv2.getTnPath(parentModel.table_name)} as ${alias}`,
        );

        const mmTableAlias = getAlias();

        const mmModel = await relation.getMMModel();
        const mmChildCol = await relation.getMMChildColumn();
        const mmParentCol = await relation.getMMParentColumn();

        selectQb
          .innerJoin(
            baseModelSqlv2.getTnPath(mmModel.table_name, mmTableAlias),
            knex.ref(`${mmTableAlias}.${mmParentCol.column_name}`),
            '=',
            knex.ref(`${alias}.${parentColumn.column_name}`),
          )
          .where(
            knex.ref(`${mmTableAlias}.${mmChildCol.column_name}`),
            '=',
            knex.ref(
              `${
                rootAlias || baseModelSqlv2.getTnPath(childModel.table_name)
              }.${childColumn.column_name}`,
            ),
          );
      }
    }
    let lookupColumn = lookupColOpt
      ? await lookupColOpt.getLookupColumn()
      : await getDisplayValueOfRefTable(column);

    // if lookup column is qr code or barcode extract the referencing column
    if ([UITypes.QrCode, UITypes.Barcode].includes(lookupColumn.uidt)) {
      lookupColumn = await lookupColumn
        .getColOptions<BarcodeColumn | QrCodeColumn>()
        .then((barcode) => barcode.getValueColumn());
    }

    let prevAlias = alias;
    while (
      lookupColumn.uidt === UITypes.Lookup ||
      lookupColumn.uidt === UITypes.LinkToAnotherRecord
    ) {
      const nestedAlias = getAlias();

      let relationCol: Column<LinkToAnotherRecordColumn | LinksColumn>;
      let nestedLookupColOpt: LookupColumn;

      if (lookupColumn.uidt === UITypes.Lookup) {
        nestedLookupColOpt = await lookupColumn.getColOptions<LookupColumn>();
        relationCol = await nestedLookupColOpt.getRelationColumn();
      } else {
        relationCol = lookupColumn;
      }

      const relation =
        await relationCol.getColOptions<LinkToAnotherRecordColumn>();

      // if any of the relation in nested lookupColOpt is
      // not belongs to then throw error as we don't support
      if (relation.type === RelationTypes.BELONGS_TO) {
        const childColumn = await relation.getChildColumn();
        const parentColumn = await relation.getParentColumn();
        const childModel = await childColumn.getModel();
        await childModel.getColumns();
        const parentModel = await parentColumn.getModel();
        await parentModel.getColumns();

        selectQb.join(
          `${baseModelSqlv2.getTnPath(
            parentModel.table_name,
          )} as ${nestedAlias}`,
          `${nestedAlias}.${parentColumn.column_name}`,
          `${prevAlias}.${childColumn.column_name}`,
        );
      } else if (relation.type === RelationTypes.HAS_MANY) {
        isBtLookup = false;
        const childColumn = await relation.getChildColumn();
        const parentColumn = await relation.getParentColumn();
        const childModel = await childColumn.getModel();
        await childModel.getColumns();
        const parentModel = await parentColumn.getModel();
        await parentModel.getColumns();

        selectQb.join(
          `${baseModelSqlv2.getTnPath(
            childModel.table_name,
          )} as ${nestedAlias}`,
          `${nestedAlias}.${childColumn.column_name}`,
          `${prevAlias}.${parentColumn.column_name}`,
        );
      } else if (relation.type === RelationTypes.MANY_TO_MANY) {
        isBtLookup = false;
        const childColumn = await relation.getChildColumn();
        const parentColumn = await relation.getParentColumn();
        const childModel = await childColumn.getModel();
        await childModel.getColumns();
        const parentModel = await parentColumn.getModel();
        await parentModel.getColumns();

        const mmTableAlias = getAlias();

        const mmModel = await relation.getMMModel();
        const mmChildCol = await relation.getMMChildColumn();
        const mmParentCol = await relation.getMMParentColumn();

        selectQb
          .innerJoin(
            baseModelSqlv2.getTnPath(mmModel.table_name, mmTableAlias),
            knex.ref(`${mmTableAlias}.${mmChildCol.column_name}`),
            '=',
            knex.ref(`${prevAlias}.${childColumn.column_name}`),
          )
          .innerJoin(
            knex.raw('?? as ??', [
              baseModelSqlv2.getTnPath(parentModel.table_name),
              nestedAlias,
            ]),
            knex.ref(`${mmTableAlias}.${mmParentCol.column_name}`),
            '=',
            knex.ref(`${nestedAlias}.${parentColumn.column_name}`),
          )
          .where(
            knex.ref(`${mmTableAlias}.${mmChildCol.column_name}`),
            '=',
            knex.ref(
              `${alias || baseModelSqlv2.getTnPath(childModel.table_name)}.${
                childColumn.column_name
              }`,
            ),
          );
      }

      if (lookupColumn.uidt === UITypes.Lookup)
        lookupColumn = await nestedLookupColOpt.getLookupColumn();
      else lookupColumn = await getDisplayValueOfRefTable(relationCol);
      prevAlias = nestedAlias;
    }

    {
      // get basemodel and model of lookup column
      const model = await lookupColumn.getModel();
      const baseModelSqlv2 = await Model.getBaseModelSQL({
        model,
        dbDriver: knex,
      });

      switch (lookupColumn.uidt) {
        case UITypes.Attachment:
          NcError.badRequest(
            'Group by using attachment column is not supported',
          );
          break;
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
        case UITypes.Formula:
          {
            const builder = (
              await formulaQueryBuilderv2(
                baseModelSqlv2,
                (
                  await lookupColumn.getColOptions<FormulaColumn>()
                ).formula,
                lookupColumn.title,
                model,
                lookupColumn,
                await model.getAliasColMapping(),
                prevAlias,
              )
            ).builder;

            selectQb.select(builder);
          }
          break;
        case UITypes.DateTime:
          {
            await baseModelSqlv2.selectObject({
              qb: selectQb,
              columns: [lookupColumn],
              alias: prevAlias,
            });
          }
          break;
        default:
          {
            selectQb.select(
              `${prevAlias}.${lookupColumn.column_name} as ${lookupColumn.title}`,
            );
          }

          break;
      }
    }
    // if all relation are belongs to then we don't need to do the aggregation
    if (isBtLookup) {
      return {
        builder: selectQb,
      };
    }

    const subQueryAlias = getAlias();

    if (baseModelSqlv2.isPg) {
      // alternate approach with array_agg
      return {
        builder: knex
          .select(knex.raw('json_agg(??)::text', [lookupColumn.title]))
          .from(selectQb.as(subQueryAlias)),
      };
      /*
      // alternate approach with array_agg
      return {
        builder: knex
          .select(knex.raw('array_agg(??)', [lookupColumn.title]))
          .from(selectQb),
      };*/
      // alternate approach with string aggregation
      // return {
      //   builder: knex
      //     .select(
      //       knex.raw('STRING_AGG(??::text, ?)', [
      //         lookupColumn.title,
      //         LOOKUP_VAL_SEPARATOR,
      //       ]),
      //     )
      //     .from(selectQb.as(subQueryAlias)),
      // };
    } else if (baseModelSqlv2.isMySQL) {
      return {
        builder: knex
          .select(
            knex.raw('cast(JSON_ARRAYAGG(??) as NCHAR)', [lookupColumn.title]),
          )
          .from(selectQb.as(subQueryAlias)),
      };

      // return {
      //   builder: knex
      //     .select(
      //       knex.raw('GROUP_CONCAT(?? ORDER BY ?? ASC SEPARATOR ?)', [
      //         lookupColumn.title,
      //         lookupColumn.title,
      //         LOOKUP_VAL_SEPARATOR,
      //       ]),
      //     )
      //     .from(selectQb.as(subQueryAlias)),
      // };
    } else if (baseModelSqlv2.isSqlite) {
      // ref: https://stackoverflow.com/questions/13382856/sqlite3-join-group-concat-using-distinct-with-custom-separator
      // selectQb.orderBy(`${lookupColumn.title}`, 'asc');
      return {
        builder: knex
          .select(
            knex.raw(`group_concat(??, ?)`, [
              lookupColumn.title,
              LOOKUP_VAL_SEPARATOR,
            ]),
          )
          .from(selectQb.as(subQueryAlias)),
      };
    }

    NcError.notImplemented('Database not supported Group by on Lookup');
  }
}
