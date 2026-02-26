import { isBtLikeV2Junction } from 'nocodb-sdk';
import { RollupGeneralHandler } from '../rollup/rollup.general.handler';
import { LtarGeneralHandler } from '../ltar/ltar.general.handler';
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
    // V2 MO/OO: single-record semantics — filter by display value (like BT)
    if (isBtLikeV2Junction(column)) {
      return new LtarGeneralHandler().filter(knex, filter, column, options);
    }

    // V2 OM/MM and V1: filter by count (rollup)
    return new RollupGeneralHandler().filter(knex, filter, column, options);
  }
}
