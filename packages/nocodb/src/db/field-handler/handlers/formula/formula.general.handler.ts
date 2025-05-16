import { FormulaDataTypes, parseProp, UITypes } from 'nocodb-sdk';
import { ComputedFieldHandler } from '../computed';
import type { Knex } from 'knex';
import type { ColumnType } from 'nocodb-sdk';
import type CustomKnex from 'src/db/CustomKnex';
import type {
  FilterVerificationResult,
  HandlerOptions,
} from '~/db/field-handler/field-handler.interface';
import type { FormulaColumn } from '~/models';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import { Column, Filter } from '~/models';

export class FormulaGeneralHandler extends ComputedFieldHandler {
  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: HandlerOptions,
  ): Promise<(qb: Knex.QueryBuilder) => void> {
    const {
      context,
      conditionParser: parseConditionV2,
      baseModel: baseModelSqlv2,
      alias,
      depth: aliasCount,
    } = options;
    const model = await column.getModel(context);
    const formula = await column.getColOptions<FormulaColumn>(context);
    const builder = (
      await formulaQueryBuilderv2({
        baseModel: baseModelSqlv2,
        tree: formula.formula,
        model,
        column,
        tableAlias: alias,
      })
    ).builder;
    return parseConditionV2(
      baseModelSqlv2,
      new Filter({
        ...filter,
        value: knex.raw('?', [
          // convert value to number if formulaDataType if numeric
          formula.getParsedTree()?.dataType === FormulaDataTypes.NUMERIC &&
          !isNaN(+filter.value)
            ? +filter.value
            : filter.value ?? null, // in gp_null value is undefined
        ]),
      } as any),
      aliasCount,
      alias,
      builder,
    );
  }

  override async verifyFilter(
    filter: Filter,
    column: Column,
    options: HandlerOptions = {},
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
      const dataType = parsedTree.dataType;
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
