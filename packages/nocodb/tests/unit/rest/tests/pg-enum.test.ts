import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import init from '~test/init';
import { isPgData } from '~test/init/db';
import { createProject } from '~test/factory/base';
import { createTable } from '~test/factory/table';
import { createColumn, updateColumn } from '~test/factory/column';
import { listRow } from '~test/factory/row';
import Column from '~/models/Column';
import { pgQuoteLiteral } from '~/helpers/sqlSanitize';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import type Base from '~/models/Base';
import type Model from '~/models/Model';

const ENUM_SCHEMA_DEFAULT = 'public';

let enumCounter = 0;
const uniqueEnumName = (prefix = 'nc_test_enum') =>
  `${prefix}_${Date.now()}_${enumCounter++}`;


async function getSqlClientFor(base: Base) {
  const source = (await base.getSources())[0];
  const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
  // Reflection mode places NocoDB tables in a per-source schema rather than
  // `public`. Default to 'public' if no schema is configured.
  const tableSchema = source.getConfig()?.schema || 'public';
  return { sqlClient, source, tableSchema };
}

async function insertRows(
  context: any,
  base: Base,
  table: Model,
  rows: Record<string, any>[],
) {
  await request(context.app)
    .post(`/api/v1/db/data/bulk/noco/${base.id}/${table.id}`)
    .set('xc-auth', context.token)
    .send(rows)
    .expect(200);
}

// Convert an existing SingleSelect column into a native PG enum-backed
// column, mimicking what PgClient.columnList records during external-source
// introspection. Steps:
//   1. CREATE TYPE <schema>.<typeName> AS ENUM (...)
//   2. ALTER TABLE … ALTER COLUMN … TYPE <schema>.<typeName>
//   3. Persist dt='USER-DEFINED' + internal_meta on the Column row
async function bindColumnToNativeEnum({
  base,
  table,
  column,
  options,
  enumSchema = ENUM_SCHEMA_DEFAULT,
  enumName,
}: {
  base: Base;
  table: Model;
  column: Column;
  options: string[];
  enumSchema?: string;
  enumName: string;
}) {
  const { sqlClient, tableSchema } = await getSqlClientFor(base);

  await sqlClient.raw(`DROP TYPE IF EXISTS ??.?? CASCADE`, [
    enumSchema,
    enumName,
  ]);
  const inlinedLabels = options.map(pgQuoteLiteral).join(', ');
  await sqlClient.raw(
    `CREATE TYPE ??.?? AS ENUM (${inlinedLabels})`,
    [enumSchema, enumName],
  );
  await sqlClient.raw(
    `ALTER TABLE ??.?? ALTER COLUMN ?? TYPE ??.?? USING ??::text::??.??`,
    [
      tableSchema,
      table.table_name,
      column.column_name,
      enumSchema,
      enumName,
      column.column_name,
      enumSchema,
      enumName,
    ],
  );

  const ctx = {
    workspace_id: base.fk_workspace_id,
    base_id: base.id,
  };
  // Column.update's SingleSelect path deletes options then re-runs
  // insertColOption(input, ...). insertColOption switches on input.uidt —
  // if uidt is missing, every case is skipped and options never come back.
  // Spread the loaded column so uidt + colOptions both ride along.
  await Column.update(ctx, column.id, {
    ...(column as any),
    dt: 'USER-DEFINED',
    internal_meta: {
      pg_enum_type_name: enumName,
      pg_enum_schema_name: enumSchema,
    },
  } as any);

  const refreshed = (await table.getColumns(ctx)).find(
    (c) => c.id === column.id,
  ) as Column;
  await refreshed.getColOptions(ctx);
  return refreshed;
}

async function pgEnumValues(base: Base, enumName: string, schema = ENUM_SCHEMA_DEFAULT) {
  const { sqlClient } = await getSqlClientFor(base);
  const { rows } = await sqlClient.raw(
    `SELECT e.enumlabel
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = ? AND t.typname = ?
      ORDER BY e.enumsortorder`,
    [schema, enumName],
  );
  return rows.map((r: any) => r.enumlabel);
}

async function pgTypeExists(base: Base, enumName: string, schema = ENUM_SCHEMA_DEFAULT) {
  const { sqlClient } = await getSqlClientFor(base);
  const { rows } = await sqlClient.raw(
    `SELECT 1 FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = ? AND t.typname = ?`,
    [schema, enumName],
  );
  return rows.length > 0;
}

async function columnDefault(base: Base, table: Model, columnName: string) {
  const { sqlClient, tableSchema } = await getSqlClientFor(base);
  const { rows } = await sqlClient.raw(
    `SELECT column_default FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
        AND column_name = ?`,
    [tableSchema, table.table_name, columnName],
  );
  return rows[0]?.column_default ?? null;
}

async function columnTypeName(base: Base, table: Model, columnName: string) {
  const { sqlClient, tableSchema } = await getSqlClientFor(base);
  const { rows } = await sqlClient.raw(
    `SELECT t.typname AS typname
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_type t ON t.oid = a.atttypid
      WHERE n.nspname = ?
        AND c.relname = ?
        AND a.attname = ?
        AND a.attnum > 0`,
    [tableSchema, table.table_name, columnName],
  );
  return rows[0]?.typname ?? null;
}

function pgEnumTests() {
  let context;
  let base: Base;

  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
  });

  // Sole-owner: type referenced by exactly one column.
  describe('Sole-owner enum', () => {
    it('Add option uses ALTER TYPE ADD VALUE (no rebuild)', async () => {
      if (!isPgData(context)) return;

      const enumName = uniqueEnumName();
      const table = await createTable(context, base, {
        table_name: 'tEnumAdd',
        title: 'tEnumAdd',
        columns: [{ column_name: 'Id', title: 'Id', uidt: UITypes.ID }],
      });
      const col = await createColumn(context, table, {
        title: 'mood',
        uidt: UITypes.SingleSelect,
        column_name: 'mood',
        colOptions: { options: [{ title: 'red' }, { title: 'green' }] },
      });
      const native = await bindColumnToNativeEnum({
        base,
        table,
        column: col,
        options: ['red', 'green'],
        enumName,
      });

      await updateColumn(context, {
        table,
        column: native,
        attr: {
          ...native,
          uidt: UITypes.SingleSelect,
          colOptions: {
            options: [{ title: 'red' }, { title: 'green' }, { title: 'blue' }],
          },
        },
      });

      const labels = await pgEnumValues(base, enumName);
      expect(labels).to.have.members(['red', 'green', 'blue']);
      // Original type must remain (no rebuild path).
      expect(await pgTypeExists(base, enumName)).to.equal(true);
    });

    it('Rename option uses ALTER TYPE RENAME VALUE (rows reflect new label)', async () => {
      if (!isPgData(context)) return;

      const enumName = uniqueEnumName();
      const table = await createTable(context, base, {
        table_name: 'tEnumRename',
        title: 'tEnumRename',
        columns: [{ column_name: 'Id', title: 'Id', uidt: UITypes.ID }],
      });
      const col = await createColumn(context, table, {
        title: 'mood',
        uidt: UITypes.SingleSelect,
        column_name: 'mood',
        colOptions: { options: [{ title: 'red' }, { title: 'green' }] },
      });
      const native = await bindColumnToNativeEnum({
        base,
        table,
        column: col,
        options: ['red', 'green'],
        enumName,
      });

      await insertRows(context, base, table, [{ mood: 'red' }, { mood: 'green' }]);

      // Find option ids by title (don't rely on array order — Column.list
      // sorts by `order` which is assigned during insert and may not match
      // the input array).
      const redId = native.colOptions?.options?.find(
        (o: any) => o.title === 'red',
      )?.id;
      const greenId = native.colOptions?.options?.find(
        (o: any) => o.title === 'green',
      )?.id;
      expect(redId, 'red option id must be loaded').to.be.a('string');
      expect(greenId, 'green option id must be loaded').to.be.a('string');

      const updated = await updateColumn(context, {
        table,
        column: native,
        attr: {
          ...native,
          uidt: UITypes.SingleSelect,
          colOptions: {
            options: [
              { id: redId, title: 'crimson' },
              { id: greenId, title: 'green' },
            ],
          },
        },
      });
      expect(updated).to.exist;

      const labels = await pgEnumValues(base, enumName);
      expect(labels).to.have.members(['crimson', 'green']);

      const rows = await listRow({ base, table });
      const moods = rows.map((r: any) => r.mood).sort();
      expect(moods).to.deep.equal(['crimson', 'green']);
    });

    it('Remove option triggers rebuild and NULLs removed-value rows', async () => {
      if (!isPgData(context)) return;

      const enumName = uniqueEnumName();
      const table = await createTable(context, base, {
        table_name: 'tEnumRemove',
        title: 'tEnumRemove',
        columns: [{ column_name: 'Id', title: 'Id', uidt: UITypes.ID }],
      });
      const col = await createColumn(context, table, {
        title: 'mood',
        uidt: UITypes.SingleSelect,
        column_name: 'mood',
        colOptions: {
          options: [{ title: 'red' }, { title: 'green' }, { title: 'blue' }],
        },
      });
      const native = await bindColumnToNativeEnum({
        base,
        table,
        column: col,
        options: ['red', 'green', 'blue'],
        enumName,
      });

      await insertRows(context, base, table, [{ mood: 'red' }, { mood: 'green' }, { mood: 'blue' }]);

      const optById = (title: string) =>
        native.colOptions?.options?.find((o: any) => o.title === title)?.id;
      const redId = optById('red');
      const blueId = optById('blue');
      expect(redId).to.be.a('string');
      expect(blueId).to.be.a('string');

      await updateColumn(context, {
        table,
        column: native,
        attr: {
          ...native,
          uidt: UITypes.SingleSelect,
          colOptions: {
            options: [
              { id: redId, title: 'red' },
              { id: blueId, title: 'blue' },
            ],
          },
        },
      });

      const labels = await pgEnumValues(base, enumName);
      expect(labels).to.have.members(['red', 'blue']);

      const rows = await listRow({ base, table });
      const moods = rows.map((r: any) => r.mood).sort();
      // JS default sort coerces null to "null" string → 'blue' < 'null' < 'red'.
      expect(moods).to.deep.equal(['blue', null, 'red']);
    });

    it('Removing the option used as default clears the default', async () => {
      if (!isPgData(context)) return;

      const enumName = uniqueEnumName();
      const table = await createTable(context, base, {
        table_name: 'tEnumDefRej',
        title: 'tEnumDefRej',
        columns: [{ column_name: 'Id', title: 'Id', uidt: UITypes.ID }],
      });
      // Don't set cdf in createColumn — a text default would block the bind
      // helper's ALTER COLUMN TYPE (PG can't auto-cast a text default to the
      // new enum). Set the default after the column is enum-typed.
      const col = await createColumn(context, table, {
        title: 'mood',
        uidt: UITypes.SingleSelect,
        column_name: 'mood',
        colOptions: { options: [{ title: 'red' }, { title: 'green' }] },
      });
      const native = await bindColumnToNativeEnum({
        base,
        table,
        column: col,
        options: ['red', 'green'],
        enumName,
      });

      const ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
      await Column.update(ctx, native.id, {
        ...(native as any),
        cdf: 'red',
      } as any);
      const { sqlClient, tableSchema } = await getSqlClientFor(base);
      await sqlClient.raw(
        `ALTER TABLE ??.?? ALTER COLUMN ?? SET DEFAULT ${pgQuoteLiteral(
          'red',
        )}::??.??`,
        [
          tableSchema,
          table.table_name,
          native.column_name,
          ENUM_SCHEMA_DEFAULT,
          enumName,
        ],
      );
      const refreshed = (await table.getColumns(ctx)).find(
        (c) => c.id === native.id,
      ) as Column;

      const greenId = refreshed.colOptions?.options?.find(
        (o: any) => o.title === 'green',
      )?.id;
      expect(greenId).to.be.a('string');

      await updateColumn(context, {
        table,
        column: refreshed,
        attr: {
          ...refreshed,
          uidt: UITypes.SingleSelect,
          colOptions: {
            options: [{ id: greenId, title: 'green' }],
          },
        },
      });

      // The rebuild proceeds: 'red' is gone from the type, 'green' remains.
      const labels = await pgEnumValues(base, enumName);
      expect(labels).to.have.members(['green']);

      // Default was the removed option ('red'), so it's cleared on the
      // metadata and on the PG column.
      const post = (await table.getColumns(ctx)).find(
        (c) => c.id === native.id,
      ) as Column;
      expect(post.cdf == null || post.cdf === '').to.equal(true);

      const { rows: defaultRows } = await sqlClient.raw(
        `SELECT column_default
           FROM information_schema.columns
          WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
        [tableSchema, table.table_name, native.column_name],
      );
      expect(defaultRows[0]?.column_default == null).to.equal(true);
    });

    it('Default value survives a rebuild (kept option)', async () => {
      if (!isPgData(context)) return;

      const enumName = uniqueEnumName();
      const table = await createTable(context, base, {
        table_name: 'tEnumDefKeep',
        title: 'tEnumDefKeep',
        columns: [{ column_name: 'Id', title: 'Id', uidt: UITypes.ID }],
      });
      const col = await createColumn(context, table, {
        title: 'mood',
        uidt: UITypes.SingleSelect,
        column_name: 'mood',
        colOptions: {
          options: [{ title: 'red' }, { title: 'green' }, { title: 'blue' }],
        },
      });
      const native = await bindColumnToNativeEnum({
        base,
        table,
        column: col,
        options: ['red', 'green', 'blue'],
        enumName,
      });

      const ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
      await Column.update(ctx, native.id, {
        ...(native as any),
        cdf: 'red',
      } as any);
      const { sqlClient, tableSchema } = await getSqlClientFor(base);
      await sqlClient.raw(
        `ALTER TABLE ??.?? ALTER COLUMN ?? SET DEFAULT ${pgQuoteLiteral(
          'red',
        )}::??.??`,
        [
          tableSchema,
          table.table_name,
          native.column_name,
          ENUM_SCHEMA_DEFAULT,
          enumName,
        ],
      );
      const refreshed = (await table.getColumns(ctx)).find(
        (c) => c.id === native.id,
      ) as Column;

      // Remove 'green' → triggers rebuild; default is 'red' (kept).
      await updateColumn(context, {
        table,
        column: refreshed,
        attr: {
          ...refreshed,
          uidt: UITypes.SingleSelect,
          colOptions: {
            options: [
              {
                id: refreshed.colOptions?.options?.find(
                  (o: any) => o.title === 'red',
                )?.id,
                title: 'red',
              },
              {
                id: refreshed.colOptions?.options?.find(
                  (o: any) => o.title === 'blue',
                )?.id,
                title: 'blue',
              },
            ],
          },
        },
      });

      const def = await columnDefault(base, table, native.column_name);
      // Must include 'red' AND reference the rebuilt type — guards against a
      // false pass where the column still points at the renamed-old type
      // (e.g. `'red'::mood_nc_old_xyz`).
      expect(def, 'column DEFAULT should be re-applied after rebuild').to.match(
        /'red'/,
      );
      expect(def).to.include(enumName);
      expect(def).to.not.match(/_nc_old_/);
    });
  });

  // Shared: same type used by columns on multiple tables. Mutations must
  // fork into a new type for the touched column without affecting siblings.
  describe('Shared enum (fork)', () => {
    it('Rename forks: A gets new type, B is untouched', async () => {
      if (!isPgData(context)) return;

      const enumName = uniqueEnumName('shared_rename');
      const tableA = await createTable(context, base, {
        table_name: 'tSharedA',
        title: 'tSharedA',
        columns: [{ column_name: 'Id', title: 'Id', uidt: UITypes.ID }],
      });
      const tableB = await createTable(context, base, {
        table_name: 'tSharedB',
        title: 'tSharedB',
        columns: [{ column_name: 'Id', title: 'Id', uidt: UITypes.ID }],
      });
      const colA = await createColumn(context, tableA, {
        title: 'mood',
        uidt: UITypes.SingleSelect,
        column_name: 'mood',
        colOptions: { options: [{ title: 'red' }, { title: 'green' }] },
      });
      const colB = await createColumn(context, tableB, {
        title: 'mood',
        uidt: UITypes.SingleSelect,
        column_name: 'mood',
        colOptions: { options: [{ title: 'red' }, { title: 'green' }] },
      });

      // Bind A first, creating the type. Then bind B to the SAME type
      // without re-creating.
      const nativeA = await bindColumnToNativeEnum({
        base,
        table: tableA,
        column: colA,
        options: ['red', 'green'],
        enumName,
      });
      const { sqlClient, tableSchema } = await getSqlClientFor(base);
      await sqlClient.raw(
        `ALTER TABLE ??.?? ALTER COLUMN ?? TYPE ??.?? USING ??::text::??.??`,
        [
          tableSchema,
          tableB.table_name,
          colB.column_name,
          ENUM_SCHEMA_DEFAULT,
          enumName,
          colB.column_name,
          ENUM_SCHEMA_DEFAULT,
          enumName,
        ],
      );
      const ctxB = { workspace_id: base.fk_workspace_id, base_id: base.id };
      await Column.update(ctxB, colB.id, {
        ...(colB as any),
        dt: 'USER-DEFINED',
        internal_meta: {
          pg_enum_type_name: enumName,
          pg_enum_schema_name: ENUM_SCHEMA_DEFAULT,
        },
      } as any);
      const nativeB = (await tableB.getColumns(ctxB)).find(
        (c) => c.id === colB.id,
      ) as Column;
      await nativeB.getColOptions(ctxB);

      await insertRows(context, base, tableA, [
        { mood: 'red' },
        { mood: 'green' },
      ]);
      await insertRows(context, base, tableB, [
        { mood: 'red' },
        { mood: 'green' },
      ]);

      // Rename 'red' → 'crimson' on A. Should fork.
      const aOptByTitle = (title: string) =>
        nativeA.colOptions?.options?.find((o: any) => o.title === title)?.id;
      const aRedId = aOptByTitle('red');
      const aGreenId = aOptByTitle('green');
      expect(aRedId).to.be.a('string');
      expect(aGreenId).to.be.a('string');

      await updateColumn(context, {
        table: tableA,
        column: nativeA,
        attr: {
          ...nativeA,
          uidt: UITypes.SingleSelect,
          colOptions: {
            options: [
              { id: aRedId, title: 'crimson' },
              { id: aGreenId, title: 'green' },
            ],
          },
        },
      });

      // A now points at a NEW type; original type still has the old labels.
      const aTypeName = await columnTypeName(base, tableA, nativeA.column_name);
      const bTypeName = await columnTypeName(base, tableB, nativeB.column_name);
      expect(aTypeName).to.not.equal(enumName);
      expect(bTypeName).to.equal(enumName);

      const sharedLabels = await pgEnumValues(base, enumName);
      expect(sharedLabels).to.have.members(['red', 'green']);

      const newLabels = await pgEnumValues(base, aTypeName!);
      expect(newLabels).to.have.members(['crimson', 'green']);

      // A's renamed rows reflect the new label; B is untouched.
      const aRows = await listRow({ base, table: tableA });
      expect(aRows.map((r: any) => r.mood).sort()).to.deep.equal([
        'crimson',
        'green',
      ]);
      const bRows = await listRow({ base, table: tableB });
      expect(bRows.map((r: any) => r.mood).sort()).to.deep.equal([
        'green',
        'red',
      ]);

      // A's metadata must now point at the forked type.
      const ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
      const aRefreshed = (await tableA.getColumns(ctx)).find(
        (c) => c.id === nativeA.id,
      ) as Column;
      expect(aRefreshed.internal_meta?.pg_enum_type_name).to.not.equal(enumName);
      expect(aRefreshed.internal_meta?.pg_enum_type_name).to.equal(aTypeName);
    });

    it('Remove forks: A loses option (rows NULL), B keeps option and rows', async () => {
      if (!isPgData(context)) return;

      const enumName = uniqueEnumName('shared_remove');
      const tableA = await createTable(context, base, {
        table_name: 'tSharedRA',
        title: 'tSharedRA',
        columns: [{ column_name: 'Id', title: 'Id', uidt: UITypes.ID }],
      });
      const tableB = await createTable(context, base, {
        table_name: 'tSharedRB',
        title: 'tSharedRB',
        columns: [{ column_name: 'Id', title: 'Id', uidt: UITypes.ID }],
      });
      const colA = await createColumn(context, tableA, {
        title: 'mood',
        uidt: UITypes.SingleSelect,
        column_name: 'mood',
        colOptions: {
          options: [{ title: 'red' }, { title: 'green' }, { title: 'blue' }],
        },
      });
      const colB = await createColumn(context, tableB, {
        title: 'mood',
        uidt: UITypes.SingleSelect,
        column_name: 'mood',
        colOptions: {
          options: [{ title: 'red' }, { title: 'green' }, { title: 'blue' }],
        },
      });

      const nativeA = await bindColumnToNativeEnum({
        base,
        table: tableA,
        column: colA,
        options: ['red', 'green', 'blue'],
        enumName,
      });
      const { sqlClient, tableSchema } = await getSqlClientFor(base);
      await sqlClient.raw(
        `ALTER TABLE ??.?? ALTER COLUMN ?? TYPE ??.?? USING ??::text::??.??`,
        [
          tableSchema,
          tableB.table_name,
          colB.column_name,
          ENUM_SCHEMA_DEFAULT,
          enumName,
          colB.column_name,
          ENUM_SCHEMA_DEFAULT,
          enumName,
        ],
      );
      const ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
      await Column.update(ctx, colB.id, {
        ...(colB as any),
        dt: 'USER-DEFINED',
        internal_meta: {
          pg_enum_type_name: enumName,
          pg_enum_schema_name: ENUM_SCHEMA_DEFAULT,
        },
      } as any);

      await insertRows(context, base, tableA, [
        { mood: 'red' },
        { mood: 'green' },
        { mood: 'blue' },
      ]);
      await insertRows(context, base, tableB, [
        { mood: 'red' },
        { mood: 'green' },
        { mood: 'blue' },
      ]);

      // Remove 'green' on A.
      const aOptByTitle = (title: string) =>
        nativeA.colOptions?.options?.find((o: any) => o.title === title)?.id;
      const aRedId = aOptByTitle('red');
      const aBlueId = aOptByTitle('blue');
      expect(aRedId).to.be.a('string');
      expect(aBlueId).to.be.a('string');

      await updateColumn(context, {
        table: tableA,
        column: nativeA,
        attr: {
          ...nativeA,
          uidt: UITypes.SingleSelect,
          colOptions: {
            options: [
              { id: aRedId, title: 'red' },
              { id: aBlueId, title: 'blue' },
            ],
          },
        },
      });

      // Original (shared) type still has all three labels.
      const sharedLabels = await pgEnumValues(base, enumName);
      expect(sharedLabels).to.have.members(['red', 'green', 'blue']);

      // B still references the original type with all rows intact.
      const bTypeName = await columnTypeName(base, tableB, colB.column_name);
      expect(bTypeName).to.equal(enumName);
      const bRows = await listRow({ base, table: tableB });
      expect(bRows.map((r: any) => r.mood).sort()).to.deep.equal([
        'blue',
        'green',
        'red',
      ]);

      // A's row that held 'green' is NULL; the new type has only red+blue.
      const aTypeName = await columnTypeName(base, tableA, nativeA.column_name);
      expect(aTypeName).to.not.equal(enumName);
      const aLabels = await pgEnumValues(base, aTypeName!);
      expect(aLabels).to.have.members(['red', 'blue']);
      const aRows = await listRow({ base, table: tableA });
      const aMoods = aRows.map((r: any) => r.mood).sort();
      expect(aMoods).to.deep.equal(['blue', null, 'red']);
    });
  });

  describe('Conversion away from native enum', () => {
    it('SingleSelect (native enum) → SingleLineText preserves cell values', async () => {
      if (!isPgData(context)) return;

      const enumName = uniqueEnumName('conv_text');
      const table = await createTable(context, base, {
        table_name: 'tEnumToText',
        title: 'tEnumToText',
        columns: [{ column_name: 'Id', title: 'Id', uidt: UITypes.ID }],
      });
      const col = await createColumn(context, table, {
        title: 'mood',
        uidt: UITypes.SingleSelect,
        column_name: 'mood',
        colOptions: { options: [{ title: 'red' }, { title: 'green' }] },
      });
      const native = await bindColumnToNativeEnum({
        base,
        table,
        column: col,
        options: ['red', 'green'],
        enumName,
      });

      await insertRows(context, base, table, [{ mood: 'red' }, { mood: 'green' }]);

      await updateColumn(context, {
        table,
        column: native,
        attr: {
          ...native,
          uidt: UITypes.SingleLineText,
        },
      });

      const ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
      const after = (await table.getColumns(ctx)).find(
        (c) => c.id === native.id,
      ) as Column;
      expect(after.uidt).to.equal(UITypes.SingleLineText);
      expect(after.internal_meta?.pg_enum_type_name).to.equal(undefined);
      expect(after.internal_meta?.pg_enum_schema_name).to.equal(undefined);

      // Underlying PG column is no longer the native enum.
      const typeName = await columnTypeName(base, table, native.column_name);
      expect(typeName).to.not.equal(enumName);

      const rows = await listRow({ base, table });
      expect(rows.map((r: any) => r.mood).sort()).to.deep.equal([
        'green',
        'red',
      ]);
    });
  });

  describe('Driver scoping', () => {
    it('Cross-schema: enum in non-public schema is bound and updatable', async () => {
      if (!isPgData(context)) return;

      const otherSchema = `nc_test_es_${enumCounter++}`;
      const enumName = uniqueEnumName('cross_schema');
      const { sqlClient } = await getSqlClientFor(base);
      await sqlClient.raw(`CREATE SCHEMA IF NOT EXISTS ??`, [otherSchema]);
      try {
        const table = await createTable(context, base, {
          table_name: 'tCrossSchema',
          title: 'tCrossSchema',
          columns: [{ column_name: 'Id', title: 'Id', uidt: UITypes.ID }],
        });
        const col = await createColumn(context, table, {
          title: 'mood',
          uidt: UITypes.SingleSelect,
          column_name: 'mood',
          colOptions: { options: [{ title: 'red' }] },
        });

        const native = await bindColumnToNativeEnum({
          base,
          table,
          column: col,
          options: ['red'],
          enumSchema: otherSchema,
          enumName,
        });

        // Add a value via in-place ALTER TYPE — exercises the cross-schema
        // path (qualifiedEnumType built from internal_meta.pg_enum_schema_name).
        await updateColumn(context, {
          table,
          column: native,
          attr: {
            ...native,
            uidt: UITypes.SingleSelect,
            colOptions: {
              options: [{ title: 'red' }, { title: 'amber' }],
            },
          },
        });

        const labels = await pgEnumValues(base, enumName, otherSchema);
        expect(labels).to.have.members(['red', 'amber']);
      } finally {
        await sqlClient.raw(`DROP SCHEMA IF EXISTS ?? CASCADE`, [otherSchema]);
      }
    });
  });
}

export default function () {
  describe('PG native enum support', pgEnumTests);
}
