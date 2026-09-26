import type { Column, Model } from '~/models';
import type { Knex } from 'knex';
import type { XKnex } from '~/db/CustomKnex';
import type { NcContext } from '~/interface/config';

export function prepareMetaUpdateQuery(_: {
  knex: Knex | XKnex;
  colIds: string[];
  props: Record<string, unknown>;
  metaColumn: Column;
}): Knex.Raw | void {
  return;
}

export function prepareAgentRunAtStampQuery(_: {
  knex: Knex | XKnex;
  colId: string;
  agentRunAt: string;
  metaColumn: Column;
}): Knex.Raw | void {
  return;
}

export async function resolveMetaColumn(
  _context: NcContext,
  _model: Model,
): Promise<Column | null> {
  return null;
}
