import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Three base-scoped tables still key without base_id, so their keys are globally
// unique instead of unique per base. nc_092 and nc_013 moved every other base-scoped
// table to a composite key and these were missed — nc_permission_subjects and
// nc_rls_policy_subjects are the same shape and only the first was converted.
//
// The consequence is that two bases cannot hold the same row id, which breaks every
// id-preserving copy (snapshots, and any cross-base copy where the source survives)
// with a unique violation as soon as these tables are serialized.

const LOG = '[nc_202607271818_composite_pk_missing_tables_2]';

// `old` is retained as a plain index so lookups still querying by the previous key
// stay indexed — same convention as nc_013's `_oldpk_idx`.
const COMPOSITE_PKS: Record<
  string,
  { pk: string[]; old: string[]; name: string }
> = {
  [MetaTable.RLS_POLICY_SUBJECTS]: {
    pk: ['base_id', 'fk_rls_policy_id', 'subject_type', 'subject_id'],
    old: ['fk_rls_policy_id', 'subject_type', 'subject_id'],
    name: 'nc_rls_policy_subjects_pk',
  },
  [MetaTable.VIEW_SECTIONS]: {
    pk: ['base_id', 'id'],
    old: ['id'],
    name: 'nc_view_sections_pkey',
  },
};

// Not a primary key but a standalone unique index, and it has the same problem: the
// gantt view id it keys on is preserved by every copy, so a copied base collides with
// the source it was copied from.
const DATE_DEP_UNIQUE = 'nc_date_dep_gantt_view_id_unique';

const up = async (knex: Knex) => {
  const start = Date.now();
  console.log(`${LOG} starting`);

  // A composite key cannot span a nullable column, and rows with no base_id are
  // already unreachable through any base-scoped query.
  for (const table of [
    ...Object.keys(COMPOSITE_PKS),
    MetaTable.DATE_DEPENDENCY,
  ]) {
    const deleted = await knex(table).whereNull('base_id').del();
    if (deleted > 0) {
      console.log(
        `${LOG} removed ${deleted} rows with null base_id from ${table}`,
      );
    }
  }

  for (const [table, { pk, old, name }] of Object.entries(COMPOSITE_PKS)) {
    const tableStart = Date.now();

    await knex.schema.alterTable(table, (t) => {
      t.dropPrimary(name);
    });
    await knex.schema.alterTable(table, (t) => {
      t.primary(pk, name);
    });
    await knex.schema.alterTable(table, (t) => {
      t.index(old, `${table}_oldpk_idx`);
    });

    console.log(
      `${LOG} ${table} -> pk (${pk.join(', ')}) in ${
        Date.now() - tableStart
      }ms`,
    );
  }

  await knex.schema.alterTable(MetaTable.DATE_DEPENDENCY, (t) => {
    t.dropUnique(['fk_gantt_view_id'], DATE_DEP_UNIQUE);
  });
  await knex.schema.alterTable(MetaTable.DATE_DEPENDENCY, (t) => {
    t.unique(['base_id', 'fk_gantt_view_id'], { indexName: DATE_DEP_UNIQUE });
  });
  console.log(
    `${LOG} ${MetaTable.DATE_DEPENDENCY} -> unique (base_id, fk_gantt_view_id)`,
  );

  console.log(`${LOG} done in ${Date.now() - start}ms`);
};

const down = async (knex: Knex) => {
  const start = Date.now();
  console.log(`${LOG} rolling back`);

  await knex.schema.alterTable(MetaTable.DATE_DEPENDENCY, (t) => {
    t.dropUnique(['base_id', 'fk_gantt_view_id'], DATE_DEP_UNIQUE);
  });
  await knex.schema.alterTable(MetaTable.DATE_DEPENDENCY, (t) => {
    t.unique(['fk_gantt_view_id'], { indexName: DATE_DEP_UNIQUE });
  });

  for (const [table, { old, name }] of Object.entries(COMPOSITE_PKS)) {
    await knex.schema.alterTable(table, (t) => {
      t.dropIndex(old, `${table}_oldpk_idx`);
    });
    await knex.schema.alterTable(table, (t) => {
      t.dropPrimary(name);
    });
    await knex.schema.alterTable(table, (t) => {
      t.primary(old, name);
    });
    console.log(`${LOG} ${table} -> pk (${old.join(', ')})`);
  }

  console.log(`${LOG} rollback done in ${Date.now() - start}ms`);
};

export { up, down };
