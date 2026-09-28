import type { Knex } from 'knex';

/**
 * Build the raw SQL fragment for the legacy pg `like` branch of the `xwhere`
 * string-condition parser (`where=(field,like,VALUE)`).
 *
 * Column (`??`) and value (`?`) are both bound. Only `operator` is interpolated —
 * it always comes from the fixed `opMapping` set, never from user input.
 */
export function buildPgLikeRaw(
  client: Knex.Client | any,
  column: string,
  operator: string,
  target: unknown,
): Knex.Raw {
  return client.raw(`??::TEXT ${operator} ?`, [column, target]);
}
