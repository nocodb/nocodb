import { expect } from 'chai';
import {
  lookupParent,
  lookupEntity,
  captureOldTitle,
  lookupEntityWithParent,
} from '../../../src/ee/command-registry/_resolvers';

const fakeCtx = {} as any;

function fakeModel(rows: Record<string, any>) {
  return {
    get: async (_ctx: any, id: any) => rows[String(id)],
  };
}

describe('_resolvers', () => {
  it('lookupParent reads model by idKey, returns parentEntityTitle', async () => {
    const M = fakeModel({ t1: { title: 'My Table' } });
    const r = lookupParent('tableId', M);
    expect(await r(fakeCtx, { tableId: 't1' })).to.deep.equal({
      parentEntityTitle: 'My Table',
    });
  });

  it('lookupParent handles missing entity gracefully', async () => {
    const M = fakeModel({});
    const r = lookupParent('tableId', M);
    expect(await r(fakeCtx, { tableId: 'missing' })).to.deep.equal({
      parentEntityTitle: undefined,
    });
  });

  it('lookupEntity returns entityTitle', async () => {
    const M = fakeModel({ s1: { title: 'My Script' } });
    const r = lookupEntity('scriptId', M);
    expect(await r(fakeCtx, { scriptId: 's1' })).to.deep.equal({
      entityTitle: 'My Script',
    });
  });

  it('captureOldTitle returns extra.oldTitle', async () => {
    const M = fakeModel({ d1: { title: 'My Dashboard' } });
    const r = captureOldTitle('dashboardId', M);
    expect(await r(fakeCtx, { dashboardId: 'd1' })).to.deep.equal({
      extra: { oldTitle: 'My Dashboard' },
    });
  });

  it('lookupEntityWithParent reads child + parent via FK', async () => {
    const View = fakeModel({
      v1: { title: 'My View', fk_model_id: 't1' },
    });
    const Model = fakeModel({ t1: { title: 'My Table' } });
    const r = lookupEntityWithParent('viewId', View, 'fk_model_id', Model);
    expect(await r(fakeCtx, { viewId: 'v1' })).to.deep.equal({
      entityTitle: 'My View',
      parentEntityTitle: 'My Table',
    });
  });

  it('lookupEntityWithParent with captureOldTitle adds extra.oldTitle', async () => {
    const View = fakeModel({ v1: { title: 'V', fk_model_id: 't1' } });
    const Model = fakeModel({ t1: { title: 'T' } });
    const r = lookupEntityWithParent(
      'viewId',
      View,
      'fk_model_id',
      Model,
      { captureOldTitle: true },
    );
    expect(await r(fakeCtx, { viewId: 'v1' })).to.deep.equal({
      entityTitle: 'V',
      parentEntityTitle: 'T',
      extra: { oldTitle: 'V' },
    });
  });

  it('lookupEntityWithParent returns {} when child missing', async () => {
    const View = fakeModel({});
    const Model = fakeModel({});
    const r = lookupEntityWithParent('viewId', View, 'fk_model_id', Model);
    expect(await r(fakeCtx, { viewId: 'missing' })).to.deep.equal({});
  });

  it('lookupEntityWithParent skips parent fetch when FK missing', async () => {
    const View = fakeModel({ v1: { title: 'V', fk_model_id: null } });
    const Model = fakeModel({});
    const r = lookupEntityWithParent('viewId', View, 'fk_model_id', Model);
    expect(await r(fakeCtx, { viewId: 'v1' })).to.deep.equal({
      entityTitle: 'V',
      parentEntityTitle: undefined,
    });
  });
});
