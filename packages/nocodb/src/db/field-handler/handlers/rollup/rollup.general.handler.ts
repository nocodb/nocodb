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
    return parseConditionV2(
      baseModelSqlv2,
      new Filter({
        ...filter,
        value: knex.raw('?', [
          // convert value to number for rollup since rollup is always number
          isNaN(+filter.value) ? filter.value : +filter.value,
        ]),
      } as any),
      aliasCount,
      alias,
      builder,
    );
  }
}
