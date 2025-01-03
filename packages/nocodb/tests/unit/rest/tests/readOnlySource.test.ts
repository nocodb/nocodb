import 'mocha';
import request from 'supertest';
import { beforeEach } from 'mocha';
import { Exception } from 'handlebars';
import { expect } from 'chai';
import { Base } from '../../../../src/models';
import { createTable, getTable } from '../../factory/table';
import init from '../../init';
import {
  createProject,
  createSakilaProject,
  createSharedBase,
} from '../../factory/base';
import { RootScopes } from '../../../../src/utils/globals';
import { generateDefaultRowAttributes } from '../../factory/row';
import { defaultColumns } from '../../factory/column';

// Test case list
// 1. Create data readonly source
// 2. Create schema readonly source

function sourceTest() {
  let context;

  beforeEach(async function () {
    console.time('#### readonlySourceTest');
    context = await init();
    console.timeEnd('#### readonlySourceTest');
  });

  it('Readonly data', async () => {
    const base = await createSakilaProject(context, {
      is_schema_readonly: false,
      is_data_readonly: true,
    });

    const countryTable = await getTable({
      base,
      name: 'country',
    });

    const sakilaCtx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    const countryColumns = (await countryTable.getColumns(sakilaCtx)).filter(
      (c) => !c.pk,
    );
    const rowAttributes = Array(99)
      .fill(0)
      .map((index) =>
        generateDefaultRowAttributes({ columns: countryColumns, index }),
      );

    await request(context.app)
      .post(`/api/v1/db/data/bulk/noco/${base.id}/${countryTable.id}`)
      .set('xc-auth', context.token)
      .send(rowAttributes)
      .expect(403);

    await request(context.app)
      .post(`/api/v1/db/meta/projects/${base.id}/tables`)
      .set('xc-auth', context.token)
      .send({
        table_name: 'new_title',
        title: 'new_title',
        columns: defaultColumns(context),
      })
      .expect(200);
  });

  it('Readonly schema', async () => {
    const base = await createSakilaProject(context, {
      is_schema_readonly: true,
      is_data_readonly: false,
    });

    const countryTable = await getTable({
      base,
      name: 'country',
    });

    const sakilaCtx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    const countryColumns = (await countryTable.getColumns(sakilaCtx)).filter(
      (c) => !c.pk,
    );
    const rowAttributes = Array(99)
      .fill(0)
      .map((index) =>
        generateDefaultRowAttributes({ columns: countryColumns, index }),
      );

    await request(context.app)
      .post(`/api/v1/db/data/bulk/noco/${base.id}/${countryTable.id}`)
      .set('xc-auth', context.token)
      .send(rowAttributes)
      .expect(200);
    await request(context.app)
      .post(`/api/v1/db/meta/projects/${base.id}/tables`)
      .set('xc-auth', context.token)
      .send({
        table_name: 'new_title',
        title: 'new_title',
        columns: defaultColumns(context),
      })
      .expect(403);
  });
  it('Readonly schema & data', async () => {
    const base = await createSakilaProject(context, {
      is_schema_readonly: true,
      is_data_readonly: true,
    });

    const countryTable = await getTable({
      base,
      name: 'country',
    });

    const sakilaCtx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    const countryColumns = (await countryTable.getColumns(sakilaCtx)).filter(
      (c) => !c.pk,
    );
    const rowAttributes = Array(99)
      .fill(0)
      .map((index) =>
        generateDefaultRowAttributes({ columns: countryColumns, index }),
      );

    await request(context.app)
      .post(`/api/v1/db/data/bulk/noco/${base.id}/${countryTable.id}`)
      .set('xc-auth', context.token)
      .send(rowAttributes)
      .expect(403);

    await request(context.app)
      .post(`/api/v1/db/meta/projects/${base.id}/tables`)
      .set('xc-auth', context.token)
      .send({
        table_name: 'new_title',
        title: 'new_title',
        columns: defaultColumns(context),
      })
      .expect(403);
  });
}

export default function () {
  describe('SourceRestriction', sourceTest);
}
