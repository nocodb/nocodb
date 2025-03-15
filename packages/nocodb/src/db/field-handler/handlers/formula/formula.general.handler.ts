import { FormulaDataTypes, parseProp } from 'nocodb-sdk';
import { UITypes } from 'nocodb-sdk';
import type {
  FilterVerificationResult,
  HandlerOptions,
} from '~/db/field-handler/field-handler.interface';
import type { FormulaColumn } from '~/models';
import { type Column, type Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class FormulaGeneralHandler extends GenericFieldHandler {
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
