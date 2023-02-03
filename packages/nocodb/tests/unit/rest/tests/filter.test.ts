import 'mocha';
import init from '../../init';
import { createProject } from '../../factory/project';
import Project from '../../../../src/lib/models/Project';
import { createTable } from '../../factory/table';
import { isSqlite } from '../../init/db';
import { UITypes } from 'nocodb-sdk';
import {
  createBulkRows,
  generateDefaultRowAttributes,
  generateMixedRowAttributes,
  rowMixedValue,
  listRow,
} from '../../factory/row';
import Model from '../../../../src/lib/models/Model';
import { expect } from 'chai';
import request from 'supertest';

// Test case list

function filterTests() {
  let context;
  let project: Project;
  let table: Model;
  let columns: any[];
  let unfilteredRecords: any[] = [];

  // prepare data for test cases
  beforeEach(async function () {
    context = await init();
    project = await createProject(context);
    table = await createTable(context, project, {
      table_name: 'textBased',
      title: 'TextBased',
      columns: [
        {
          column_name: 'Id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'SingleLineText',
          title: 'SingleLineText',
          uidt: UITypes.SingleLineText,
        },
        {
          column_name: 'MultiLineText',
          title: 'MultiLineText',
          uidt: UITypes.LongText,
        },
        {
          column_name: 'Email',
          title: 'Email',
          uidt: UITypes.Email,
        },
        {
          column_name: 'Phone',
          title: 'Phone',
          uidt: UITypes.PhoneNumber,
        },
        {
          column_name: 'Url',
          title: 'Url',
          uidt: UITypes.URL,
        },
      ],
    });

    columns = await table.getColumns();

    let rowAttributes = [];
    for (let i = 0; i < 400; i++) {
      let row = {
        SingleLineText: rowMixedValue(columns[1], i),
        MultiLineText: rowMixedValue(columns[2], i),
        Email: rowMixedValue(columns[3], i),
        Phone: rowMixedValue(columns[4], i),
        Url: rowMixedValue(columns[5], i),
      };
      rowAttributes.push(row);
    }

    await createBulkRows(context, {
      project,
      table,
      values: rowAttributes,
    });
    unfilteredRecords = await listRow({ project, table });

    // verify length of unfiltered records to be 400
    expect(unfilteredRecords.length).to.equal(400);
  });

  async function retrieveRecordsAndValidate(
    filter: {
      comparison_op: string;
      value: string;
      fk_column_id: any;
      status: string;
      logical_op: string;
    },
    expectedRecords: any[]
  ) {
    // retrieve filtered records
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${project.id}/${table.id}`)
      .set('xc-auth', context.token)
      .query({
        filterArrJson: JSON.stringify([filter]),
      })
      .expect(200);

    // validate
    expect(response.body.pageInfo.totalRows).to.equal(expectedRecords.length);
    response.body.list.forEach((row, index) => {
      expect(row[columns[1].title] !== expectedRecords[index].SingleLineText);
    });
  }

  it('Type: Single Line Text', async () => {
    // filter types to be verified
    // eq, neq, null, notnull, empty, notempty, like, nlike

    const filter = {
      fk_column_id: columns[1].id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: 'Afghanistan',
    };

    let expectedRecords = unfilteredRecords.filter(
      (record) => record.SingleLineText === 'Afghanistan'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords);

    // filter: neq
    filter.comparison_op = 'neq';
    expectedRecords = unfilteredRecords.filter(
      (record) => record.SingleLineText !== 'Afghanistan'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords);

    // filter: null
    filter.comparison_op = 'null';
    expectedRecords = unfilteredRecords.filter(
      (record) => record.SingleLineText === null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords);

    // filter: notnull
    filter.comparison_op = 'notnull';
    expectedRecords = unfilteredRecords.filter(
      (record) => record.SingleLineText !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords);

    // filter: empty
    filter.comparison_op = 'empty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record.SingleLineText === ''
    );
    await retrieveRecordsAndValidate(filter, expectedRecords);

    // filter: notempty
    filter.comparison_op = 'notempty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record.SingleLineText !== ''
    );
    //TBD await retrieveRecordsAndValidate(filter, expectedRecords);

    // filter: like
    filter.comparison_op = 'like';
    filter.value = 'Au';
    expectedRecords = unfilteredRecords.filter((record) =>
      record.SingleLineText?.includes('Au')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords);

    // filter: nlike
    filter.comparison_op = 'nlike';
    filter.value = 'Au';
    expectedRecords = unfilteredRecords.filter(
      (record) => !record.SingleLineText?.includes('Au')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords);
  });
}

export default function () {
  describe('Filters', filterTests);
}
