import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheScope, MetaTable } from '~/utils/globals';
import ModelStat from '~/ee/models/ModelStat';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const models = require('../../../../src/models');

// Chainable knex mock — every call records [method, args] and returns
// itself; `then` resolves with `awaitValue` so any chain is awaitable.
function makeKnexMock(awaitValue: any) {
  const calls: Array<{ method: string; args: any[] }> = [];
  const builder: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: any) => void) => resolve(awaitValue);
        }
        if (prop === 'calls') return calls;
        return (...args: any[]) => {
          calls.push({ method: prop, args });
          return builder;
        };
      },
    },
  );
  return builder;
}

function ctx() {
  return {
    workspace_id: 'wsxxx',
    base_id: 'baseyyy',
  };
}

function metaSourceStub(isMeta = true) {
  return {
    id: 'src1',
    isMeta: () => isMeta,
  };
}

function modelStub(overrides: Partial<any> = {}) {
  return {
    id: 'mdl1',
    fk_workspace_id: 'wsxxx',
    base_id: 'baseyyy',
    source_id: 'src1',
    mm: false,
    ...overrides,
  };
}

export function modelStatTests() {
  describe('ModelStat', () => {
    let ncMetaStub: {
      knexConnection: sinon.SinonStub;
      metaGet2: sinon.SinonStub;
      metaDelete: sinon.SinonStub;
      now: sinon.SinonStub;
    };

    let modelGetStub: sinon.SinonStub;
    let sourceGetStub: sinon.SinonStub;

    let cacheGetStub: sinon.SinonStub;
    let cacheSetStub: sinon.SinonStub;
    let cacheDelStub: sinon.SinonStub;

    beforeEach(() => {
      ncMetaStub = {
        knexConnection: sinon.stub(),
        metaGet2: sinon.stub(),
        metaDelete: sinon.stub().resolves(undefined),
        now: sinon.stub().returns('2026-05-14T00:00:00.000Z'),
      };
      sinon.stub(Noco, 'ncMeta' as any).get(() => ncMetaStub);

      cacheGetStub = sinon.stub(NocoCache, 'get').resolves(null as any);
      cacheSetStub = sinon.stub(NocoCache, 'set').resolves(undefined as any);
      cacheDelStub = sinon.stub(NocoCache, 'del').resolves(undefined as any);

      // Stubbing CE Model hits EE Model via the prototype chain — EE doesn't
      // override these statics.
      modelGetStub = sinon.stub(models.Model, 'get');
      sourceGetStub = sinon.stub(models.Source, 'get');
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('upsert', () => {
      it('coerces row_count to a clamped non-negative integer', async () => {
        const qb = makeKnexMock(undefined);
        ncMetaStub.knexConnection.returns(qb);
        modelGetStub.resolves(modelStub());
        sourceGetStub.resolves(metaSourceStub(true));
        ncMetaStub.metaGet2.resolves(undefined);

        // PG BIGINT count returns string — without coercion checkLimit's
        // `count + delta` becomes string concat.
        await ModelStat.upsert(ctx(), 'wsxxx', 'mdl1', {
          row_count: '100' as any,
        });

        const insertCall = qb.calls.find((c: any) => c.method === 'insert');
        expect(insertCall, 'insert was called').to.exist;
        expect(insertCall.args[0].row_count).to.equal(100);
        expect(typeof insertCall.args[0].row_count).to.equal('number');

        const mergeCall = qb.calls.find((c: any) => c.method === 'merge');
        expect(mergeCall, 'merge was called').to.exist;
        expect(mergeCall.args[0].row_count).to.equal(100);
      });

      it('coerces floats by truncating, and clamps negative deltas to 0', async () => {
        const qb = makeKnexMock(undefined);
        ncMetaStub.knexConnection.returns(qb);
        modelGetStub.resolves(modelStub());
        sourceGetStub.resolves(metaSourceStub(true));
        ncMetaStub.metaGet2.resolves(undefined);

        await ModelStat.upsert(ctx(), 'wsxxx', 'mdl1', {
          row_count: -5 as any,
        });
        let insertCall = qb.calls.find((c: any) => c.method === 'insert');
        expect(insertCall.args[0].row_count).to.equal(0);

        qb.calls.length = 0;
        await ModelStat.upsert(ctx(), 'wsxxx', 'mdl1', {
          row_count: 12.9 as any,
        });
        insertCall = qb.calls.find((c: any) => c.method === 'insert');
        expect(insertCall.args[0].row_count).to.equal(12);
      });

      it('stores is_external=true for non-meta sources', async () => {
        const qb = makeKnexMock(undefined);
        ncMetaStub.knexConnection.returns(qb);
        modelGetStub.resolves(modelStub());
        sourceGetStub.resolves(metaSourceStub(false)); // external
        ncMetaStub.metaGet2.resolves(undefined);

        await ModelStat.upsert(ctx(), 'wsxxx', 'mdl1', { row_count: 10 });

        const insertCall = qb.calls.find((c: any) => c.method === 'insert');
        expect(insertCall.args[0].is_external).to.equal(true);
      });

      it('bails out gracefully when model is gone', async () => {
        const qb = makeKnexMock(undefined);
        ncMetaStub.knexConnection.returns(qb);
        modelGetStub.resolves(null);

        const result = await ModelStat.upsert(ctx(), 'wsxxx', 'gone', {
          row_count: 10,
        });
        expect(result).to.equal(null);
        expect(
          qb.calls.find((c: any) => c.method === 'insert'),
          'should not have inserted',
        ).to.be.undefined;
      });

      it('invalidates both per-model and workspace sum cache entries', async () => {
        const qb = makeKnexMock(undefined);
        ncMetaStub.knexConnection.returns(qb);
        modelGetStub.resolves(modelStub());
        sourceGetStub.resolves(metaSourceStub(true));
        ncMetaStub.metaGet2.resolves(undefined);

        await ModelStat.upsert(ctx(), 'wsxxx', 'mdl1', { row_count: 5 });

        const delKeys = cacheDelStub.getCalls().map((c) => c.args[1] as string);
        expect(delKeys).to.include(`${CacheScope.MODEL_STAT}:wsxxx:mdl1`);
        expect(delKeys).to.include(`${CacheScope.MODEL_STAT}:wsxxx:sum`);
      });
    });

    describe('getWorkspaceSum', () => {
      it('coerces PG bigint SUM (string) to number', async () => {
        const qb = makeKnexMock({ sum: '1234' });
        ncMetaStub.knexConnection.returns(qb);

        const result = await ModelStat.getWorkspaceSum('wsxxx');

        expect(result.row_count).to.equal(1234);
        expect(typeof result.row_count).to.equal('number');
      });

      it('returns row_count=null when no MODEL_STAT rows match', async () => {
        // null (not 0) lets the caller trigger an initial full-recount.
        const qb = makeKnexMock({ sum: null });
        ncMetaStub.knexConnection.returns(qb);

        const result = await ModelStat.getWorkspaceSum('wsxxx');

        expect(result.row_count).to.equal(null);
      });

      it('left-joins MODELS and filters trashed tables out of the sum', async () => {
        const qb = makeKnexMock({ sum: '0' });
        ncMetaStub.knexConnection.returns(qb);

        await ModelStat.getWorkspaceSum('wsxxx');

        const joinCall = qb.calls.find((c: any) => c.method === 'leftJoin');
        expect(joinCall, 'leftJoin was called').to.exist;
        expect(joinCall.args[0]).to.equal(MetaTable.MODELS);

        const knexConnectionArg = ncMetaStub.knexConnection.firstCall.args[0];
        expect(knexConnectionArg).to.equal(MetaTable.MODEL_STAT);
      });

      it('reads from cache when present and skips the DB round-trip', async () => {
        cacheGetStub.resolves({ row_count: 42 });

        const result = await ModelStat.getWorkspaceSum('wsxxx');

        expect(result.row_count).to.equal(42);
        expect(ncMetaStub.knexConnection.called).to.equal(false);
      });

      it('caches the computed sum so the next read hits cache', async () => {
        const qb = makeKnexMock({ sum: '77' });
        ncMetaStub.knexConnection.returns(qb);

        await ModelStat.getWorkspaceSum('wsxxx');

        const setCalls = cacheSetStub.getCalls();
        expect(setCalls.length).to.be.greaterThan(0);
        const setArgs = setCalls[0].args;
        expect(setArgs[1]).to.equal(`${CacheScope.MODEL_STAT}:wsxxx:sum`);
        expect(setArgs[2]).to.deep.equal({ row_count: 77 });
      });
    });

    describe('invalidateWorkspaceSum', () => {
      it('drops the workspace sum cache key', async () => {
        await ModelStat.invalidateWorkspaceSum('wsxxx');

        const delCall = cacheDelStub
          .getCalls()
          .find((c) => c.args[1] === `${CacheScope.MODEL_STAT}:wsxxx:sum`);
        expect(delCall, 'workspace sum cache should be deleted').to.exist;
      });
    });

    describe('Model.softDelete (table trash hook)', () => {
      it('invalidates the workspace sum cache when a table is soft-deleted', async () => {
        const CEModel = Object.getPrototypeOf(models.Model);
        const ceSoftDeleteStub = sinon
          .stub(CEModel, 'softDelete')
          .resolves(undefined);

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const EEModel = require('../../../../src/ee/models/Model').default;

        await EEModel.softDelete(
          { workspace_id: 'wsxxx', base_id: 'baseyyy' },
          'mdl1',
          true,
        );

        expect(ceSoftDeleteStub.calledOnce, 'CE softDelete invoked').to.equal(
          true,
        );
        const delKeys = cacheDelStub.getCalls().map((c) => c.args[1] as string);
        expect(delKeys).to.include(`${CacheScope.MODEL_STAT}:wsxxx:sum`);
      });

      it('also invalidates on restore (soft-delete with deleted=false)', async () => {
        const CEModel = Object.getPrototypeOf(models.Model);
        sinon.stub(CEModel, 'softDelete').resolves(undefined);

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const EEModel = require('../../../../src/ee/models/Model').default;

        await EEModel.softDelete(
          { workspace_id: 'wsxxx', base_id: 'baseyyy' },
          'mdl1',
          false,
        );

        const delKeys = cacheDelStub.getCalls().map((c) => c.args[1] as string);
        expect(delKeys).to.include(`${CacheScope.MODEL_STAT}:wsxxx:sum`);
      });
    });

    describe('recount', () => {
      let getBaseModelSqlStub: sinon.SinonStub;

      beforeEach(() => {
        getBaseModelSqlStub = sinon.stub(models.Model, 'getBaseModelSQL');
      });

      it('counts via baseModel.count() and upserts the coerced value', async () => {
        const model = modelStub();
        sourceGetStub.resolves(metaSourceStub(true));
        // PG count returned as string.
        getBaseModelSqlStub.resolves({
          count: sinon.stub().resolves('999'),
        });

        const qb = makeKnexMock(undefined);
        ncMetaStub.knexConnection.returns(qb);
        modelGetStub.resolves(model);
        ncMetaStub.metaGet2.resolves({ row_count: 999 });

        const result = await ModelStat.recount(ctx(), model as any);

        expect(result).to.equal(999);
        const insertCall = qb.calls.find((c: any) => c.method === 'insert');
        expect(insertCall.args[0].row_count).to.equal(999);
        expect(typeof insertCall.args[0].row_count).to.equal('number');
      });

      it('skips mm junction tables (returns null without DB work)', async () => {
        const result = await ModelStat.recount(ctx(), {
          ...modelStub(),
          mm: true,
        } as any);

        expect(result).to.equal(null);
        expect(getBaseModelSqlStub.called).to.equal(false);
        expect(ncMetaStub.knexConnection.called).to.equal(false);
      });

      it('returns null when source is gone', async () => {
        sourceGetStub.resolves(null);

        const result = await ModelStat.recount(ctx(), modelStub() as any);

        expect(result).to.equal(null);
        expect(getBaseModelSqlStub.called).to.equal(false);
      });
    });
  });
}
