import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import type { NcContext } from '~/interface/config';
import type CacheMgr from '~/cache/CacheMgr';
import {
  getSingleQueryCache,
  setSingleQueryCache,
  SINGLE_QUERY_DEFAULT_VIEW,
} from '~/dbQueryClient/cross-db-utils/single-query-cache';
import NocoCache from '~/cache/NocoCache';
import RedisMockCacheMgr from '~/cache/RedisMockCacheMgr';
import Noco from '~/Noco';
import View from '~/models/View';
import { CacheScope } from '~/utils/globals';
import { NC_REDIS_GRACE_TTL, NC_REDIS_TTL } from '~/helpers/redisHelpers';

// Regression tests for the singleQuery cache parent/child linkage.
//
// Every entry is registered under a per-view parent SET
// (`singleQuery_v2:{modelId}:{viewIdOrDefault}:list`); `View.clearSingleQueryCache`
// invalidates by `deepDel(listKey, PARENT_TO_CHILD)`. The production incident
// (Postgres 42703 "column does not exist" after a column rename, fixed only by a
// manual cache flush) happened because entries were registered with a bare
// `sadd` that left the child's `parentKeys` empty:
//
//   - reads refresh the CHILD's TTL (via `getRaw` -> `execRefreshTTL`),
//   - but `refreshTTL` walks `parentKeys` to reach the SET, so nothing ever
//     refreshed the parent SET's TTL on a fully-warm cache,
//   - the SET expired after NC_REDIS_TTL while its children lived on -> the
//     children became orphans `clearSingleQueryCache` could never reach, so
//     schema changes silently stopped clearing the compiled SQL.
//
// The fix back-links the child to its parent SET, so a read refreshes both in
// lockstep. These tests drive the real cache helpers against an isolated
// ioredis-mock so the back-link and the SET's TTL can be inspected directly.
function _singleQueryCacheLinkageTests() {
  const PREFIX = 'nc:noco';
  const context: NcContext = {
    workspace_id: 'w_sq_linkage_test',
    base_id: 'p_sq_linkage_test',
  };

  const modelId = 'm_sq_linkage_test';
  const viewIdOrDefault = SINGLE_QUERY_DEFAULT_VIEW;
  const cacheKey = `${CacheScope.SINGLE_QUERY}:${modelId}:${viewIdOrDefault}:read:1`;
  const query = 'select 1 as "c_sq_linkage_test"';

  const ns = `${PREFIX}:${context.workspace_id}:${context.base_id}`;
  const childFull = `${ns}:${cacheKey}`;
  const listFull = `${ns}:${CacheScope.SINGLE_QUERY}:${modelId}:${viewIdOrDefault}:list`;

  const internals = NocoCache as unknown as {
    client: CacheMgr;
    prefix: string;
    cacheDisabled: boolean;
  };

  let prevClient: CacheMgr;
  let prevPrefix: string;
  let prevDisabled: boolean;
  let mock: RedisMockCacheMgr;
  let isEEStub: sinon.SinonStub;

  beforeEach(() => {
    prevClient = internals.client;
    prevPrefix = internals.prefix;
    prevDisabled = internals.cacheDisabled;

    mock = new RedisMockCacheMgr();
    internals.client = mock;
    internals.prefix = PREFIX;
    internals.cacheDisabled = false;

    // View.clearSingleQueryCache short-circuits outside EE
    isEEStub = sinon.stub(Noco, 'isEE').returns(true);
  });

  afterEach(async () => {
    isEEStub?.restore();
    await mock.client.flushall();
    mock.client.disconnect();
    internals.client = prevClient;
    internals.prefix = prevPrefix;
    internals.cacheDisabled = prevDisabled;
  });

  it('serves a registered entry', async () => {
    await setSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
      query,
    });

    expect(await getSingleQueryCache(context, cacheKey)).to.equal(query);
  });

  it('clearSingleQueryCache removes the entry', async () => {
    await setSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
      query,
    });

    await View.clearSingleQueryCache(context, modelId, []);

    expect(await getSingleQueryCache(context, cacheKey)).to.equal(null);
  });

  it('back-links the plan key to its :list SET via parentKeys', async () => {
    await setSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
      query,
    });

    // the entry is a member of the registry SET (additive membership)
    const members = await mock.client.smembers(listFull);
    expect(members).to.include(childFull);

    // and it links back to that SET so the refreshTTL cascade can keep the SET
    // alive whenever the entry is read — the absence of this was the bug
    const stored = JSON.parse(await mock.client.get(childFull));
    expect(stored.parentKeys).to.include(listFull);
  });

  it('refreshes the :list SET TTL when a plan key is read (prevents orphaning)', async () => {
    await setSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
      query,
    });

    // simulate the registry SET being close to expiry while the busy plan key
    // keeps getting read
    await mock.client.expire(listFull, 100);

    // age the plan key's stored timestamp past the grace TTL so the next read
    // triggers execRefreshTTL (reads only refresh when older than the grace)
    const stored = JSON.parse(await mock.client.get(childFull));
    stored.timestamp = Date.now() - (NC_REDIS_GRACE_TTL * 1000 + 60_000);
    await mock.client.set(
      childFull,
      JSON.stringify(stored),
      'EX',
      NC_REDIS_TTL,
    );

    // reading the plan key must cascade a TTL refresh up to the :list SET
    await getSingleQueryCache(context, cacheKey);

    // without the parentKeys back-link this stays ~100 (orphaning the entry);
    // with the fix it is bumped back to ~NC_REDIS_TTL - 60
    expect(await mock.client.ttl(listFull)).to.be.greaterThan(1000);
  });
}

export function singleQueryCacheLinkageTests() {
  describe('SingleQueryCacheLinkage', _singleQueryCacheLinkageTests);
}
