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

  const jsonObjQuery = knex.raw('?::jsonb', JSON.stringify(props)).toString();

  return knex.raw(
    `COALESCE((:column:)::jsonb, '{}'::jsonb) || ${colIds
      .map((id) => {
        const idString = knex.raw('?::text', [id]);

        return `jsonb_set(
    '{}'::jsonb,
    ARRAY[${idString}],
    (
       COALESCE(COALESCE((:column:)::jsonb, '{}'::jsonb)->(${knex.raw('?', [
         id,
       ])}::text), '{}'::jsonb))
       || ${jsonObjQuery})`;
      })
      .join(' || ')}`,
    {
      column: metaColumn.column_name,
    },
  );
}
