import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import init from '~test/init';
import { createProject } from '~test/factory/base';
import { createTable } from '~test/factory/table';
import Noco from '~/Noco';
import { Base, Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

type Context = Awaited<ReturnType<typeof init>>;

// Count knex.raw() calls that issued a `DROP SCHEMA … CASCADE` for `schema`.
function dropSchemaCallsFor(spy: sinon.SinonSpy, schema: string): number {
  return spy.getCalls().filter((c) => {
    const sql = c.args?.[0];
    const bindings = c.args?.[1];
    return (
      typeof sql === 'string' &&
      sql.includes('DROP SCHEMA') &&
      Array.isArray(bindings) &&
      bindings.includes(schema)
    );
  }).length;
}

export function baseHardDeleteSchemaTests() {
  describe('Internal API - Base hard delete drops workspace schema', () => {
    let context: Context;
    let base: any;
    let ctx: { workspace_id: string; base_id: string };

    before(function () {
      // The per-base PG schema only exists when data reflection is on.
      // Under `test:unit:pg:ee` reflection is disabled — skip there; this
      // runs under `test:unit:pg:ee:reflection`.
      if (process.env.NC_DISABLE_PG_DATA_REFLECTION === 'true') {
        this.skip();
      }
    });

    beforeEach(async () => {
      context = await init();
      base = await createProject(context);
      ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
    });

    afterEach(() => {
      sinon.restore();
    });

    it('drops the base schema on the source data connection, not the meta connection', async () => {
      // Creating a table guarantees the per-base schema + a table exist.
      await createTable(context, base);

      const sources = await Source.list(ctx, { baseId: base.id });
      const localSource = sources.find((s) => s.isMeta(true, 1));
      expect(localSource, 'expected a reflected (is_local) source').to.not.be
        .undefined;

      const schema = (localSource as any).getConfig()?.schema;
      expect(schema, 'is_local source should carry a per-base schema').to.eq(
        base.id,
      );

      // The source data connection — in cloud this is the workspace DB on the
      // assigned db_server; even in the single-DB test env it is a distinct
      // knex pool from ncMeta.knex, which is exactly what the fix relies on.
      const sourceKnex = await NcConnectionMgrv2.get(localSource as any);
      expect(
        sourceKnex,
        'source connection must differ from the meta connection',
      ).to.not.equal(Noco.ncMeta.knex);

      // Precondition: the schema exists before the delete.
      const before = await sourceKnex.raw(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?`,
        [schema],
      );
      expect(before.rows?.length, 'schema should exist before delete').to.eq(1);

      const sourceRawSpy = sinon.spy(sourceKnex, 'raw');
      const metaRawSpy = sinon.spy(Noco.ncMeta.knex, 'raw');

      await Base.delete(ctx, base.id);

      // The DROP SCHEMA must go through the source data connection …
      expect(
        dropSchemaCallsFor(sourceRawSpy, schema),
        'DROP SCHEMA should run on the source data connection',
      ).to.eq(1);

      // … and never through the meta connection.
      expect(
        dropSchemaCallsFor(metaRawSpy, schema),
        'DROP SCHEMA must not run on the meta connection',
      ).to.eq(0);
    });
  });
}
