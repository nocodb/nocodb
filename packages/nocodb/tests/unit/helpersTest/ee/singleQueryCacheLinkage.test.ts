import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  getSingleQueryCache,
  setSingleQueryCache,
  SINGLE_QUERY_DEFAULT_VIEW,
} from '~/dbQueryClient/cross-db-utils/single-query-cache';
import type { NcContext } from '~/interface/config';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import View from '~/models/View';
import { CacheDelDirection, CacheGetType, CacheScope } from '~/utils/globals';

// Regression tests for the singleQuery cache parent/child linkage.
//
// `setSingleQueryCache` registers every entry under the
// `singleQuery:{modelId}:{viewIdOrDefault}:list` parent SET, and
// `View.clearSingleQueryCache` invalidates by deepDel-ing that SET. If the
// SET is ever lost while its children survive (TTL expiry — reads only
// refreshed the child's TTL when its `parentKeys` didn't include the SET —
// or Redis eviction), the children become orphans that invalidation can
// never reach: schema changes (e.g. a physical column rename) stop clearing
// the compiled SQL and every read fails with "column does not exist" until
// the cache is flushed manually. These tests pin the two defenses:
// the child→parent back-link, and refusing to serve unregistered entries.
function _singleQueryCacheLinkageTests() {
  const modelId = 'm_sq_linkage_test';
  const viewIdOrDefault = SINGLE_QUERY_DEFAULT_VIEW;
  const cacheKey = `${CacheScope.SINGLE_QUERY}:${modelId}:${viewIdOrDefault}:read:1`;
  const listKey = `${CacheScope.SINGLE_QUERY}:${modelId}:${viewIdOrDefault}:list`;
  const query = 'select 1 as "c_sq_linkage_test"';

  const context = {
    workspace_id: 'w_sq_linkage_test',
    base_id: 'p_sq_linkage_test',
  } as NcContext;

  // The helpers ride NocoCache — init the in-memory mock (used when no
  // Redis is configured). Skip if the cache is explicitly disabled.
  // `View.clearSingleQueryCache` short-circuits outside EE, so force it on.
  let isEEStub: sinon.SinonStub;

  before(function () {
    NocoCache.init();
    if (NocoCache.isCacheDisabled) this.skip();
    isEEStub = sinon.stub(Noco, 'isEE').returns(true);
  });

  after(function () {
    isEEStub?.restore();
  });

  beforeEach(async () => {
    await NocoCache.deepDel(context, listKey, CacheDelDirection.PARENT_TO_CHILD);
    await NocoCache.del(context, cacheKey);
  });

  it('serves a registered entry', async () => {
    await setSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
      query,
    });

    const cached = await getSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
    });
    expect(cached).to.equal(query);
  });

  it('clearSingleQueryCache removes the entry', async () => {
    await setSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
      query,
    });

    await View.clearSingleQueryCache(context, modelId, []);

    const cached = await getSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
    });
    expect(cached).to.equal(null);
    expect(
      await NocoCache.get(context, cacheKey, CacheGetType.TYPE_STRING),
    ).to.equal(null);
  });

  it('back-links the child to the parent SET so child-side deletes reach the list', async () => {
    await setSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
      query,
    });
    expect(
      await NocoCache.isInList(
        context,
        CacheScope.SINGLE_QUERY,
        [modelId, viewIdOrDefault],
        cacheKey,
      ),
    ).to.equal(true);

    // CHILD_TO_PARENT walks the child's parentKeys — only works if
    // setSingleQueryCache wrote the back-link
    await NocoCache.deepDel(
      context,
      cacheKey,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    expect(
      await NocoCache.isInList(
        context,
        CacheScope.SINGLE_QUERY,
        [modelId, viewIdOrDefault],
        cacheKey,
      ),
    ).to.equal(false);
  });

  it('refuses to serve an orphan whose parent SET is gone and drops it', async () => {
    await setSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
      query,
    });

    // simulate parent SET loss (TTL expiry / eviction) — child survives
    await NocoCache.del(context, listKey);

    const cached = await getSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
    });
    expect(cached).to.equal(null);

    // the orphan itself must be dropped so a later write re-registers cleanly
    expect(
      await NocoCache.get(context, cacheKey, CacheGetType.TYPE_STRING),
    ).to.equal(null);

    // and the normal write→read cycle recovers
    await setSingleQueryCache(context, {
      modelId,
      viewIdOrDefault,
      cacheKey,
      query,
    });
    expect(
      await getSingleQueryCache(context, {
        modelId,
        viewIdOrDefault,
        cacheKey,
      }),
    ).to.equal(query);
  });
}

export function singleQueryCacheLinkageTests() {
  describe('SingleQueryCacheLinkage', _singleQueryCacheLinkageTests);
}
