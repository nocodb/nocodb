import type { Column, Model, Source } from '~/models';
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

export function prepareAgentStatusStampQuery(_: {
  knex: Knex | XKnex;
  colId: string;
  status: 'generating' | 'idle';
  metaColumn: Column;
}): Knex.Raw | void {
  return;
}

export async function ensureMetaColumn(
  _context: NcContext,
  _model: Model,
  _source: Source,
): Promise<Column | null> {
  return null;
}
