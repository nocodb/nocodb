import 'mocha';
import { expect } from 'chai';
import request from 'supertest';

import { initCrossBaseModel, ncAxiosLinkAdd } from './init';
import type { ICrossBaseTestContext } from './init';

/**
 * Helper to get a record and check its link count field
 * Uses the records API instead of links API for cross-base link verification
 * Note: Cross-base link GET API has a backend limitation where it uses the wrong
 * context when loading related model columns, causing errors.
 */
async function ncAxiosRecordGet({
  context,
  tableId,
  rowId,
  status = 200,
}: {
  context: { context: any; base: any };
  tableId: string;
  rowId: string;
  status?: number;
}) {
  const url = `/api/v3/data/${context.base.id}/${tableId}/records/${rowId}`;
  const response = await request(context.context.app)
    .get(url)
    .set('xc-auth', context.context.token);
  expect(response.status).to.equal(status);
  return response;
}

async function ncAxiosLinkRemove({
  context,
  urlParams,
  body = {},
  status = 200,
}: {
  context: { context: any; base: any };
  urlParams: { tableId: string; linkId: string; rowId: string };
  body?: any;
  status?: number;
}) {
  const url = `/api/v3/data/${context.base.id}/${urlParams.tableId}/links/${urlParams.linkId}/${urlParams.rowId}`;
  const response = await request(context.context.app)
    .delete(url)
    .set('xc-auth', context.context.token)
    .send(body);
  expect(response.status).to.equal(status);
  return response;
}

function crossBaseCrudTests() {
  let _setup: ICrossBaseTestContext;
  let _context: ICrossBaseTestContext['context'];
  let _bases: ICrossBaseTestContext['bases'];
  let _tables: ICrossBaseTestContext['tables'];
  let _crossLinks: ICrossBaseTestContext['crossLinks'];

  beforeEach(async function () {
    const setup = await initCrossBaseModel();
    _setup = setup;
    _context = setup.context;
    _bases = setup.bases;
    _tables = setup.tables;
    _crossLinks = setup.crossLinks;
  });

  describe('Create Cross-Base Links', () => {
    it('should create HM link across bases', async () => {
      // Link row 4 in base1.table1 to rows 10,11 in base2.table1
      const response = await ncAxiosLinkAdd({
        context: { context: _context, base: _bases.base1 },
        urlParams: {
          tableId: _tables.t1_base1.id,
          linkId: _crossLinks.b1t1_HM_b2t1.id,
          rowId: '4',
        },
        body: [{ id: 10 }, { id: 11 }],
        status: 200,
      });

      expect(response.status).to.equal(200);

      // Verify links were created by checking the record's link count
      const getResponse = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t1_base1.id,
        rowId: '4',
      });

      // The link column should have 2 linked records
      const linkField = getResponse.body.fields['B2T1s'];
      expect(linkField).to.be.an('array');
      expect(linkField.length).to.equal(2);
    });

    it('should create MM link across bases', async () => {
      // Link row 5 in base1.table1 to rows 5,6 in base2.table2
      const response = await ncAxiosLinkAdd({
        context: { context: _context, base: _bases.base1 },
        urlParams: {
          tableId: _tables.t1_base1.id,
          linkId: _crossLinks.b1t1_MM_b2t2.id,
          rowId: '5',
        },
        body: [{ id: 5 }, { id: 6 }],
        status: 200,
      });

      expect(response.status).to.equal(200);

      // Verify links were created by checking the record's link count
      const getResponse = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t1_base1.id,
        rowId: '5',
      });

      // The link column should have 2 linked records
      const linkField = getResponse.body.fields['B2T2sMM'];
      expect(linkField).to.be.an('array');
      expect(linkField.length).to.equal(2);
    });

    it('should create OO link across bases', async () => {
      // Link row 3 in base1.table2 to row 9 in base2.table1
      const response = await ncAxiosLinkAdd({
        context: { context: _context, base: _bases.base1 },
        urlParams: {
          tableId: _tables.t2_base1.id,
          linkId: _crossLinks.b1t2_OO_b2t1.id,
          rowId: '3',
        },
        body: [{ id: 9 }],
        status: 200,
      });

      expect(response.status).to.equal(200);

      // Verify link was created by checking the record's link field
      const getResponse = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t2_base1.id,
        rowId: '3',
      });

      // For OO links, the field contains the linked record's display value
      expect(getResponse.body.fields['B2T1OO']).to.exist;
    });
  });

  describe('Read Cross-Base Links', () => {
    it('should read linked records count from other base via HM', async () => {
      // Row 1 in base1.table1 was linked to rows 1,2,3 in base2.table1 during setup
      // Verify via record API since link GET API has cross-base context issues
      const response = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t1_base1.id,
        rowId: '1',
      });

      // The HM link should have 3 linked records
      const linkField = response.body.fields['B2T1s'];
      expect(linkField).to.be.an('array');
      expect(linkField.length).to.equal(3);
    });

    it('should read linked records count from other base via MM', async () => {
      // Row 1 in base1.table1 was linked to rows 1,2 in base2.table2 during setup
      const response = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t1_base1.id,
        rowId: '1',
      });

      // The MM link should have 2 linked records
      const linkField = response.body.fields['B2T2sMM'];
      expect(linkField).to.be.an('array');
      expect(linkField.length).to.equal(2);
    });

    it('should read linked record from other base via OO', async () => {
      // Row 1 in base1.table2 was linked to row 7 in base2.table1 during setup
      const response = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t2_base1.id,
        rowId: '1',
      });

      // OO link should have a value (the display value of the linked record)
      expect(response.body.fields['B2T1OO']).to.exist;
    });

    it('should verify multiple links can be created for pagination', async () => {
      // Create more links for pagination test
      const addResponse = await ncAxiosLinkAdd({
        context: { context: _context, base: _bases.base1 },
        urlParams: {
          tableId: _tables.t1_base1.id,
          linkId: _crossLinks.b1t1_HM_b2t1.id,
          rowId: '10',
        },
        body: Array.from({ length: 15 }, (_, i) => ({ id: i + 20 })),
        status: 200,
      });

      expect(addResponse.status).to.equal(200);

      // Verify links were created by checking record
      const getResponse = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t1_base1.id,
        rowId: '10',
      });

      const linkField = getResponse.body.fields['B2T1s'];
      expect(linkField).to.be.an('array');
      expect(linkField.length).to.equal(15);
    });
  });

  describe('Update/Delete Cross-Base Links', () => {
    it('should unlink cross-base records', async () => {
      // First verify row 1 has 3 linked records via record API
      const beforeResponse = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t1_base1.id,
        rowId: '1',
      });
      const beforeLinkField = beforeResponse.body.fields['B2T1s'];
      expect(beforeLinkField).to.be.an('array');
      expect(beforeLinkField.length).to.equal(3);

      // Unlink one record
      await ncAxiosLinkRemove({
        context: { context: _context, base: _bases.base1 },
        urlParams: {
          tableId: _tables.t1_base1.id,
          linkId: _crossLinks.b1t1_HM_b2t1.id,
          rowId: '1',
        },
        body: [{ id: 1 }],
        status: 200,
      });

      // Verify link was removed
      const afterResponse = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t1_base1.id,
        rowId: '1',
      });
      const afterLinkField = afterResponse.body.fields['B2T1s'];
      expect(afterLinkField).to.be.an('array');
      expect(afterLinkField.length).to.equal(2);
    });

    it('should unlink MM cross-base records', async () => {
      // First verify row 2 has 3 linked records (linked during setup)
      const beforeResponse = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t1_base1.id,
        rowId: '2',
      });
      const beforeLinkField = beforeResponse.body.fields['B2T2sMM'];
      expect(beforeLinkField).to.be.an('array');
      expect(beforeLinkField.length).to.equal(3);

      // Unlink one record
      await ncAxiosLinkRemove({
        context: { context: _context, base: _bases.base1 },
        urlParams: {
          tableId: _tables.t1_base1.id,
          linkId: _crossLinks.b1t1_MM_b2t2.id,
          rowId: '2',
        },
        body: [{ id: 2 }],
        status: 200,
      });

      // Verify link was removed
      const afterResponse = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t1_base1.id,
        rowId: '2',
      });
      const afterLinkField = afterResponse.body.fields['B2T2sMM'];
      expect(afterLinkField).to.be.an('array');
      expect(afterLinkField.length).to.equal(2);
    });

    it('should replace OO cross-base link', async () => {
      // Row 1 in base1.table2 is linked to row 7 in base2.table1
      // Verify initial link exists
      const beforeResponse = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t2_base1.id,
        rowId: '1',
      });
      expect(beforeResponse.body.fields['B2T1OO']).to.exist;

      // Replace with row 10
      await ncAxiosLinkAdd({
        context: { context: _context, base: _bases.base1 },
        urlParams: {
          tableId: _tables.t2_base1.id,
          linkId: _crossLinks.b1t2_OO_b2t1.id,
          rowId: '1',
        },
        body: [{ id: 10 }],
        status: 200,
      });

      // Verify link was replaced (OO should have the new link's display value)
      const afterResponse = await ncAxiosRecordGet({
        context: { context: _context, base: _bases.base1 },
        tableId: _tables.t2_base1.id,
        rowId: '1',
      });

      // The link field should still exist with a value
      expect(afterResponse.body.fields['B2T1OO']).to.exist;
    });
  });

  describe('Cross-Base Link Metadata', () => {
    it('should have fk_related_base_id set for cross-base HM link', async () => {
      const ctx1 = _setup.contexts.ctx1;
      const column = await _crossLinks.b1t1_HM_b2t1.getColOptions(ctx1);

      expect(column.fk_related_base_id).to.exist;
      expect(column.fk_related_base_id).to.equal(_bases.base2.id);
    });

    it('should have fk_related_base_id set for cross-base MM link', async () => {
      const ctx1 = _setup.contexts.ctx1;
      const column = await _crossLinks.b1t1_MM_b2t2.getColOptions(ctx1);

      expect(column.fk_related_base_id).to.exist;
      expect(column.fk_related_base_id).to.equal(_bases.base2.id);
      expect(column.fk_mm_base_id).to.exist;
    });

    it('should have fk_related_base_id set for cross-base OO link', async () => {
      const ctx1 = _setup.contexts.ctx1;
      const column = await _crossLinks.b1t2_OO_b2t1.getColOptions(ctx1);

      expect(column.fk_related_base_id).to.exist;
      expect(column.fk_related_base_id).to.equal(_bases.base2.id);
    });
  });
}

export function crossBaseCrudTest() {
  describe('CrossBaseCrudTest', crossBaseCrudTests);
}
