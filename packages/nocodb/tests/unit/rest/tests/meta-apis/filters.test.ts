import 'mocha';

import { expect } from 'chai';
import request from 'supertest';

import { Base, Column, Model } from '../../../../../src/models';
import { createProject } from '../../../factory/base';
import { createTable, getTableMeta } from '../../../factory/table';
import init from '../../../init';

export default async function (API_VERSION: 'v1' | 'v2' | 'v3') {
  const isV1 = API_VERSION === 'v1';
  const isV2 = API_VERSION === 'v2';
  const isV3 = API_VERSION === 'v3';

  const isEE = !!process.env.EE;

  const META_API_VIEW_ROUTE = `/api/${API_VERSION}${
    isV1 ? '/db' : ''
  }/meta/views`;

  const META_API_FILTER_ROUTE = `/api/${API_VERSION}${
    isV1 ? '/db' : ''
  }/meta/filters`;

  function filterTests() {
    let context: Awaited<ReturnType<typeof init>>;
    let base: Base;
    let table: Model;
    let defaultViewId: string;
    let columns: Column[];

    before(async function () {
      context = await init();

      base = await createProject(context);
      table = await createTable(context, base);

      const meta = await getTableMeta(context, table);
      defaultViewId = meta.views[0].id;
      columns = meta.columns;
    });

    (isV1 || isV2) &&
      it(`Filter Meta CRUD ${API_VERSION}`, async () => {
        let response = await request(context.app)
          .get(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
          .set('xc-auth', context.token)
          .expect(200);
        let filtersResponse = response.body.list;
        expect(filtersResponse).to.not.be.undefined;
        expect(filtersResponse.length).to.eq(0);

        const filterRequestBody = {
          comparison_op: 'eq',
          comparison_sub_op: null,
          fk_column_id: columns[1].id,
          is_group: false,
          logical_op: 'and',
          value: 'foo',
        } as const;

        await request(context.app)
          .post(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
          .set('xc-auth', context.token)
          .send(filterRequestBody)
          .expect(isV3 ? 201 : 200);

        response = await request(context.app)
          .get(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
          .set('xc-auth', context.token)
          .expect(200);

        filtersResponse = response.body.list;
        expect(filtersResponse).to.not.be.undefined;
        expect(filtersResponse.length).to.eq(1);

        const addedFilter = filtersResponse[0];

        expect(addedFilter).to.haveOwnProperty('id');

        expect(addedFilter).to.haveOwnProperty('base_id');
        expect(addedFilter.base_id).to.eq(base.id);

        expect(addedFilter).to.haveOwnProperty('source_id');
        expect(addedFilter.source_id).to.eq(table.source_id);

        expect(addedFilter).to.haveOwnProperty('comparison_op');
        expect(addedFilter.comparison_op).to.eq(
          filterRequestBody.comparison_op,
        );

        expect(addedFilter).to.haveOwnProperty('comparison_sub_op');
        expect(addedFilter.comparison_sub_op).to.eq(
          filterRequestBody.comparison_sub_op,
        );

        expect(addedFilter).to.haveOwnProperty('value');
        expect(addedFilter.value).to.eq(filterRequestBody.value);

        expect(addedFilter).to.haveOwnProperty('is_group');
        expect(addedFilter.is_group).to.eq(filterRequestBody.is_group);

        expect(addedFilter).to.haveOwnProperty('logical_op');
        expect(addedFilter.logical_op).to.eq(filterRequestBody.logical_op);

        expect(addedFilter).to.haveOwnProperty('order');
        expect(addedFilter.order).to.eq(1);

        expect(addedFilter).to.haveOwnProperty('fk_column_id');
        expect(addedFilter.fk_column_id).to.eq(filterRequestBody.fk_column_id);

        expect(addedFilter).to.haveOwnProperty('fk_hook_id');
        expect(addedFilter.fk_hook_id).to.be.null;

        expect(addedFilter).to.haveOwnProperty('fk_link_col_id');
        expect(addedFilter.fk_link_col_id).to.be.null;

        expect(addedFilter).to.haveOwnProperty('fk_parent_column_id');
        expect(addedFilter.fk_parent_column_id).to.be.null;

        expect(addedFilter).to.haveOwnProperty('fk_parent_id');
        expect(addedFilter.fk_parent_id).to.be.null;

        expect(addedFilter).to.haveOwnProperty('fk_value_col_id');
        expect(addedFilter.fk_value_col_id).to.be.null;

        expect(addedFilter).to.haveOwnProperty('fk_view_id');
        expect(addedFilter.fk_view_id).to.eq(defaultViewId);

        expect(addedFilter).to.haveOwnProperty('fk_widget_id');
        expect(addedFilter.fk_widget_id).to.be.null;

        if (isEE) {
          expect(addedFilter).to.haveOwnProperty('fk_workspace_id');
          expect(addedFilter.fk_workspace_id).to.eq(context.fk_workspace_id);
        }

        expect(addedFilter).to.haveOwnProperty('updated_at');
        expect(addedFilter).to.haveOwnProperty('created_at');

        const filterUpdateRequestBody = {
          ...filterRequestBody,
          comparison_op: 'neq',
          logical_op: 'or',
          value: 'bar',
        } as const;

        await request(context.app)
          .patch(`${META_API_FILTER_ROUTE}/${addedFilter.id}`)
          .set('xc-auth', context.token)
          .send(filterUpdateRequestBody)
          .expect(200);

        response = await request(context.app)
          .get(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
          .set('xc-auth', context.token)
          .expect(200);

        filtersResponse = response.body.list;
        expect(filtersResponse).to.not.be.undefined;
        expect(filtersResponse.length).to.eq(1);

        const updatedFilter = filtersResponse[0];

        expect(updatedFilter).to.haveOwnProperty('id');
        expect(updatedFilter.id).to.eq(addedFilter.id);

        expect(updatedFilter).to.haveOwnProperty('comparison_op');
        expect(updatedFilter.comparison_op).to.eq(
          filterUpdateRequestBody.comparison_op,
        );

        expect(updatedFilter).to.haveOwnProperty('comparison_sub_op');
        expect(updatedFilter.comparison_sub_op).to.eq(
          filterUpdateRequestBody.comparison_sub_op,
        );

        expect(updatedFilter).to.haveOwnProperty('value');
        expect(updatedFilter.value).to.eq(filterUpdateRequestBody.value);

        expect(updatedFilter).to.haveOwnProperty('logical_op');
        expect(updatedFilter.logical_op).to.eq(
          filterUpdateRequestBody.logical_op,
        );

        await request(context.app)
          .delete(`${META_API_FILTER_ROUTE}/${addedFilter.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        response = await request(context.app)
          .get(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
          .set('xc-auth', context.token)
          .expect(200);

        filtersResponse = response.body.list;
        expect(filtersResponse).to.not.be.undefined;
        expect(filtersResponse.length).to.eq(0);
      });

    isV3 &&
      it(`Filter Meta CRUD v3`, async () => {
        let response = await request(context.app)
          .get(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
          .set('xc-auth', context.token)
          .expect(200);
        let filtersResponse = response.body.list;
        expect(filtersResponse).to.not.be.undefined;
        expect(filtersResponse.length).to.eq(0);

        const filterRequestBody = {
          operator: 'eq',
          field_id: columns[1].id,
          value: 'foo',
        } as const;

        await request(context.app)
          .post(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
          .set('xc-auth', context.token)
          .send(filterRequestBody)
          .expect(200);

        response = await request(context.app)
          .get(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
          .set('xc-auth', context.token)
          .expect(200);

        filtersResponse = response.body.list;
        expect(filtersResponse).to.not.be.undefined;
        expect(filtersResponse.length).to.eq(1);

        const addedFilter = filtersResponse[0];

        expect(addedFilter).to.haveOwnProperty('id');
        expect(addedFilter.id).to.eq('root');

        expect(addedFilter.is_group).to.be.true;

        expect(addedFilter.group_operator).to.eq('AND');
        expect(addedFilter.filters).to.not.be.undefined;
        expect(addedFilter.filters.length).to.eq(1);

        expect(addedFilter.filters[0]).to.haveOwnProperty('id');

        expect(addedFilter.filters[0]).to.haveOwnProperty('field_id');
        expect(addedFilter.filters[0].field_id).to.eq(
          filterRequestBody.field_id,
        );

        expect(addedFilter.filters[0]).to.haveOwnProperty('operator');
        expect(addedFilter.filters[0].operator).to.eq(
          filterRequestBody.operator,
        );

        expect(addedFilter.filters[0]).to.haveOwnProperty('value');
        expect(addedFilter.filters[0].value).to.eq(filterRequestBody.value);

        const filterUpdateRequestBody = {
          ...filterRequestBody,
          id: addedFilter.filters[0].id,
          operator: 'eq',
          value: 'bar',
        } as const;

        await request(context.app)
          .post(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
          .set('xc-auth', context.token)
          .send(filterUpdateRequestBody)
          .expect(200);

        const updatedFilter = filtersResponse[0];

        expect(updatedFilter).to.haveOwnProperty('id');
        expect(updatedFilter.id).to.eq('root');

        expect(updatedFilter.is_group).to.be.true;

        expect(updatedFilter.group_operator).to.eq('AND');
        expect(updatedFilter.filters).to.not.be.undefined;
        expect(updatedFilter.filters.length).to.eq(1);

        expect(updatedFilter.filters[0]).to.haveOwnProperty('id');
        expect(updatedFilter.filters[0].id).to.eq(filterUpdateRequestBody.id);

        expect(updatedFilter.filters[0]).to.haveOwnProperty('field_id');
        expect(updatedFilter.filters[0].field_id).to.eq(
          filterUpdateRequestBody.field_id,
        );

        expect(updatedFilter.filters[0]).to.haveOwnProperty('operator');
        expect(updatedFilter.filters[0].operator).to.eq(
          filterUpdateRequestBody.operator,
        );

        expect(updatedFilter.filters[0]).to.haveOwnProperty('value');
        expect(updatedFilter.filters[0].value).to.eq(
          filterUpdateRequestBody.value,
        );

        await request(context.app)
          .delete(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
          .set('xc-auth', context.token)
          .send({ id: filterUpdateRequestBody.id })
          .expect(200);

        response = await request(context.app)
          .get(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
          .set('xc-auth', context.token)
          .expect(200);

        filtersResponse = response.body.list;
        expect(filtersResponse).to.not.be.undefined;
        expect(filtersResponse.length).to.eq(0);
      });
  }

  describe(`Filter Meta Tests ${API_VERSION}`, filterTests);
}
