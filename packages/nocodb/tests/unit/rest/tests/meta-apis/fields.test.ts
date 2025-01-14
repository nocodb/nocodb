import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import init from '../../../init';
import { createProject } from '../../../factory/base';
import { createTable, getAllTables } from '../../../factory/table';
import { customColumns, defaultColumns } from '../../../factory/column';
import type { Base, Model } from '../../../../../src/models';

export default function (API_VERSION: 'v1' | 'v2' | 'v3') {
  const isV1 = API_VERSION === 'v1';
  const isV2 = API_VERSION === 'v2';
  const isV3 = API_VERSION === 'v3';

  const columnsProp = isV3 ? 'fields' : 'columns';

  const isEE = !!process.env.EE;

  const META_API_BASE_ROUTE = `/api/${API_VERSION}${isV1 ? '/db' : ''}/meta/${
    isV1 ? 'projects' : 'bases'
  }`;

  function fieldTests() {
    let context: Awaited<ReturnType<typeof init>>;
    let base: Base;
    let table: Model;

    before(async function () {
      context = await init();

      base = await createProject(context);
      table = await createTable(context, base);
    });

    it(`Create default fields ${API_VERSION}`, async function () {
      const response = await request(context.app)
        .post(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({
          table_name: 'table2',
          title: 'new_title_2',
          [columnsProp]: defaultColumns(context, isV3),
        })
        .expect(200);

      const tables = await getAllTables({ base });
      expect(tables.length).to.eq(2);

      let columns: any[] = [];
      if (isV1 || isV2) {
        columns = response.body.columns.filter((c: any) => !c.system);
      } else if (isV3) {
        columns = response.body.fields;
      }

      expect(columns.length).to.eq(defaultColumns(context, isV3).length);

      if (isV3) {
        expect(response.body.title).to.be.eq('new_title_2');
      } else {
        expect(response.body.table_name.startsWith(base.prefix)).to.eq(true);
        expect(response.body.table_name.endsWith('table2')).to.eq(true);
      }

      columns.forEach((c) => validateColumn(c));
    });

    async function testFields(fieldClass: string) {
      const fields = customColumns(fieldClass, undefined, undefined, isV3)!;
      const response = await request(context.app)
        .post(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({
          table_name: `table2 ${fieldClass}`,
          title: `new_title_2 ${fieldClass}`,
          [columnsProp]: fields,
        })
        .expect(200);

      let columns: any[] = [];
      if (isV1 || isV2) {
        columns = response.body.columns.filter((c: any) => !c.system);
      } else if (isV3) {
        columns = response.body.fields;
      }

      expect(fields.length).to.be.greaterThan(0); // Added this so if spelling mistake in fieldClass, test fails.
      expect(columns.length).to.eq(fields.length);
      columns.forEach((c) => validateColumn(c));
    }

    it(`Create text based fields ${API_VERSION}`, () =>
      testFields('textBased'));
    it(`Create number based fields ${API_VERSION}`, () =>
      testFields('numberBased'));
    it(`Create date based fields ${API_VERSION}`, () =>
      testFields('dateBased'));
    it(`Create select based fields ${API_VERSION}`, () =>
      testFields('selectBased'));
    it(`Create user based fields ${API_VERSION}`, () =>
      testFields('userBased'));
  }

  function validateColumn(responseColumn: any) {
    expect(responseColumn).to.haveOwnProperty('id');
    if (isV1 || isV2) {
      expect(responseColumn).to.haveOwnProperty('description');
      expect(responseColumn).to.haveOwnProperty('source_id');
      expect(responseColumn).to.haveOwnProperty('base_id');
      expect(responseColumn).to.haveOwnProperty('fk_model_id');
      expect(responseColumn).to.haveOwnProperty('title');
      expect(responseColumn).to.haveOwnProperty('column_name');
      expect(responseColumn).to.haveOwnProperty('uidt');
      expect(responseColumn).to.haveOwnProperty('dt');
      expect(responseColumn).to.haveOwnProperty('order');
      expect(responseColumn).to.haveOwnProperty('created_at');
      expect(responseColumn).to.haveOwnProperty('updated_at');
      expect(responseColumn).to.haveOwnProperty('dt');
      expect(responseColumn.meta).to.haveOwnProperty('defaultViewColOrder');
      if (isEE) {
        expect(responseColumn).to.haveOwnProperty('fk_workspace_id');
      }
    } else if (isV3) {
      expect(responseColumn).to.haveOwnProperty('title');
      expect(responseColumn).to.haveOwnProperty('type');
    }
    const uidt = responseColumn.uidt;
    /**
     * Indivisual field level testing.
     */
    if (uidt) {
      if (isV3) {
        switch (uidt) {
          case UITypes.ID:
          case UITypes.SingleLineText:
          case UITypes.Geometry:
          case UITypes.JSON:
          case UITypes.CreatedBy:
          case UITypes.LastModifiedBy:
          case UITypes.CreatedTime:
          case UITypes.LastModifiedTime:
            expect(responseColumn.options).to.have.keys([]);
            break;
          case UITypes.LongText:
            expect(responseColumn.options).to.have.keys([
              'rich_text',
              'generate_text_using_ai',
            ]);
            break;
          case UITypes.PhoneNumber:
          case UITypes.Email:
          case UITypes.URL:
            expect(responseColumn.options).to.have.keys(['validation']);
            break;
          case UITypes.Number:
          case UITypes.Decimal:
            expect(responseColumn.options).to.have.keys([
              'precision',
              'allow_negative',
            ]);
            break;
          case UITypes.Currency:
            expect(responseColumn.options).to.have.keys(['locale', 'code']);
            break;
          case UITypes.Percent:
            expect(responseColumn.options).to.have.keys([
              'precision',
              'show_as_progress',
            ]);
            break;
          case UITypes.Duration:
            expect(responseColumn.options).to.have.keys(['duration_format']);
            break;
          case UITypes.Date:
          case UITypes.DateTime:
          case UITypes.Time:
            expect(responseColumn.options).to.have.keys([
              'date_format',
              'time_format',
              '12hr_format',
            ]);
            break;
          case UITypes.SingleSelect:
          case UITypes.MultiSelect:
            expect(responseColumn.options).to.have.keys(['choices']);
            expect(responseColumn.options.choices).to.be.instanceOf(Array);
            responseColumn.options.choices.forEach((c: any) => {
              expect(c).to.have.keys('id', 'title', 'color');
            });
            break;
          case UITypes.Rating:
          case UITypes.Checkbox:
            expect(responseColumn.options).to.have.keys([
              'icon',
              'max_value',
              'check',
            ]);
            break;
          case UITypes.Barcode:
            expect(responseColumn.options).to.have.keys([]);
            break;
          case UITypes.QrCode:
            expect(responseColumn.options).to.have.keys([]);
            break;
          case UITypes.Formula:
            expect(responseColumn.options).to.have.keys([
              'type',
              'formula',
              'result',
            ]);
            break;
          case UITypes.User:
            expect(responseColumn.options).to.have.keys([
              'allow_multiple_users',
              'notify_user_when_added',
            ]);
            break;
          case UITypes.LinkToAnotherRecord:
            expect(responseColumn.options).to.have.keys([
              'relation_type',
              'linked_table_id',
            ]);
            break;
          case UITypes.Lookup:
            expect(responseColumn.options).to.have.keys([
              'link_field_id',
              'linked_table_lookup_field_id',
            ]);
            break;
          case UITypes.Rollup:
            expect(responseColumn.options).to.have.keys([
              'link_field_id',
              'linked_table_lookup_field_id',
              'rollup_function',
            ]);
            break;
        }
      }
    }
  }

  describe(`Field ${API_VERSION}`, fieldTests);
}
