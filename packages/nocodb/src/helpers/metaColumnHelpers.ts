import type { Column } from '~/models';
import type { Knex } from 'knex';
import type { XKnex } from '~/db/CustomKnex';

export function prepareMetaUpdateQuery(_: {
  knex: Knex | XKnex;
  colIds: string[];
  props: Record<string, unknown>;
  metaColumn: Column;
}): Knex.Raw | void {
  return;
}
