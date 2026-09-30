import { ColumnType } from './Api';
import { testExtractFilterFromXwhere } from './filterHelpers_old.spec';
import { extractFilterFromXwhere } from './filterHelpers_withparser';
import UITypes from './UITypes';

const context = { timezone: 'Asia/Calcutta' };

testExtractFilterFromXwhere(
  'filterHelpers_withparser',
  (str, aliasColObjMap, throwErrorIfInvalid) => {
    return extractFilterFromXwhere(context, {
      str,
      aliasColObjMap,
      throwErrorIfInvalid,
    });
  }
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

        const result = extractFilterFromXwhere(context, {
          str: query,
          aliasColObjMap: columnAlias,
        });
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

        const result = extractFilterFromXwhere(context, {
          str: query,
          aliasColObjMap: columnAlias,
        });
        expect(result).toBeDefined();
        expect(result.filters).toBeDefined();
        expect(result.filters.length).toBe(1);
        expect(result.filters[0].children?.[1].logical_op).toBe('or');
      });

      it('will keep multiple dates comma-separated after the sub-operator', () => {
        const columnAlias: Record<string, ColumnType> = {
          Date: {
            id: 'field1',
            column_name: 'col1',
            title: 'Date',
            uidt: UITypes.Date,
          },
        };

        // The date handlers split an `in` value back on ',', so the parser must
        // not fuse the dates when it drops the sub-operator token.
        const multi = extractFilterFromXwhere(context, {
          str: '(Date,in,exactDate,2024-06-15,2024-07-01)',
          aliasColObjMap: columnAlias,
        });
        expect(multi.filters[0].comparison_op).toBe('in');
        expect(multi.filters[0].comparison_sub_op).toBe('exactDate');
        expect(multi.filters[0].value).toBe('2024-06-15,2024-07-01');

        const single = extractFilterFromXwhere(context, {
          str: '(Date,eq,exactDate,2024-06-15)',
          aliasColObjMap: columnAlias,
        });
        expect(single.filters[0].value).toBe('2024-06-15');

        const noValue = extractFilterFromXwhere(context, {
          str: '(Date,isWithin,pastMonth)',
          aliasColObjMap: columnAlias,
        });
        expect(noValue.filters[0].comparison_sub_op).toBe('pastMonth');
        expect(noValue.filters[0].value).toBeUndefined();
      });

      it('will parse multiselect with ~or connection', () => {
        const query = '(fMultiSelect,allof,jun)~or(fMultiSelect,allof,may)';

        const columnAlias: Record<string, ColumnType> = {
          fMultiSelect: {
            id: 'field1',
            column_name: 'fMultiSelect',
            title: 'fMultiSelect',
            uidt: UITypes.MultiSelect,
          },
        };

        const result = extractFilterFromXwhere(context, {
          str: query,
          aliasColObjMap: columnAlias,
        });
        expect(result).toBeDefined();
        expect(result.filters).toBeDefined();
        expect(result.filters.length).toBe(1);
        expect(result.filters[0].children?.[1].logical_op).toBe('or');
      });
    });
  });
});
