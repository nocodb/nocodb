import { ColumnType } from './Api';
import { testExtractFilterFromXwhere } from './filterHelpers_old.spec';
import { extractFilterFromXwhere } from './filterHelpers_withparser';
import UITypes from './UITypes';

testExtractFilterFromXwhere(
  'filterHelpers_withparser',
  extractFilterFromXwhere
);

describe('filterHelpers_withparser_specific', () => {
  describe('extractFilterFromXwhere', () => {
    describe('logical', () => {
      it('will parse basic logical query', () => {
        // isWithin need to have specific suboperator :|
        const query = '(Date,isWithin,pastMonth)~and(Name,like,Hello)';
        const columnAlias: Record<string, ColumnType> = {
          Date: {
            id: 'field1',
            column_name: 'col1',
            title: 'Date',
            uidt: UITypes.DateTime,
          },
          Name: {
            id: 'field2',
            column_name: 'col2',
            title: 'Name',
            uidt: UITypes.SingleLineText,
          },
        };

        const result = extractFilterFromXwhere(query, columnAlias);
        expect(result).toBeDefined();
        expect(result.filters).toBeDefined();
        expect(result.filters.length).toBe(1);
        expect(result.filters[0].children?.[1].logical_op).toBe('and');
      });
      it('will parse nested logical query', () => {
        // isWithin need to have specific suboperator :|
        const query =
          '(Date,isWithin,pastMonth)~or((Name,like,Hello)~and(Name,like,World))';
        const columnAlias: Record<string, ColumnType> = {
          Date: {
            id: 'field1',
            column_name: 'col1',
            title: 'Date',
            uidt: UITypes.DateTime,
          },
          Name: {
            id: 'field2',
            column_name: 'col2',
            title: 'Name',
            uidt: UITypes.SingleLineText,
          },
        };

        const result = extractFilterFromXwhere(query, columnAlias);
        expect(result).toBeDefined();
        expect(result.filters).toBeDefined();
        expect(result.filters.length).toBe(1);
        expect(result.filters[0].children?.[1].logical_op).toBe('or');
      });
    });
  });
});
