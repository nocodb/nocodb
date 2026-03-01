import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../init';

export default function () {
  describe(`Filters v3`, () => {
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
        .send({ title: 'FilterTestBase' })
        .expect(200);
      initBase = baseResult.body;
      API_PREFIX = `/api/v3/meta/bases/${initBase.id}`;

      // Create table with fields for filtering
      const tableResult = await request(context.app)
        .post(`${API_PREFIX}/tables`)
        .set('xc-auth', context.token)
        .send({
          title: 'FilterTestTable',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'Number', type: 'Number' },
          ],
        })
        .expect(200);
      tableId = tableResult.body.id;

      // Get default view ID from create response
      viewId = tableResult.body.views[0].id;

      // Get field ID for filter testing (use Title field)
      const titleField = tableResult.body.fields.find(
        (f: any) => f.title === 'Title',
      );
      fieldId = titleField.id;
    });

    async function _createFilter(filter: {
      field_id: string;
      operator: string;
      value?: string | number | boolean | null;
    }) {
      const response = await request(context.app)
        .post(
          `${API_PREFIX}/tables/${tableId}/views/${viewId}/filters`,
        )
        .set('xc-auth', context.token)
        .send({
          group_operator: 'AND',
          filters: [filter],
        })
        .expect(200);

      return response.body;
    }

    it('List Filters v3 - empty', async () => {
      const response = await request(context.app)
        .get(
          `${API_PREFIX}/tables/${tableId}/views/${viewId}/filters`,
        )
        .set('xc-auth', context.token)
        .expect(200);

      // When no filters exist, service returns undefined → list omitted from JSON
      expect(response.body).to.not.have.property('list');
    });

    it('Create Filter v3', async () => {
      const result = await _createFilter({
        field_id: fieldId,
        operator: 'eq',
        value: 'test',
      });

      // filterCreate returns the filter tree directly (root group)
      expect(result).to.have.property('id', 'root');
      expect(result).to.have.property('group_operator');
      expect(result).to.have.property('filters');
      expect(result.filters).to.be.an('array').that.is.not.empty;

      // Verify the created filter
      const createdFilter = result.filters[0];
      expect(createdFilter).to.have.property('field_id', fieldId);
      expect(createdFilter).to.have.property('operator', 'eq');
      expect(createdFilter).to.have.property('value', 'test');
    });

    it('Update Filter v3', async () => {
      // Create a filter first
      const createResult = await _createFilter({
        field_id: fieldId,
        operator: 'eq',
        value: 'original',
      });

      const filterId = createResult.filters[0].id;

      // Update the filter
      const updateResponse = await request(context.app)
        .patch(
          `${API_PREFIX}/tables/${tableId}/views/${viewId}/filters`,
        )
        .set('xc-auth', context.token)
        .send({
          id: filterId,
          field_id: fieldId,
          operator: 'eq',
          value: 'updated',
        })
        .expect(200);

      // filterUpdate returns the full filter tree
      const result = updateResponse.body;
      expect(result).to.have.property('id', 'root');
      expect(result).to.have.property('filters');

      const updatedFilter = result.filters[0];
      expect(updatedFilter).to.have.property('id', filterId);
      expect(updatedFilter).to.have.property('value', 'updated');
    });

    it('Replace Filter v3', async () => {
      // Create a filter first
      await _createFilter({
        field_id: fieldId,
        operator: 'eq',
        value: 'old',
      });

      // Replace all filters with a new set
      const replaceResponse = await request(context.app)
        .put(
          `${API_PREFIX}/tables/${tableId}/views/${viewId}/filters`,
        )
        .set('xc-auth', context.token)
        .send({
          group_operator: 'OR',
          filters: [
            {
              field_id: fieldId,
              operator: 'like',
              value: 'replaced',
            },
          ],
        })
        .expect(200);

      // filterReplace returns the filter tree
      const result = replaceResponse.body;
      expect(result).to.have.property('id', 'root');
      expect(result).to.have.property('filters');
      expect(result.filters).to.be.an('array').with.lengthOf(1);

      const replacedFilter = result.filters[0];
      expect(replacedFilter).to.have.property('field_id', fieldId);
      expect(replacedFilter).to.have.property('operator', 'like');
      expect(replacedFilter).to.have.property('value', 'replaced');
    });

    it('Delete Filter v3', async () => {
      // Create a filter first
      const createResult = await _createFilter({
        field_id: fieldId,
        operator: 'eq',
        value: 'to-delete',
      });

      const filterId = createResult.filters[0].id;

      // Delete the filter
      const deleteResponse = await request(context.app)
        .delete(
          `${API_PREFIX}/tables/${tableId}/views/${viewId}/filters`,
        )
        .set('xc-auth', context.token)
        .send({ id: filterId })
        .expect(200);

      // filterDelete returns empty object
      expect(deleteResponse.body).to.deep.equal({});

      // Verify filter is gone by listing
      const listResponse = await request(context.app)
        .get(
          `${API_PREFIX}/tables/${tableId}/views/${viewId}/filters`,
        )
        .set('xc-auth', context.token)
        .expect(200);

      expect(listResponse.body).to.not.have.property('list');
    });
  });
}
