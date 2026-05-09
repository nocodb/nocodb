import { UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { Column } from '~/models';

export * from 'src/helpers/metaColumnHelpers';
export function prepareMetaUpdateQuery({
  knex,
  colIds,
  props,
  metaColumn,
}: {
  knex: Knex;
  colIds: string[];
  props: Record<string, unknown>;
  metaColumn: Column;
}): Knex.Raw | void {
  if (!colIds || !colIds.length) {
    return;
  }

  if (metaColumn.uidt !== UITypes.Meta) {
    return;
  }

  const filteredColIds = colIds.filter(Boolean);

  if (!filteredColIds.length) {
    return;
  }

  // Build the update query using positional bindings instead of inlining the
  // serialized JSON via `.toString()`. The previous approach embedded the
  // JSON as a SQL string literal (`'<json>'::jsonb`) into the outer raw,
  // which meant any `?` character in user content (URLs, text, etc.) was
  // re-interpreted by knex's pg client as a placeholder and renumbered as
  // `$N`, leaving an orphan parameter slot — Postgres then raised
  // `42P18 indeterminate datatype` on the next save.
  //
  // With real bindings, knex sends each value to pg as a separate parameter
  // and never substitutes user content into the SQL text. `??` quotes the
  // column identifier; `?` binds each value.
  const propsJson = JSON.stringify(props);
  const bindings: any[] = [metaColumn.column_name];

  const expressions = filteredColIds.map((id) => {
    bindings.push(id, metaColumn.column_name, id, propsJson);
    return `jsonb_set(
    '{}'::jsonb,
    ARRAY[?::text],
    (
       COALESCE(COALESCE((??)::jsonb, '{}'::jsonb)->(?::text), '{}'::jsonb))
       || ?::jsonb)`;
  });

  return knex.raw(
    `COALESCE((??)::jsonb, '{}'::jsonb) || ${expressions.join(' || ')}`,
    bindings,
  );
}
