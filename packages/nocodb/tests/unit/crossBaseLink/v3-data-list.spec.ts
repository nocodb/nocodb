import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import { createColumn, customColumns } from '../factory/column';
import { createBulkRows } from '../factory/row';
import { createTable } from '../factory/table';
import { createProject } from '../factory/base';
import init from '../init';
import { CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import type Base from '../../../src/models/Base';
import type { Model } from '../../../src/models';

/**
 * Regression tests for cross-base v3 data list.
 *
 * Production bug: getRelatedModelInfo crashed with
 *   TypeError: Cannot read properties of undefined (reading 'getColumns')
 * when a cross-base related model had orphaned LTAR columns pointing to
 * deleted tables, or when getRelContext was called with wrong context.
 */

interface TestSetup {
  context: Awaited<ReturnType<typeof init>>;
  base1: Base;
  base2: Base;
  b1Table1: Model;
  b2Table1: Model;
  b2Table2: Model;
}

const titleColumns = [
  {
    title: 'Title',
    column_name: 'Title',
    uidt: UITypes.SingleLineText,
    pv: true,
  },
];

/**
 * Creates a minimal cross-base setup:
 *
 *   Base1.Table1  ──HM──▶  Base2.Table1  ──HM──▶  Base2.Table2
 *                (cross-base)            (same-base)
 *
 * When listing Base1.Table1 records, buildModelMaps recurses into
 * Base2.Table1 (cross-base), then resolves same-base links.
 */
async function setupCrossBaseWithSameBaseLink(): Promise<TestSetup> {
  const context = await init();

  const base1 = await createProject(context, {
    title: 'V3DataListBase1',
  });
  const base2 = await createProject(context, {
    title: 'V3DataListBase2',
  });

  // Base1: Table1
  const b1Table1 = await createTable(context, base1, {
    title: 'B1Table1',
    table_name: 'b1_table1',
    columns: customColumns('custom', titleColumns),
  });
  await createBulkRows(context, {
    base: base1,
    table: b1Table1,
    values: Array.from({ length: 5 }, (_, i) => ({
      Title: `B1T1_${i + 1}`,
    })),
  });

  // Base2: Table1
  const b2Table1 = await createTable(context, base2, {
    title: 'B2Table1',
    table_name: 'b2_table1',
    columns: customColumns('custom', titleColumns),
  });
  await createBulkRows(context, {
    base: base2,
    table: b2Table1,
    values: Array.from({ length: 5 }, (_, i) => ({
      Title: `B2T1_${i + 1}`,
    })),
  });

  // Base2: Table2
  const b2Table2 = await createTable(context, base2, {
    title: 'B2Table2',
    table_name: 'b2_table2',
    columns: customColumns('custom', titleColumns),
  });
  await createBulkRows(context, {
    base: base2,
    table: b2Table2,
    values: Array.from({ length: 5 }, (_, i) => ({
      Title: `B2T2_${i + 1}`,
    })),
  });

  // Same-base link within base2: B2Table1 HM → B2Table2
  await createColumn(context, b2Table1, {
    title: 'B2T2s',
    column_name: 'B2T2s',
    uidt: UITypes.LinkToAnotherRecord,
    parentId: b2Table1.id,
    childId: b2Table2.id,
    type: 'hm',
  });

  // Cross-base link: B1Table1 HM → B2Table1
  await createColumn(context, b1Table1, {
    title: 'B2T1s',
    column_name: 'B2T1s',
    uidt: UITypes.LinkToAnotherRecord,
    parentId: b1Table1.id,
    childId: b2Table1.id,
    ref_base_id: base2.id,
    type: 'hm',
  });

  // Establish some cross-base links
  const crossBaseLinkCol = (
    await b1Table1.getColumns({
      workspace_id: base1.fk_workspace_id,
      base_id: base1.id,
    })
  ).find((c) => c.title === 'B2T1s');

  await request(context.app)
    .post(
      `/api/v3/data/${base1.id}/${b1Table1.id}/links/${crossBaseLinkCol.id}/1`,
    )
    .set('xc-auth', context.token)
    .send([{ id: 1 }, { id: 2 }])
    .expect(200);

  // Establish some same-base links in base2
  const sameBaseLinkCol = (
    await b2Table1.getColumns({
      workspace_id: base2.fk_workspace_id,
      base_id: base2.id,
    })
  ).find((c) => c.title === 'B2T2s');

  await request(context.app)
    .post(
      `/api/v3/data/${base2.id}/${b2Table1.id}/links/${sameBaseLinkCol.id}/1`,
    )
    .set('xc-auth', context.token)
    .send([{ id: 1 }, { id: 2 }])
    .expect(200);

  return { context, base1, base2, b1Table1, b2Table1, b2Table2 };
}

function crossBaseV3DataListTests() {
  let setup: TestSetup;

  beforeEach(async function () {
    setup = await setupCrossBaseWithSameBaseLink();
  });

  it('should list records when cross-base related model has same-base links (linksAsLtar)', async () => {
    // buildModelMaps recurses into Base2.Table1 (cross-base), then tries
    // to resolve the same-base HM on Base2.Table1 → Base2.Table2.
    const response = await request(setup.context.app)
      .get(
        `/api/v3/data/${setup.base1.id}/${setup.b1Table1.id}/records?linksAsLtar=true`,
      )
      .set('xc-auth', setup.context.token)
      .expect(200);

    expect(response.body.records).to.be.an('array');
    expect(response.body.records.length).to.be.greaterThan(0);

    // Verify cross-base link data is present on the first record
    const firstRecord = response.body.records[0];
    expect(firstRecord.fields).to.have.property('B2T1s');
  });

  it('should list records without linksAsLtar when cross-base related model has same-base links', async () => {
    const response = await request(setup.context.app)
      .get(`/api/v3/data/${setup.base1.id}/${setup.b1Table1.id}/records`)
      .set('xc-auth', setup.context.token)
      .expect(200);

    expect(response.body.records).to.be.an('array');
    expect(response.body.records.length).to.be.greaterThan(0);
  });

  it('should get a single record when cross-base related model has same-base links', async () => {
    const response = await request(setup.context.app)
      .get(
        `/api/v3/data/${setup.base1.id}/${setup.b1Table1.id}/records/1?linksAsLtar=true`,
      )
      .set('xc-auth', setup.context.token)
      .expect(200);

    expect(response.body).to.have.property('fields');
    expect(response.body.fields).to.have.property('B2T1s');
  });

  it('should not crash when cross-base related model is deleted (orphaned column)', async () => {
    // Simulate the production crash scenario: the related model's metadata
    // is deleted but the LTAR column still references it.
    // Without the null guard in getRelatedModelInfo, this would crash with:
    //   TypeError: Cannot read properties of undefined (reading 'getColumns')

    const ctx2 = {
      workspace_id: setup.base2.fk_workspace_id,
      base_id: setup.base2.id,
    };

    // Delete the related model (Base2.Table1) directly from metadata,
    // bypassing the normal deletion flow to leave the LTAR column orphaned.
    await Noco.ncMeta.metaDelete(
      ctx2.workspace_id,
      ctx2.base_id,
      MetaTable.MODELS,
      setup.b2Table1.id,
    );

    // Clear the model cache so the deleted model isn't found in cache
    await NocoCache.del(ctx2, `${CacheScope.MODEL}:${setup.b2Table1.id}`);

    // Listing records should succeed (skipping the orphaned column)
    // instead of crashing with TypeError
    const response = await request(setup.context.app)
      .get(`/api/v3/data/${setup.base1.id}/${setup.b1Table1.id}/records`)
      .set('xc-auth', setup.context.token)
      .expect(200);

    expect(response.body.records).to.be.an('array');
    expect(response.body.records.length).to.be.greaterThan(0);
  });
}

export function crossBaseV3DataListTest() {
  describe('CrossBaseV3DataList', crossBaseV3DataListTests);
}
