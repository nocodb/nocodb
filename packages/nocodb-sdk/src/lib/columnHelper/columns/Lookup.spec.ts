import { LookupHelper } from './Lookup';
import { ComputedTypePasteError } from '~/lib/error';
import UITypes from '~/lib/UITypes';
import {
  ColumnType,
  LinkToAnotherRecordType,
  LookupType,
  TableType,
} from '~/lib/Api';

describe('LookupHelper', () => {
  const helper = new LookupHelper();

  describe('serializeValue', () => {
    describe('when serializeSearchQuery is false', () => {
      it('throws ComputedTypePasteError for normal paste', () => {
        const params = {
          isMultipleCellPaste: false,
          serializeSearchQuery: false,
          col: {} as ColumnType,
        } as any;

        expect(() => helper.serializeValue('some value', params)).toThrow(
          ComputedTypePasteError
        );
      });

      it('returns undefined for multiple cell paste', () => {
        const params = {
          isMultipleCellPaste: true,
          serializeSearchQuery: false,
          col: {} as ColumnType,
        } as any;

        expect(helper.serializeValue('some value', params)).toBeUndefined();
      });
    });

    describe('when serializeSearchQuery is true', () => {
      it('returns null for null value', () => {
        const params = {
          serializeSearchQuery: true,
          col: {} as ColumnType,
        } as any;

        expect(helper.serializeValue(null, params)).toBeNull();
      });

      it('returns null for undefined value', () => {
        const params = {
          serializeSearchQuery: true,
          col: {} as ColumnType,
        } as any;

        expect(helper.serializeValue(undefined, params)).toBeNull();
      });

      it('returns null for empty string', () => {
        const params = {
          serializeSearchQuery: true,
          col: {} as ColumnType,
        } as any;

        expect(helper.serializeValue('', params)).toBeNull();
      });

      it('returns value when child column is not found', () => {
        const lookupColumn: ColumnType = {
          id: 'col1',
          uidt: UITypes.Lookup,
          colOptions: {
            fk_relation_column_id: 'rel_col1',
            fk_lookup_column_id: 'lookup_col1',
          } as LookupType,
        } as ColumnType;

        const relationColumn: ColumnType = {
          id: 'rel_col1',
          uidt: UITypes.LinkToAnotherRecord,
          colOptions: {
            fk_related_model_id: 'related_table_id',
          } as LinkToAnotherRecordType,
        } as ColumnType;

        const meta: TableType = {
          id: 'table1',
          base_id: 'base1',
          columns: [lookupColumn, relationColumn],
        } as TableType;

        const relatedMeta: TableType = {
          id: 'related_table_id',
          base_id: 'base1',
          columns: [], // No child column with matching id
        } as TableType;

        const params = {
          serializeSearchQuery: true,
          col: lookupColumn,
          meta,
          metas: {
            'base1:related_table_id': relatedMeta,
          },
        } as any;

        expect(helper.serializeValue('test value', params)).toBe('test value');
      });

      it('serializes single value using child column helper (SingleLineText)', () => {
        const childColumn: ColumnType = {
          id: 'child_col1',
          uidt: UITypes.SingleLineText,
        } as ColumnType;

        const lookupColumn: ColumnType = {
          id: 'col1',
          uidt: UITypes.Lookup,
          colOptions: {
            fk_relation_column_id: 'rel_col1',
            fk_lookup_column_id: 'child_col1',
          } as LookupType,
        } as ColumnType;

        const relationColumn: ColumnType = {
          id: 'rel_col1',
          uidt: UITypes.LinkToAnotherRecord,
          colOptions: {
            fk_related_model_id: 'related_table_id',
          } as LinkToAnotherRecordType,
        } as ColumnType;

        const meta: TableType = {
          id: 'table1',
          base_id: 'base1',
          columns: [lookupColumn, relationColumn],
        } as TableType;

        const relatedMeta: TableType = {
          id: 'related_table_id',
          base_id: 'base1',
          columns: [childColumn],
        } as TableType;

        const params = {
          serializeSearchQuery: true,
          col: lookupColumn,
          meta,
          metas: {
            'base1:related_table_id': relatedMeta,
          },
        } as any;

        expect(helper.serializeValue('test value', params)).toBe('test value');
      });

      it('serializes array values using child column helper and joins with comma', () => {
        const childColumn: ColumnType = {
          id: 'child_col1',
          uidt: UITypes.SingleLineText,
        } as ColumnType;

        const lookupColumn: ColumnType = {
          id: 'col1',
          uidt: UITypes.Lookup,
          colOptions: {
            fk_relation_column_id: 'rel_col1',
            fk_lookup_column_id: 'child_col1',
          } as LookupType,
        } as ColumnType;

        const relationColumn: ColumnType = {
          id: 'rel_col1',
          uidt: UITypes.LinkToAnotherRecord,
          colOptions: {
            fk_related_model_id: 'related_table_id',
          } as LinkToAnotherRecordType,
        } as ColumnType;

        const meta: TableType = {
          id: 'table1',
          base_id: 'base1',
          columns: [lookupColumn, relationColumn],
        } as TableType;

        const relatedMeta: TableType = {
          id: 'related_table_id',
          base_id: 'base1',
          columns: [childColumn],
        } as TableType;

        const params = {
          serializeSearchQuery: true,
          col: lookupColumn,
          meta,
          metas: {
            'base1:related_table_id': relatedMeta,
          },
        } as any;

        expect(
          helper.serializeValue(['value1', 'value2', 'value3'], params)
        ).toBe('value1, value2, value3');
      });

      it('serializes number values using child Number column', () => {
        const childColumn: ColumnType = {
          id: 'child_col1',
          uidt: UITypes.Number,
        } as ColumnType;

        const lookupColumn: ColumnType = {
          id: 'col1',
          uidt: UITypes.Lookup,
          colOptions: {
            fk_relation_column_id: 'rel_col1',
            fk_lookup_column_id: 'child_col1',
          } as LookupType,
        } as ColumnType;

        const relationColumn: ColumnType = {
          id: 'rel_col1',
          uidt: UITypes.LinkToAnotherRecord,
          colOptions: {
            fk_related_model_id: 'related_table_id',
          } as LinkToAnotherRecordType,
        } as ColumnType;

        const meta: TableType = {
          id: 'table1',
          base_id: 'base1',
          columns: [lookupColumn, relationColumn],
        } as TableType;

        const relatedMeta: TableType = {
          id: 'related_table_id',
          base_id: 'base1',
          columns: [childColumn],
        } as TableType;

        const params = {
          serializeSearchQuery: true,
          col: lookupColumn,
          meta,
          metas: {
            'base1:related_table_id': relatedMeta,
          },
        } as any;

        expect(helper.serializeValue(42, params)).toBe(42);
      });

      it('serializes checkbox values using child Checkbox column', () => {
        const childColumn: ColumnType = {
          id: 'child_col1',
          uidt: UITypes.Checkbox,
        } as ColumnType;

        const lookupColumn: ColumnType = {
          id: 'col1',
          uidt: UITypes.Lookup,
          colOptions: {
            fk_relation_column_id: 'rel_col1',
            fk_lookup_column_id: 'child_col1',
          } as LookupType,
        } as ColumnType;

        const relationColumn: ColumnType = {
          id: 'rel_col1',
          uidt: UITypes.LinkToAnotherRecord,
          colOptions: {
            fk_related_model_id: 'related_table_id',
          } as LinkToAnotherRecordType,
        } as ColumnType;

        const meta: TableType = {
          id: 'table1',
          base_id: 'base1',
          columns: [lookupColumn, relationColumn],
        } as TableType;

        const relatedMeta: TableType = {
          id: 'related_table_id',
          base_id: 'base1',
          columns: [childColumn],
        } as TableType;

        const params = {
          serializeSearchQuery: true,
          col: lookupColumn,
          meta,
          metas: {
            'base1:related_table_id': relatedMeta,
          },
        } as any;

        expect(helper.serializeValue(true, params)).toBe(true);
        // Note: false is treated as falsy and returns null due to !value check
        expect(helper.serializeValue(false, params)).toBeNull();
      });

      it('handles lookup with different base_id (fk_related_base_id)', () => {
        const childColumn: ColumnType = {
          id: 'child_col1',
          uidt: UITypes.SingleLineText,
        } as ColumnType;

        const lookupColumn: ColumnType = {
          id: 'col1',
          uidt: UITypes.Lookup,
          colOptions: {
            fk_relation_column_id: 'rel_col1',
            fk_lookup_column_id: 'child_col1',
          } as LookupType,
        } as ColumnType;

        const relationColumn: ColumnType = {
          id: 'rel_col1',
          uidt: UITypes.LinkToAnotherRecord,
          colOptions: {
            fk_related_model_id: 'related_table_id',
            fk_related_base_id: 'base2', // Different base
          } as LinkToAnotherRecordType,
        } as ColumnType;

        const meta: TableType = {
          id: 'table1',
          base_id: 'base1',
          columns: [lookupColumn, relationColumn],
        } as TableType;

        const relatedMeta: TableType = {
          id: 'related_table_id',
          base_id: 'base2',
          columns: [childColumn],
        } as TableType;

        const params = {
          serializeSearchQuery: true,
          col: lookupColumn,
          meta,
          metas: {
            'base2:related_table_id': relatedMeta, // Uses different base_id
          },
        } as any;

        expect(helper.serializeValue('cross-base value', params)).toBe(
          'cross-base value'
        );
      });

      it('handles array with empty values', () => {
        const childColumn: ColumnType = {
          id: 'child_col1',
          uidt: UITypes.SingleLineText,
        } as ColumnType;

        const lookupColumn: ColumnType = {
          id: 'col1',
          uidt: UITypes.Lookup,
          colOptions: {
            fk_relation_column_id: 'rel_col1',
            fk_lookup_column_id: 'child_col1',
          } as LookupType,
        } as ColumnType;

        const relationColumn: ColumnType = {
          id: 'rel_col1',
          uidt: UITypes.LinkToAnotherRecord,
          colOptions: {
            fk_related_model_id: 'related_table_id',
          } as LinkToAnotherRecordType,
        } as ColumnType;

        const meta: TableType = {
          id: 'table1',
          base_id: 'base1',
          columns: [lookupColumn, relationColumn],
        } as TableType;

        const relatedMeta: TableType = {
          id: 'related_table_id',
          base_id: 'base1',
          columns: [childColumn],
        } as TableType;

        const params = {
          serializeSearchQuery: true,
          col: lookupColumn,
          meta,
          metas: {
            'base1:related_table_id': relatedMeta,
          },
        } as any;

        expect(
          helper.serializeValue(['value1', null, '', 'value2'], params)
        ).toBe('value1, , , value2');
      });
    });
  });

  describe('parseValue', () => {
    it('returns null for null value', () => {
      const params = {
        col: {} as ColumnType,
      } as any;

      expect(helper.parseValue(null, params)).toBeNull();
    });

    it('returns null for undefined value', () => {
      const params = {
        col: {} as ColumnType,
      } as any;

      expect(helper.parseValue(undefined, params)).toBeNull();
    });

    it('returns null for empty string', () => {
      const params = {
        col: {} as ColumnType,
      } as any;

      expect(helper.parseValue('', params)).toBeNull();
    });

    it('returns value as-is when child column is not found', () => {
      const lookupColumn: ColumnType = {
        id: 'col1',
        uidt: UITypes.Lookup,
        colOptions: {
          fk_relation_column_id: 'rel_col1',
          fk_lookup_column_id: 'lookup_col1',
        } as LookupType,
      } as ColumnType;

      const relationColumn: ColumnType = {
        id: 'rel_col1',
        uidt: UITypes.LinkToAnotherRecord,
        colOptions: {
          fk_related_model_id: 'related_table_id',
        } as LinkToAnotherRecordType,
      } as ColumnType;

      const meta: TableType = {
        id: 'table1',
        base_id: 'base1',
        columns: [lookupColumn, relationColumn],
      } as TableType;

      const relatedMeta: TableType = {
        id: 'related_table_id',
        base_id: 'base1',
        columns: [], // No child column
      } as TableType;

      const params = {
        col: lookupColumn,
        meta,
        metas: {
          'base1::related_table_id': relatedMeta,
        },
      } as any;

      expect(helper.parseValue('test value', params)).toBe('test value');
    });

    it('parses single value using child column helper', () => {
      const childColumn: ColumnType = {
        id: 'child_col1',
        uidt: UITypes.SingleLineText,
      } as ColumnType;

      const lookupColumn: ColumnType = {
        id: 'col1',
        uidt: UITypes.Lookup,
        colOptions: {
          fk_relation_column_id: 'rel_col1',
          fk_lookup_column_id: 'child_col1',
        } as LookupType,
      } as ColumnType;

      const relationColumn: ColumnType = {
        id: 'rel_col1',
        uidt: UITypes.LinkToAnotherRecord,
        colOptions: {
          fk_related_model_id: 'related_table_id',
        } as LinkToAnotherRecordType,
      } as ColumnType;

      const meta: TableType = {
        id: 'table1',
        base_id: 'base1',
        columns: [lookupColumn, relationColumn],
      } as TableType;

      const relatedMeta: TableType = {
        id: 'related_table_id',
        base_id: 'base1',
        columns: [childColumn],
      } as TableType;

      const params = {
        col: lookupColumn,
        meta,
        metas: {
          'base1::related_table_id': relatedMeta,
        },
      } as any;

      expect(helper.parseValue('test value', params)).toBe('test value');
    });

    it('parses array values using child column helper and joins with comma', () => {
      const childColumn: ColumnType = {
        id: 'child_col1',
        uidt: UITypes.SingleLineText,
      } as ColumnType;

      const lookupColumn: ColumnType = {
        id: 'col1',
        uidt: UITypes.Lookup,
        colOptions: {
          fk_relation_column_id: 'rel_col1',
          fk_lookup_column_id: 'child_col1',
        } as LookupType,
      } as ColumnType;

      const relationColumn: ColumnType = {
        id: 'rel_col1',
        uidt: UITypes.LinkToAnotherRecord,
        colOptions: {
          fk_related_model_id: 'related_table_id',
        } as LinkToAnotherRecordType,
      } as ColumnType;

      const meta: TableType = {
        id: 'table1',
        base_id: 'base1',
        columns: [lookupColumn, relationColumn],
      } as TableType;

      const relatedMeta: TableType = {
        id: 'related_table_id',
        base_id: 'base1',
        columns: [childColumn],
      } as TableType;

      const params = {
        col: lookupColumn,
        meta,
        metas: {
          'base1:related_table_id': relatedMeta,
        },
      } as any;

      expect(helper.parseValue(['value1', 'value2', 'value3'], params)).toBe(
        'value1, value2, value3'
      );
    });
  });

  describe('parsePlainCellValue', () => {
    it('returns empty string for null value', () => {
      const params = {
        col: {} as ColumnType,
      } as any;

      expect(helper.parsePlainCellValue(null, params)).toBe('');
    });

    it('returns parsed value for valid input', () => {
      const childColumn: ColumnType = {
        id: 'child_col1',
        uidt: UITypes.SingleLineText,
      } as ColumnType;

      const lookupColumn: ColumnType = {
        id: 'col1',
        uidt: UITypes.Lookup,
        colOptions: {
          fk_relation_column_id: 'rel_col1',
          fk_lookup_column_id: 'child_col1',
        } as LookupType,
      } as ColumnType;

      const relationColumn: ColumnType = {
        id: 'rel_col1',
        uidt: UITypes.LinkToAnotherRecord,
        colOptions: {
          fk_related_model_id: 'related_table_id',
        } as LinkToAnotherRecordType,
      } as ColumnType;

      const meta: TableType = {
        id: 'table1',
        base_id: 'base1',
        columns: [lookupColumn, relationColumn],
      } as TableType;

      const relatedMeta: TableType = {
        id: 'related_table_id',
        base_id: 'base1',
        columns: [childColumn],
      } as TableType;

      const params = {
        col: lookupColumn,
        meta,
        metas: {
          'base1::related_table_id': relatedMeta,
        },
      } as any;

      expect(helper.parsePlainCellValue('test value', params)).toBe(
        'test value'
      );
    });
  });
});
