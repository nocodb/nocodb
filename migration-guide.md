# NocoDB Migration Guide

## Where to add migrations

All new migrations go in `packages/nocodb/src/meta/migrations/v0/`.

`XcMigrationSource`, `XcMigrationSourcev2`, and `XcMigrationSourcev3` are **deprecated**. Only `XcMigrationSourcev0` is active.

## Rules

1. **Never modify existing migrations** — e.g. don't alter `nc_001_init.ts`. Create a new migration file instead.
2. **Make migrations idempotent** — always check `hasColumn`/`hasTable` before altering. This ensures the migration works for both fresh installs and upgrades.
3. **Use sequential numbering** — check the latest file in `v0/` and increment (e.g. `nc_019_...`).

## Steps to create a migration

### 1. Create the migration file

```
packages/nocodb/src/meta/migrations/v0/nc_NNN_descriptive_name.ts
```

Template:

```ts
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  const hasColumn = await knex.schema.hasColumn('table_name', 'column_name');
  if (!hasColumn) {
    await knex.schema.alterTable('table_name', (table) => {
      table.boolean('column_name').defaultTo(true);
    });
  }
};

const down = async (knex: Knex) => {
  const hasColumn = await knex.schema.hasColumn('table_name', 'column_name');
  if (hasColumn) {
    await knex.schema.alterTable('table_name', (table) => {
      table.dropColumn('column_name');
    });
  }
};

export { up, down };
```

### 2. Register in XcMigrationSourcev0

File: `packages/nocodb/src/meta/migrations/XcMigrationSourcev0.ts`

Three changes needed:

```ts
// 1. Add import at top
import * as nc_NNN_descriptive_name from './v0/nc_NNN_descriptive_name';

// 2. Add to getMigrations() array
'nc_NNN_descriptive_name',

// 3. Add case to getMigration() switch
case 'nc_NNN_descriptive_name':
  return nc_NNN_descriptive_name;
```

## Table name reference

Use `MetaTable` enum from `~/utils/globals` for known tables (e.g. `MetaTable.FILTER_EXP` → `nc_filter_exp_v2`), or raw table name strings for others.

## Swagger

When adding new columns, update the schema in `packages/nocodb/src/schema/swagger.json`. Use `$ref` to existing schema definitions where possible (e.g. `"$ref": "#/components/schemas/Bool"` instead of inline `oneOf` type definitions).
