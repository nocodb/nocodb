import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../init';

export default function () {
  describe(`Sorts v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let tableId: string;
    let viewId: string;
    let fieldId: string;
    let API_PREFIX: string;

    beforeEach(async () => {
      context = await init();
      const workspaceId = context.fk_workspace_id;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'SortTestBase' })
        .expect(200);
      initBase = baseResult.body;
      API_PREFIX = `/api/v3/meta/bases/${initBase.id}`;

      // Create table with fields for sorting
      const tableResult = await request(context.app)
        .post(`${API_PREFIX}/tables`)
        .set('xc-auth', context.token)
        .send({
          title: 'SortTestTable',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'Number', type: 'Number' },
          ],
        })
        .expect(200);
      tableId = tableResult.body.id;

      // Get default view ID from create response
      viewId = tableResult.body.views[0].id;

      // Get field ID for sort testing (use Title field)
      const titleField = tableResult.body.fields.find(
        (f: any) => f.title === 'Title',
      );
      fieldId = titleField.id;
    });

    async function _createSort(sort: {
      field_id: string;
      direction: 'asc' | 'desc';
    }) {
      const response = await request(context.app)
        .post(
          `${API_PREFIX}/tables/${tableId}/views/${viewId}/sorts`,
        )
        .set('xc-auth', context.token)
        .send(sort)
        .expect(200);

      return response.body;
    }

    it('List Sorts v3 - empty', async () => {
      const response = await request(context.app)
        .get(
          `${API_PREFIX}/tables/${tableId}/views/${viewId}/sorts`,
        )
        .set('xc-auth', context.token)
        .expect(200);

      expect(response.body).to.have.property('list');
      expect(response.body.list).to.be.an('array').that.is.empty;
    });

    it('Create Sort v3', async () => {
      const result = await _createSort({
        field_id: fieldId,
        direction: 'asc',
      });

      expect(result).to.have.property('id');
      expect(result).to.have.property('field_id', fieldId);
      expect(result).to.have.property('direction', 'asc');
    });

    it('Update Sort v3', async () => {
      // Create a sort first
      const createResult = await _createSort({
        field_id: fieldId,
        direction: 'asc',
      });

      const sortId = createResult.id;

      // Update the sort direction
      const updateResponse = await request(context.app)
        .patch(
          `${API_PREFIX}/tables/${tableId}/views/${viewId}/sorts`,
        )
        .set('xc-auth', context.token)
        .send({
          id: sortId,
          direction: 'desc',
        })
        .expect(200);

      const result = updateResponse.body;
      expect(result).to.have.property('id', sortId);
      expect(result).to.have.property('direction', 'desc');
    });

    it('Delete Sort v3', async () => {
      // Create a sort first
      const createResult = await _createSort({
        field_id: fieldId,
        direction: 'asc',
      });

      const sortId = createResult.id;

      // Delete the sort
      const deleteResponse = await request(context.app)
        .delete(
          `${API_PREFIX}/tables/${tableId}/views/${viewId}/sorts`,
        )
        .set('xc-auth', context.token)
        .send({ id: sortId })
        .expect(200);

      expect(deleteResponse.body).to.deep.equal({});

      // Verify sort is gone
      const listResponse = await request(context.app)
        .get(
          `${API_PREFIX}/tables/${tableId}/views/${viewId}/sorts`,
        )
        .set('xc-auth', context.token)
        .expect(200);

      expect(listResponse.body.list).to.be.an('array').that.is.empty;
    });
  });
}
