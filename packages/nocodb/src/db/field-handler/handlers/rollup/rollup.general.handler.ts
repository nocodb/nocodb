import type CustomKnex from '~/db/CustomKnex';
import type { HandlerOptions } from '~/db/field-handler/field-handler.interface';
import type { Column, RollupColumn } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { Filter } from '~/models';

export class RollupGeneralHandler extends GenericFieldHandler {
  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: HandlerOptions,
  ) {
    const {
      baseModel: baseModelSqlv2,
      depth: aliasCount,
      conditionParser: parseConditionV2,
      alias,
    } = options;

    const context = baseModelSqlv2.context;

    const builder = (
      await genRollupSelectv2({
        baseModelSqlv2,
        knex,
        alias,
        columnOptions: (await column.getColOptions(context)) as RollupColumn,
      })
    ).builder;
    
    // Fix for empty string filter value
    let filterValue = filter.value;
    if (filterValue === '') {
      // If the filter value is an empty string, use NULL for comparison
      // This prevents PostgreSQL from trying to convert an empty string to a number
      filterValue = null;
    } else if (!isNaN(+filterValue) && filterValue !== null) {
      // Only convert to number if it's a valid number and not null
      filterValue = +filterValue;
    }
    
    return parseConditionV2(
      baseModelSqlv2,
      new Filter({
        ...filter,
        value: knex.raw('?', [filterValue]),
      } as any),
      aliasCount,
      alias,
      builder,
    );
  }
}
