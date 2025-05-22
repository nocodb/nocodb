import { RollupGeneralHandler } from '../rollup/rollup.general.handler';
import type CustomKnex from '~/db/CustomKnex';
import type { FilterOptions } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class LinksGeneralHandler extends GenericFieldHandler {
  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ) {
    return new RollupGeneralHandler().filter(knex, filter, column, options);
  }
}
