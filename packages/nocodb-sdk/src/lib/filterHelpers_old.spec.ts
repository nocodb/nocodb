import { ColumnType, FilterType } from './Api';
import { extractFilterFromXwhere } from './filterHelpers_old';
import UITypes from './UITypes';

export const testExtractFilterFromXwhere = (
  title: string,
  extractFilterFromXwhere: (
    str: string | string[],
    aliasColObjMap: { [columnAlias: string]: ColumnType },
    throwErrorIfInvalid?: boolean
  ) => { filters?: FilterType[]; errors?: any }
) => {
  describe(title, () => {
    describe('extractFilterFromXwhere', () => {
      it('will parse simple query', async () => {
        const query = '(Title,eq,Hello)';
        const columnAlias: Record<string, ColumnType> = {
          Title: {
            id: 'field1',
            column_name: 'col1',
            title: 'Title',
            uidt: UITypes.SingleLineText,
          },
        };
        const result = extractFilterFromXwhere(query, columnAlias);
        expect(result.filters).toBeDefined();
        expect(result.filters.length).toBe(1);
        expect(result.filters[0].comparison_op).toBe('eq');
        expect(result.filters[0].value).toBe('Hello');
      });
      it('will parse null query', async () => {
        const query = '(Title,eq,)';
        const columnAlias: Record<string, ColumnType> = {
          Title: {
            id: 'field1',
            column_name: 'col1',
            title: 'Title',
            uidt: UITypes.SingleLineText,
          },
        };

        const result = extractFilterFromXwhere(query, columnAlias);
        expect(result.filters).toBeDefined();
        expect(result.filters.length).toBe(1);
        expect(result.filters[0].comparison_op).toBe('eq');
        expect(result.filters[0].value).toBe('');
      });
      it('will parse "in" operator', async () => {
        const query = '(Title,in,1,2,3,4,5)';
        const columnAlias: Record<string, ColumnType> = {
          Title: {
            id: 'field1',
            column_name: 'col1',
            title: 'Title',
            uidt: UITypes.SingleLineText,
          },
        };

        const result = extractFilterFromXwhere(query, columnAlias);
        expect(result.filters).toBeDefined();
        expect(result.filters.length).toBe(1);
        expect(result.filters[0].comparison_op).toBe('in');
        expect(result.filters[0].value).toEqual(['1', '2', '3', '4', '5']);
      });
      it('will map "blank" operator', async () => {
        const queryBlanks = [
          '(Title,is,blank)',
          '(Title,isblank)',
          '(Title,blank)',
        ];
        const columnAlias: Record<string, ColumnType> = {
          Title: {
            id: 'field1',
            column_name: 'col1',
            title: 'Title',
            uidt: UITypes.SingleLineText,
          },
        };

        for (const blankQuery of queryBlanks) {
          const result = extractFilterFromXwhere(blankQuery, columnAlias);
          expect(result.filters).toBeDefined();
          expect(result.filters.length).toBe(1);
          expect(result.filters[0].comparison_op).toBe('blank');
          expect(result.filters[0].value).toBeUndefined();
        }
      });
      it('will map "notblank" operator', async () => {
        const queryBlanks = [
          '(Title,is,notblank)',
          '(Title,isnotblank)',
          '(Title,notblank)',
        ];
        const columnAlias: Record<string, ColumnType> = {
          Title: {
            id: 'field1',
            column_name: 'col1',
            title: 'Title',
            uidt: UITypes.SingleLineText,
          },
        };

        for (const blankQuery of queryBlanks) {
          const result = extractFilterFromXwhere(blankQuery, columnAlias);
          expect(result.filters).toBeDefined();
          expect(result.filters.length).toBe(1);
          expect(result.filters[0].comparison_op).toBe('notblank');
          expect(result.filters[0].value).toBeUndefined();
        }
      });
      it('will parse value with sub operator', async () => {
        const query = '(Title,eq,oneWeekAgo India)';
        const columnAlias: Record<string, ColumnType> = {
          Title: {
            id: 'field1',
            column_name: 'col1',
            title: 'Title',
            uidt: UITypes.SingleLineText,
          },
        };

        const result = extractFilterFromXwhere(query, columnAlias);
        expect(result.filters).toBeDefined();
        expect(result.filters.length).toBe(1);
        expect(result.filters[0].comparison_op).toBe('eq');
        expect(result.filters[0].value).toBe('oneWeekAgo India');
      });

      describe('datetime', () => {
        it('will parse datetime exactDate', async () => {
          // most datetime filter need to have suboperator
          const query = '(Date,lt,exactDate,2025-01-01)';
          const columnAlias: Record<string, ColumnType> = {
            Date: {
              id: 'field1',
              column_name: 'col1',
              title: 'Date',
              uidt: UITypes.DateTime,
            },
          };

          const result = extractFilterFromXwhere(query, columnAlias);
          expect(result.filters).toBeDefined();
          expect(result.filters.length).toBe(1);
          expect(result.filters[0].comparison_op).toBe('lt');
          expect(result.filters[0].comparison_sub_op).toBe('exactDate');
          expect(result.filters[0].value).toBe('2025-01-01');
        });
        it('will parse datetime oneMonthAgo', async () => {
          // most datetime filter need to have suboperator
          const query = '(Date,lt,oneMonthAgo)';
          const columnAlias: Record<string, ColumnType> = {
            Date: {
              id: 'field1',
              column_name: 'col1',
              title: 'Date',
              uidt: UITypes.DateTime,
            },
          };
          const result = extractFilterFromXwhere(query, columnAlias);
          expect(result.filters).toBeDefined();
          expect(result.filters.length).toBe(1);
          expect(result.filters[0].comparison_op).toBe('lt');
          expect(result.filters[0].comparison_sub_op).toBe('oneMonthAgo');
          expect(result.filters[0].value).toBeUndefined();
        });
        it('will parse datetime isWithin', async () => {
          // isWithin need to have specific suboperator
          const query = '(Date,isWithin,pastMonth)';
          const columnAlias: Record<string, ColumnType> = {
            Date: {
              id: 'field1',
              column_name: 'col1',
              title: 'Date',
              uidt: UITypes.DateTime,
            },
          };

          const result = extractFilterFromXwhere(query, columnAlias);
          expect(result.filters).toBeDefined();
          expect(result.filters.length).toBe(1);
          expect(result.filters[0].comparison_op).toBe('isWithin');
          expect(result.filters[0].comparison_sub_op).toBe('pastMonth');
          expect(result.filters[0].value).toBeUndefined();
        });
        it('will throw error isWithin', async () => {
          // isWithin need to have specific suboperator
          const query = '(Date,isWithin,oneMonthAgo)';
          const columnAlias: Record<string, ColumnType> = {
            Date: {
              id: 'field1',
              column_name: 'col1',
              title: 'Date',
              uidt: UITypes.DateTime,
            },
          };

          expect(() =>
            extractFilterFromXwhere(query, columnAlias, true)
          ).toThrow();
        });
        it('will parse datetime is null', async () => {
          const query = '(Date,is,null)';
          const columnAlias: Record<string, ColumnType> = {
            Date: {
              id: 'field1',
              column_name: 'col1',
              title: 'Date',
              uidt: UITypes.DateTime,
            },
          };

          const result = extractFilterFromXwhere(query, columnAlias);
          expect(result.filters).toBeDefined();
          expect(result.filters.length).toBe(1);
          expect(result.filters[0].comparison_op).toBe('is');
          expect(result.filters[0].value).toBe(null);
        });
        it('will parse datetime blank', async () => {
          // datetime need to have suboperator :|
          const query = '(Date,blank)';
          const columnAlias: Record<string, ColumnType> = {
            Date: {
              id: 'field1',
              column_name: 'col1',
              title: 'Date',
              uidt: UITypes.DateTime,
            },
          };

          const result = extractFilterFromXwhere(query, columnAlias);
          expect(result.filters).toBeDefined();
          expect(result.filters.length).toBe(1);
          expect(result.filters[0].comparison_op).toBe('blank');
          expect(result.filters[0].value).toBeUndefined();
        });
      });

      describe('json', () => {
        // JSON cannot have filter atm
      });
    });
  });
};
testExtractFilterFromXwhere('filterHelpers_old', extractFilterFromXwhere);

describe('filterHelpers_old_specific', () => {
  describe('extractFilterFromXwhere', () => {
    it('will parse comma value', async () => {
      const query = '(Title,eq,Istanbul, India)';
      const columnAlias: Record<string, ColumnType> = {
        Title: {
          id: 'field1',
          column_name: 'col1',
          title: 'Title',
          uidt: UITypes.SingleLineText,
        },
      };

      const result = extractFilterFromXwhere(query, columnAlias);
      expect(result.filters).toBeDefined();
      expect(result.filters.length).toBe(1);
      expect(result.filters[0].comparison_op).toBe('eq');
      expect(result.filters[0].value).toBe('Istanbul, India');
    });
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
        expect(result.filters.length).toBe(2);
        expect(result.filters[1].logical_op).toBe('and');
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
        expect(result.filters.length).toBe(2);
        expect(result.filters[1].logical_op).toBe('or');
      });
    });
  });
});
