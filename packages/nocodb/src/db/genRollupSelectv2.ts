import {
  FormulaDataTypes,
  isBtLikeV2Junction,
  isMMOrMMLike,
  NC_ERROR_SENTINEL,
  NcDataErrorCodes,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { CircularRefContext } from 'nocodb-sdk';
import type { ClientType } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from './IBaseModelSqlV2';
import type { Knex } from 'knex';
import type {
  ButtonColumn,
  FormulaColumn,
  LinksColumn,
  LinkToAnotherRecordColumn,
  RollupColumn,
} from '~/models';
import type { XKnex } from '~/db/CustomKnex';
import { NcError } from '~/helpers/ncError';
import { RelationManager } from '~/db/relation-manager';
import { Column, Model } from '~/models';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import { extractLinkRelFiltersAndApply } from '~/db/conditionV2';
import { getAliasedSoftDeleteFilter } from '~/helpers/dbHelpers';
import { Profiler } from '~/helpers/profiler';
import { DBQueryClient } from '~/dbQueryClient';

export default async function genRollupSelectv2(param: {
  baseModelSqlv2: IBaseModelSqlV2;
  knex: XKnex;
  alias?: string;
  columnOptions: RollupColumn | LinksColumn;
  parentColumns?: CircularRefContext;
  nestedLevel?: number;
}): Promise<{ builder: Knex.QueryBuilder | any }> {
  const { baseModelSqlv2, knex, alias, columnOptions, nestedLevel = 0 } = param;
  let { parentColumns } = param;

  if ((columnOptions as RollupColumn).error) {
    return { builder: knex.raw(`?`, [NC_ERROR_SENTINEL]) };
  }

  const context = baseModelSqlv2.context;
  parentColumns = parentColumns ?? CircularRefContext.make();
  const profiler = Profiler.start(
    'DEBUG:/genRollupSelectv2/' + columnOptions.fk_column_id,
  );
  const column = await Column.get(context, {
    colId: columnOptions.fk_column_id,
  });
  if (column) {
    const model = await Model.getByAliasOrId(context, {
      base_id: context.base_id,
      aliasOrId: column.fk_model_id,
    });
    parentColumns = parentColumns.cloneAndAdd({
      id: column.id,
      title: column.title,
      table: model?.title,
    });
  }
  profiler.log('cloneAndAdd done');
  let relationColumn: Column;
  if (!columnOptions.getRelationColumn) {
    relationColumn = await Column.get(context, {
      colId: columnOptions.fk_relation_column_id,
    });
  } else {
    relationColumn = await columnOptions.getRelationColumn(context);
  }
  profiler.log('getRelationColumn done');

  if (!relationColumn) {
    return { builder: knex.raw(`?`, [NC_ERROR_SENTINEL]) };
  }

  const relationColumnOption: LinkToAnotherRecordColumn =
    (await relationColumn.getColOptions(context)) as LinkToAnotherRecordColumn;
  const { parentContext, childContext, mmContext, refContext } =
    await relationColumnOption.getParentChildContext(context);

  const isMMLike = isMMOrMMLike(relationColumn);

  const rollupColumn = columnOptions.getRollupColumn
    ? await columnOptions.getRollupColumn(refContext)
    : await Column.get(refContext, {
        colId: columnOptions.fk_rollup_column_id,
      });
  profiler.log('get relation (parent/child) columns');

  if (!rollupColumn) {
    NcError.get(context).fieldNotFound(columnOptions.fk_rollup_column_id);
  }

  const childCol = await relationColumnOption.getChildColumn(childContext);
  const childModel = await childCol?.getModel(childContext);
  const parentCol = await relationColumnOption.getParentColumn(parentContext);
  const parentModel = await parentCol?.getModel(parentContext);
  const refTableAlias =
    `__nc_rollup_` + Math.random().toString(36).substring(2, 8);

  const dbQueryClient = DBQueryClient.get(knex.clientType() as ClientType);
  profiler.log('get base model');

  const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
    model: parentModel,
    dbDriver: knex,
  });
  const childBaseModel = await Model.getBaseModelSQL(childContext, {
    model: childModel,
    dbDriver: knex,
  });

  const refBaseModel =
    rollupColumn.fk_model_id === childModel.id
      ? childBaseModel
      : parentBaseModel;

  // MSSQL rejects `agg(subquery)` ("Cannot perform an aggregate function on
  // an expression containing an aggregate or a subquery"). When the rolled-up
  // column lowers to a correlated subquery (nested Rollup / Formula /
  // Created-Modified), defer the aggregate to a derived-table wrap in
  // `wrapMssqlNestedAgg` below.
  const NC_ROLLUP_VAL_ALIAS = '__nc_rollup_val';
  let selectColumnIsSubquery = false;

  const applyFunction = async (qb: any) => {
    profiler.log('applyFunction ' + rollupColumn.uidt);
    let selectColumnName = knex.raw('??.??', [
      refTableAlias,
      rollupColumn.column_name,
    ]);
    // Tracks whether the resolved value is boolean-typed even though
    // `rollupColumn.dt` doesn't say so — true for a boolean-returning Formula
    // subquery (virtual column, so `dt` is null). Drives the MSSQL bit→FLOAT
    // cast below, which would otherwise only fire for direct `bit` columns.
    let selectValueIsBoolean = false;
    // Tracks whether the resolved value is a string-typed Formula. On Oracle a
    // string Formula lowers to a CLOB (CONCAT wraps args in TO_CLOB to dodge the
    // VARCHAR2 4000-byte concat cap), and CLOB is rejected by COUNT / COUNT
    // DISTINCT / MIN / MAX (ORA-22849). Drives the CLOB→VARCHAR2 normalization
    // below.
    let selectValueIsString = false;
    if (rollupColumn.uidt === UITypes.Formula) {
      // `rollupColumn` lives in the related table — for a cross-base rollup its
      // column options (the formula AST) are stored under the related base, so
      // they must be read with `refContext`, not the current base's `context`.
      // Reading with the wrong context returns null and crashes on
      // `formulOption.formula` below. Matches the rollup-of-rollup branch, which
      // already resolves its colOptions via `refContext`.
      const formulOption = await rollupColumn.getColOptions<
        FormulaColumn | ButtonColumn
      >(refContext);

      if (!formulOption) {
        NcError.get(context).fieldNotFound(columnOptions.fk_rollup_column_id);
      }

      const formulaQb = await formulaQueryBuilderv2({
        baseModel: RelationManager.isRelationReversed(
          relationColumn,
          relationColumnOption,
        )
          ? parentBaseModel
          : childBaseModel,
        tree: formulOption.formula,
        model: RelationManager.isRelationReversed(
          relationColumn,
          relationColumnOption,
        )
          ? parentModel
          : childModel,
        column: rollupColumn,
        aliasToColumn: {},
        tableAlias: refTableAlias,
        validateFormula: false,
        parsedTree: formulOption.getParsedTree(),
        baseUsers: undefined,
        parentColumns,
      });
      // `formulaQb.builder` already escapes its `?` literals (`\\?`) so knex
      // doesn't bind them. But `knex.raw(rawObj)` resolves the inner Raw via
      // `toQuery()` first, which STRIPS the `\\` and re-exposes a bare `?` —
      // that `?` then collides with downstream WHERE bindings (e.g. the
      // soft-delete `__nc_deleted = false`), swapping arguments and leaving
      // an unbound `?` that PG rejects as a syntax error. Materialize the
      // SQL and re-escape `?` so the outer builder treats it as literal.
      // See: parsed-tree-builder.ts:307 (where the original `\\?` escape
      // is applied to formula output).
      selectColumnIsSubquery = true;
      selectColumnName = knex.raw(
        `(${formulaQb.builder.toQuery().replaceAll('?', '\\?')})`,
      );
      // A boolean-returning formula (e.g. a Checkbox passthrough) lowers to a
      // `bit`-typed expression on MSSQL — flag it so the bit→FLOAT cast fires.
      selectValueIsBoolean =
        formulOption.getParsedTree()?.dataType === FormulaDataTypes.BOOLEAN;
      selectValueIsString =
        formulOption.getParsedTree()?.dataType === FormulaDataTypes.STRING;
    } else if ([UITypes.Rollup].includes(rollupColumn.uidt)) {
      const knex = refBaseModel.dbDriver;

      // Rollup-of-rollup: compute inner rollup correlated to the current level
      const inner = await genRollupSelectv2({
        baseModelSqlv2: refBaseModel,
        knex,
        alias: refTableAlias,
        columnOptions: await rollupColumn.getColOptions<RollupColumn>(
          refContext,
        ),
        nestedLevel: nestedLevel + 1,
        parentColumns,
      });

      // Use the inner builder directly as a subquery
      selectColumnIsSubquery = true;
      selectColumnName = knex.raw('(?)', [inner.builder]);
    } else if (
      [
        UITypes.CreatedTime,
        UITypes.CreatedBy,
        UITypes.LastModifiedTime,
        UITypes.LastModifiedBy,
      ].includes(rollupColumn.uidt)
    ) {
      // since all field are virtual field,
      // we use formula to generate query that can represent the column
      // to prevent duplicate logic
      const formulaQb = await formulaQueryBuilderv2({
        baseModel: RelationManager.isRelationReversed(
          relationColumn,
          relationColumnOption,
        )
          ? parentBaseModel
          : childBaseModel,
        tree: '{{' + rollupColumn.id + '}}',
        model: RelationManager.isRelationReversed(
          relationColumn,
          relationColumnOption,
        )
          ? parentModel
          : childModel,
        column: rollupColumn,
        tableAlias: refTableAlias,
        parsedTree: {
          type: 'Identifier',
          name: rollupColumn.id,
          raw: '{{' + rollupColumn.id + '}}',
          dataType: [UITypes.CreatedTime, UITypes.LastModifiedTime].includes(
            rollupColumn.uidt,
          )
            ? 'date'
            : 'string',
        },
      });

      // Same `\\?` re-escape as the Formula branch above — Created/Modified
      // metadata columns lower into a formula builder too, so they share the
      // same `?`-binding hazard when wrapped via `knex.raw(rawObj)`.
      selectColumnIsSubquery = true;
      selectColumnName = knex.raw(
        `(${formulaQb.builder.toQuery().replaceAll('?', '\\?')})`,
      );
    }

    // if postgres and rollup function is sum/sumDistinct/avgDistinct/avg, then cast the column to integer when type is boolean
    if (
      baseModelSqlv2.isPg &&
      ['sum', 'sumDistinct', 'avgDistinct', 'avg'].includes(
        columnOptions.rollup_function,
      ) &&
      ['bool', 'boolean'].includes(rollupColumn.dt)
    ) {
      qb[columnOptions.rollup_function as string]?.(
        knex.raw('??::integer', [selectColumnName]),
      );
      profiler.log('applyFunction done');
      return;
    }

    // SQL Server's `bit` type is invalid for the sum/avg/min/max aggregate
    // operators ("Operand data type bit is invalid for sum operator"). Cast to
    // FLOAT so they all work: SUM stays exact, AVG keeps its fraction (CAST AS
    // INT would integer-truncate AVG, e.g. 0.5 -> 0), MIN/MAX yield 0.0/1.0.
    // COUNT/countDistinct accept `bit` directly and are intentionally excluded.
    if (
      baseModelSqlv2.isMssql &&
      ['sum', 'sumDistinct', 'avgDistinct', 'avg', 'min', 'max'].includes(
        columnOptions.rollup_function,
      ) &&
      (['bit', 'bool', 'boolean'].includes(rollupColumn.dt?.toLowerCase()) ||
        selectValueIsBoolean)
    ) {
      selectColumnName = knex.raw('CAST(?? AS FLOAT)', [selectColumnName]);
    }

    // MSSQL nested-subquery path: select the per-row value; the aggregate
    // is applied by wrapMssqlNestedAgg over an enclosing derived table.
    if (baseModelSqlv2.isMssql && selectColumnIsSubquery) {
      qb.select({ [NC_ROLLUP_VAL_ALIAS]: selectColumnName });
      profiler.log('applyFunction done (mssql derived-agg deferred)');
      return;
    }

    // Oracle: a string Formula lowers to a CLOB, which COUNT / COUNT DISTINCT /
    // MIN / MAX all reject (ORA-22849 — "Type CLOB is not supported for this
    // function or operator"). Normalize it to a comparable VARCHAR2 via
    // DBMS_LOB.SUBSTR(TO_CLOB(x), 4000, 1): TO_CLOB is an identity no-op on an
    // already-CLOB / VARCHAR2 operand, and SUBSTR yields VARCHAR2(4000). The
    // sum/avg family is numeric (never CLOB) so it is intentionally excluded.
    if (
      baseModelSqlv2.isOracle &&
      selectValueIsString &&
      ['count', 'countDistinct', 'min', 'max'].includes(
        columnOptions.rollup_function as string,
      )
    ) {
      selectColumnName = knex.raw('DBMS_LOB.SUBSTR(TO_CLOB(??), 4000, 1)', [
        selectColumnName,
      ]);
    }

    if (
      ['sum', 'sumDistinct', 'avgDistinct', 'avg'].includes(
        columnOptions.rollup_function,
      )
    ) {
      if (baseModelSqlv2.isOracle) {
        const fn = columnOptions.rollup_function as string;
        const distinct = ['sumDistinct', 'avgDistinct'].includes(fn);
        const baseFn = fn.replace('Distinct', '');
        qb.select(
          knex.raw(`COALESCE(${baseFn}(${distinct ? 'distinct ' : ''}??), 0)`, [
            selectColumnName,
          ]),
        );
      } else {
        qb.select(
          knex.raw(`COALESCE((??), 0)`, [
            knex[columnOptions.rollup_function as string]?.(selectColumnName),
          ]),
        );
      }
    } else {
      qb[columnOptions.rollup_function as string]?.(selectColumnName);
    }
    profiler.log('applyFunction done');
  };

  // Rewrite `SELECT agg(subquery) FROM related …` (illegal on MSSQL) into
  // `SELECT agg(v) FROM (SELECT subquery AS v FROM related …) sub`.
  // Pass-through on non-MSSQL and on direct-column rollups.
  const wrapMssqlNestedAgg = (innerQb: any) => {
    if (!(baseModelSqlv2.isMssql && selectColumnIsSubquery)) return innerQb;
    const fn = columnOptions.rollup_function as string;
    const distinct = ['sumDistinct', 'avgDistinct', 'countDistinct'].includes(
      fn,
    );
    const baseFn = fn.replace('Distinct', '');
    const aggInner = `${baseFn}(${distinct ? 'distinct ' : ''}??)`;
    const aggSql = ['sum', 'sumDistinct', 'avgDistinct', 'avg'].includes(fn)
      ? `COALESCE(${aggInner}, 0)`
      : aggInner;
    return knex
      .from(innerQb.as(`${refTableAlias}__agg`))
      .select(knex.raw(aggSql, [NC_ROLLUP_VAL_ALIAS]));
  };

  const relationType = isMMLike
    ? RelationTypes.MANY_TO_MANY
    : relationColumnOption.type;

  switch (relationType) {
    case RelationTypes.HAS_MANY: {
      profiler.log('Relation: ' + relationColumnOption.type);
      const queryBuilder: any = knex(
        dbQueryClient.tableAlias(
          knex,
          childBaseModel.getTnPath(childModel),
          refTableAlias,
        ),
      ).where(
        knex.ref(
          `${alias || parentBaseModel.getTnPath(parentModel.table_name)}.${
            parentCol.column_name
          }`,
        ),
        '=',
        knex.ref(`${refTableAlias}.${childCol.column_name}`),
      );

      // Exclude soft-deleted child records from HM rollup
      const hmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
        childBaseModel,
        refTableAlias,
      );
      if (hmSoftDeleteFilter) {
        queryBuilder.where(hmSoftDeleteFilter);
      }

      await applyFunction(queryBuilder);

      if (column) {
        await extractLinkRelFiltersAndApply({
          qb: queryBuilder,
          column,
          alias: refTableAlias,
          table: childBaseModel.model,
          baseModel: childBaseModel,
          context: childBaseModel.context,
        });
      }
      profiler.end();
      return {
        builder: wrapMssqlNestedAgg(queryBuilder),
      };
    }

    case RelationTypes.ONE_TO_ONE: {
      profiler.log('Relation: ' + relationColumnOption.type);
      const qb = knex(
        dbQueryClient.tableAlias(
          knex,
          childBaseModel.getTnPath(childModel?.table_name),
          refTableAlias,
        ),
      ).where(
        knex.ref(
          `${alias || parentBaseModel.getTnPath(parentModel.table_name)}.${
            parentCol.column_name
          }`,
        ),
        '=',
        knex.ref(`${refTableAlias}.${childCol.column_name}`),
      );

      // Exclude soft-deleted child records from OO rollup
      const ooSoftDeleteFilter = await getAliasedSoftDeleteFilter(
        childBaseModel,
        refTableAlias,
      );
      if (ooSoftDeleteFilter) {
        qb.where(ooSoftDeleteFilter);
      }

      await extractLinkRelFiltersAndApply({
        qb,
        column,
        alias: refTableAlias,
        table: childBaseModel.model,
        baseModel: childBaseModel,
        context: childBaseModel.context,
      });

      await applyFunction(qb);
      profiler.end();
      return {
        builder: wrapMssqlNestedAgg(qb),
      };
    }

    case RelationTypes.MANY_TO_MANY: {
      profiler.log('Relation: ' + relationColumnOption.type);
      const mmModel = await relationColumnOption.getMMModel(mmContext);
      const mmChildCol = await relationColumnOption.getMMChildColumn(mmContext);
      const mmParentCol = await relationColumnOption.getMMParentColumn(
        mmContext,
      );
      const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
        id: mmModel.id,
        dbDriver: knex,
      });
      if (!mmModel) {
        return this.dbDriver.raw(`?`, [
          NcDataErrorCodes.NC_ERR_MM_MODEL_NOT_FOUND,
        ]);
      }

      const qb = knex(
        dbQueryClient.tableAlias(
          knex,
          parentBaseModel.getTnPath(parentModel?.table_name),
          refTableAlias,
        ),
      )
        .innerJoin(
          assocBaseModel.getTnPath(mmModel.table_name) as any,
          knex.ref(
            `${assocBaseModel.getTnPath(mmModel.table_name)}.${
              mmParentCol.column_name
            }`,
          ) as any,
          '=',
          knex.ref(`${refTableAlias}.${parentCol.column_name}`) as any,
        )
        .where(
          knex.ref(
            `${assocBaseModel.getTnPath(mmModel.table_name)}.${
              mmChildCol.column_name
            }`,
          ),
          '=',
          knex.ref(
            `${alias || childBaseModel.getTnPath(childModel.table_name)}.${
              childCol.column_name
            }`,
          ),
        );

      // Exclude soft-deleted parent records from MM rollup
      const mmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
        parentBaseModel,
        refTableAlias,
      );
      if (mmSoftDeleteFilter) {
        qb.where(mmSoftDeleteFilter);
      }

      await extractLinkRelFiltersAndApply({
        qb: qb,
        column,
        alias: refTableAlias,
        table: parentBaseModel.model,
        baseModel: parentBaseModel,
        context: parentBaseModel.context,
      });

      // V2 MO/OO: single-record semantics — limit to 1 row
      if (isBtLikeV2Junction(relationColumn)) {
        qb.limit(1);
      }

      await applyFunction(qb);
      profiler.end();
      return {
        builder: wrapMssqlNestedAgg(qb),
      };
    }

    default:
      NcError.get(context).unSupportedRelation(relationColumnOption.type);
  }
}
