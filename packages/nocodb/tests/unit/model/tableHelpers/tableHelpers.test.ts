import 'mocha';
import { expect } from 'chai';

import { UITypes } from 'nocodb-sdk';
import { repopulateCreateTableSystemColumns } from '~/helpers/tableHelpers';
import { TableSystemColumns } from '~/helpers/columnHelpers';

function tableHelpersTests() {
  describe('repopulateCreateTableSystemColumns', () => {
    it('will repopulate columns with system columns for table create', async () => {
      const idColumn = {
        title: 'CustomID',
        uidt: UITypes.ID,
      };
      const orderColumn = {
        title: 'CustomOrder',
        uidt: UITypes.Order,
      };
      const createdByColumn = {
        title: 'nc_created_by',
        column_name: 'created_by',
        uidt: UITypes.CreatedBy,
      };
      const createdByColumn2 = {
        title: 'CustomCreatedBy',
        column_name: 'created_by',
        uidt: UITypes.CreatedBy,
      };
      const updatedByColumn3 = {
        title: 'nc_updated_by',
        column_name: 'updated_by1',
        uidt: UITypes.LastModifiedBy,
      };
      const sameNameColumn = {
        title: 'Id',
        column_name: 'id',
        uidt: UITypes.SingleLineText,
      };
      const normalColumn = {
        title: 'Title',
        column_name: 'title',
        uidt: UITypes.SingleLineText,
      };
      const columns = [
        { ...idColumn },
        { ...orderColumn },
        { ...createdByColumn },
        { ...createdByColumn2 },
        { ...updatedByColumn3 },
        { ...sameNameColumn },
        { ...normalColumn },
      ];
      const result = repopulateCreateTableSystemColumns({}, { columns });
      const nonSystemResult = result.slice(TableSystemColumns().length);

      expect(
        nonSystemResult.some((col: any) => col.uidt === idColumn.uidt),
      ).to.eq(false, 'uidt ' + idColumn.uidt + ' exists in non system columns');
      expect(
        nonSystemResult.some((col: any) => col.uidt === orderColumn.uidt),
      ).to.eq(
        false,
        'uidt ' + orderColumn.uidt + ' exists in non system columns',
      );

      // if column is same, remove
      expect(
        nonSystemResult.some(
          (col: any) => col.title === createdByColumn.title + '1',
        ),
      ).to.eq(false, createdByColumn.title + '1 exists');
      // if only column name is same, append
      expect(
        nonSystemResult.some(
          (col: any) => col.column_name === createdByColumn2.column_name + '1',
        ),
      ).to.eq(true, createdByColumn2.column_name + '1 not exists');
      // if only column title is same, append
      expect(
        nonSystemResult.some(
          (col: any) => col.title === updatedByColumn3.title + '1',
        ),
      ).to.eq(true, updatedByColumn3.title + '1 not exists');
      // rename for id field
      expect(
        nonSystemResult.some(
          (col: any) => col.title === sameNameColumn.title + '1',
        ),
      ).to.eq(true, sameNameColumn.title + '1 not exists');
    });
  });
}

export function tableHelpersTest() {
  describe('tableHelpers', tableHelpersTests);
}
