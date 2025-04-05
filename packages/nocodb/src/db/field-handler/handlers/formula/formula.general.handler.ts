import { FormulaDataTypes, parseProp } from 'nocodb-sdk';
import { UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type {
  FilterVerificationResult,
  HandlerOptions,
} from '~/db/field-handler/field-handler.interface';
import type { FormulaColumn } from '~/models';
import type CustomKnex from 'src/db/CustomKnex';
import { type Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';

export class FormulaGeneralHandler extends GenericFieldHandler {
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
      column.uidt = uidt;
      return options.fieldHandler.verifyFilter(filter, column, options);
    } else {
      const formulaCol = await column.getColOptions<FormulaColumn>(
        options.context,
      );
      const parsedTree = await formulaCol.getParsedTree();
      const dataType = parsedTree.dataType;
      switch (dataType) {
        case FormulaDataTypes.BOOLEAN: {
          column.uidt = UITypes.Checkbox;
          return options.fieldHandler.verifyFilter(filter, column, options);
        }
        case FormulaDataTypes.DATE: {
          column.uidt = UITypes.DateTime;
          return options.fieldHandler.verifyFilter(filter, column, options);
        }
        case FormulaDataTypes.INTERVAL: {
          column.uidt = UITypes.Time;
          return options.fieldHandler.verifyFilter(filter, column, options);
        }
        case FormulaDataTypes.NUMERIC: {
          column.uidt = UITypes.Decimal;
          return options.fieldHandler.verifyFilter(filter, column, options);
        }
        case FormulaDataTypes.STRING:
        default: {
          column.uidt = UITypes.SingleLineText;
          return options.fieldHandler.verifyFilter(filter, column, options);
        }
      }
    }

    return {
      isValid: true,
    } as FilterVerificationResult;
  }
}
