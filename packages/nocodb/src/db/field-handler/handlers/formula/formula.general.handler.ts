import {
  FormulaDataTypes,
  isFormulaNonFiniteValue,
  parseProp,
  UITypes,
} from 'nocodb-sdk';
import { ComputedFieldHandler } from '../computed';
import type { ColumnType, ParsedFormulaNode } from 'nocodb-sdk';
import type CustomKnex from 'src/db/CustomKnex';
import type { Knex } from 'src/db/CustomKnex';
import type {
  FilterOptions,
  FilterVerificationResult,
  SortOptions,
} from '~/db/field-handler/field-handler.interface';
import type { FormulaColumn } from '~/models';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import { Column, Filter } from '~/models';

export class FormulaGeneralHandler extends ComputedFieldHandler {
  override async applySort(
    qb: Knex.QueryBuilder,
    column: Column,
    direction: 'asc' | 'desc',
    options: SortOptions,
  ): Promise<void> {
    const { alias, nulls, baseModel: baseModelSqlv2, context } = options;
    const knex = options.knex as CustomKnex;
    const model = await column.getModel(context);

    const formulaOptions = await column.getColOptions<FormulaColumn>(context);

    const parsedTree = formulaOptions.getParsedTree();
    // Pure literal — `ORDER BY '<literal>'` is meaningless and some
    // dialects reject it; ORDER BY 1 is a portable no-op.
    if (parsedTree?.type === 'Literal') {
      qb.orderBy(knex.raw('?', [1]) as any, direction, nulls);
      return;
    }

    const builder = (
      await formulaQueryBuilderv2({
        baseModel: baseModelSqlv2,
        tree: formulaOptions.formula,
        model,
        column,
        tableAlias: alias,
      })
    ).builder;
    qb.orderBy(builder, direction, nulls);
  }

  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ) {
    const {
      context,
      conditionParser: parseConditionV2,
      baseModel: baseModelSqlv2,
      alias,
      depth: aliasCount,
    } = options;
    const model = await column.getModel(context);
    const formula = await column.getColOptions<FormulaColumn>(context);
    const parsedTree: ParsedFormulaNode = formula.getParsedTree();
    // Filters resolve the formula the way the cell and the group key do, and it
    // cuts both ways: `eq Infinity` must match the error rows, `eq 1` must not.
    // Unconditional, not value-dependent. Aggregation is unaffected — it goes
    // through getColumnNameQuery, not this handler.
    const displayMode =
      baseModelSqlv2.isPg && parsedTree?.dataType === FormulaDataTypes.NUMERIC;
    const builder = (
      await formulaQueryBuilderv2({
        baseModel: baseModelSqlv2,
        tree: formula.formula,
        model,
        column,
        tableAlias: alias,
        displayMode,
      })
    ).builder;
    const value =
      displayMode && isFormulaNonFiniteValue(filter.value)
        ? // double precision, never numeric — numeric cannot hold Infinity
          // before pg 14, and Number/Decimal columns map to numeric. Gated on
          // displayMode so the pg-only `::` cast never reaches another dialect.
          knex.raw('?::double precision', [filter.value])
      : parsedTree?.dataType === FormulaDataTypes.DATE
      ? filter.value
      : knex.raw('?', [
          // convert value to number if formulaDataType if numeric
          parsedTree?.dataType === FormulaDataTypes.NUMERIC &&
          !isNaN(+filter.value)
            ? +filter.value
            : filter.value ?? null, // in gp_null value is undefined
        ]);
    return parseConditionV2(
      baseModelSqlv2,
      new Filter({
        ...filter,
        value,
      } as any),
      aliasCount,
      alias,
      builder,
    );
  }

  override async verifyFilter(
    filter: Filter,
    column: Column,
    options: FilterOptions = {},
  ) {
    const uidt = parseProp(column.meta).display_type;
    if (uidt) {
      const updatedColumn = new Column({
        ...column,
        uidt: uidt,
      } as ColumnType);
      return options.fieldHandler.verifyFilter(filter, updatedColumn, options);
    } else {
      const formulaCol = await column.getColOptions<FormulaColumn>(
        options.context,
      );
      const parsedTree = await formulaCol.getParsedTree();

      const setColumnTypeAndVerify = (type: UITypes) => {
        const updatedColumn = new Column({
          ...column,
          uidt: type,
        } as ColumnType);
        return options.fieldHandler.verifyFilter(
          filter,
          updatedColumn,
          options,
        );
      };

      if (!parsedTree?.dataType) {
        return setColumnTypeAndVerify(UITypes.SingleLineText);
      }

      const dataType = parsedTree.dataType;

      // Infinity/-Infinity/NaN are valid group keys the UI filters back on, but
      // the Decimal verifier rejects them — Number('NaN') fails its numeric
      // check, so `eq NaN` 422s before reaching the query.
      if (
        dataType === FormulaDataTypes.NUMERIC &&
        isFormulaNonFiniteValue(filter.value)
      ) {
        return { isValid: true } as FilterVerificationResult;
      }

      switch (dataType) {
        case FormulaDataTypes.BOOLEAN:
          return setColumnTypeAndVerify(UITypes.Checkbox);
        case FormulaDataTypes.DATE:
          return setColumnTypeAndVerify(UITypes.DateTime);
        case FormulaDataTypes.INTERVAL:
          return setColumnTypeAndVerify(UITypes.Time);
        case FormulaDataTypes.NUMERIC:
          return setColumnTypeAndVerify(UITypes.Decimal);
        case FormulaDataTypes.STRING:
        default:
          return setColumnTypeAndVerify(UITypes.SingleLineText);
      }
    }

    return {
      isValid: true,
    } as FilterVerificationResult;
  }
}
