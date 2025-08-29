import type { Column } from '~/models';
import type { Knex } from 'knex';

export function prepareMetaUpdateQuery(_: {
  knex: Knex;
  colIds: string[];
  props: Record<string, unknown>;
  metaColumn: Column;
}): Knex.Raw | void {
  return;
}
