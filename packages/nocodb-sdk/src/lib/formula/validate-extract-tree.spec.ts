import {
  checkForCircularFormulaRef,
  validateFormulaAndExtractTreeWithType,
} from './validate-extract-tree';
import { FormulaDataTypes, FormulaErrorType, JSEPNode } from './enums';
import { FormulaError } from './error';
import UITypes from '../UITypes';
import { SqlUiFactory } from '~/lib/sqlUi';
import { UnifiedMetaType } from '~/lib/types';
import { ParsedFormulaNode } from './types';

describe('validateFormulaAndExtractTreeWithType', () => {
  // Mock dependencies
  const mockColumns: UnifiedMetaType.IColumn[] = [
    {
      id: 'cl_col100000000001',
      title: 'Column1',
      uidt: UITypes.SingleLineText,
      dt: 'varchar',
      pv: false,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model1',
      deleted: false,
    },
    {
      id: 'cl_col200000000002',
      title: 'Column2',
      uidt: UITypes.Number,
      dt: 'int',
      pv: false,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model1',
      deleted: false,
    },
    {
      id: 'cl_col300000000003',
      title: 'Column3',
      uidt: UITypes.Date,
      dt: 'date',
      pv: false,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model1',
      deleted: false,
    },
    {
      id: 'cl_col400000000004',
      title: 'Column4',
      uidt: UITypes.Formula,
      dt: 'varchar',
      pv: false,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model1',
      deleted: false,
      colOptions: {
        formula: '{Column1}',
        formula_raw: '{Column1}',
        fk_column_id: 'cl_col400000000004',
        error: null,
        parsed_tree: {
          type: JSEPNode.IDENTIFIER,
          name: 'cl_col100000000001',
          dataType: FormulaDataTypes.STRING,
          referencedColumn: {
            id: 'cl_col100000000001',
            uidt: UITypes.SingleLineText,
          },
        },
        getParsedTree: () =>
          ({
            type: JSEPNode.IDENTIFIER,
            name: 'cl_col100000000001',
            dataType: FormulaDataTypes.STRING,
            referencedColumn: {
              id: 'cl_col100000000001',
              uidt: UITypes.SingleLineText,
            },
          } as any),
      } as UnifiedMetaType.IFormulaColumn,
    },
    {
      id: 'cl_col500000000005',
      title: 'Column5',
      uidt: UITypes.Lookup,
      dt: 'varchar',
      pv: false,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model1',
      deleted: false,
      colOptions: {
        fk_relation_column_id: 'cl_col600000000006',
        fk_lookup_column_id: 'cl_col700000000007',
        fk_column_id: 'cl_col500000000005',
      } as UnifiedMetaType.ILookupColumn,
    },
    {
      id: 'cl_col600000000006',
      title: 'Column6',
      uidt: UITypes.LinkToAnotherRecord,
      dt: 'varchar',
      pv: false,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model1',
      deleted: false,
      colOptions: {
        fk_related_model_id: 'model2',
        type: 'oo',
        fk_column_id: 'cl_col600000000006',
        id: 'cl_col600000000006',
      } as UnifiedMetaType.ILinkToAnotherRecordColumn,
    },
    {
      id: 'cl_col700000000007',
      title: 'Column7',
      uidt: UITypes.SingleLineText,
      dt: 'varchar',
      pv: true,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model2',
      deleted: false,
    },
    {
      id: 'cl_col800000000008',
      title: 'Column8',
      uidt: UITypes.Checkbox,
      dt: 'boolean',
      pv: false,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model1',
      deleted: false,
    },
    {
      id: 'cl_col900000000009',
      title: 'Column9',
      uidt: UITypes.Time,
      dt: 'time',
      pv: false,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model1',
      deleted: false,
    },
    {
      id: 'cl_col10000000010',
      title: 'Column10',
      uidt: UITypes.Formula,
      dt: 'varchar',
      pv: false,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model1',
      deleted: false,
      colOptions: {
        formula: '{Column4}', // Circular reference: Column10 -> Column4 -> Column1
        formula_raw: '{Column4}',
        fk_column_id: 'cl_col10000000010',
        error: null,
        parsed_tree: {
          type: JSEPNode.IDENTIFIER,
          name: 'cl_col400000000004',
          dataType: FormulaDataTypes.STRING,
          referencedColumn: { id: 'cl_col400000000004', uidt: UITypes.Formula },
        },
        getParsedTree: () =>
          ({
            type: JSEPNode.IDENTIFIER,
            name: 'cl_col400000000004',
            dataType: FormulaDataTypes.STRING,
            referencedColumn: {
              id: 'cl_col400000000004',
              uidt: UITypes.Formula,
            },
          } as any),
      } as UnifiedMetaType.IFormulaColumn,
    },
    {
      id: 'cl_dYAQE3SFa1F4ysx',
      title: 'Column11',
      uidt: UITypes.Formula,
      dt: 'varchar',
      pv: false,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model1',
      deleted: false,
      colOptions: {
        formula: '{cl_3hOMA9YnfkD4WWx}',
        formula_raw: '{Column12}',
        fk_column_id: 'cl_dYAQE3SFa1F4ysx',
        error: null,
        parsed_tree: {
          type: JSEPNode.IDENTIFIER,
          name: 'cl_3hOMA9YnfkD4WWx',
          dataType: FormulaDataTypes.STRING,
          referencedColumn: { id: 'cl_3hOMA9YnfkD4WWx', uidt: UITypes.Formula },
        },
        getParsedTree: () =>
          ({
            type: JSEPNode.IDENTIFIER,
            name: 'cl_3hOMA9YnfkD4WWx',
            dataType: FormulaDataTypes.STRING,
            referencedColumn: {
              id: 'cl_3hOMA9YnfkD4WWx',
              uidt: UITypes.Formula,
            },
          } as any),
      } as UnifiedMetaType.IFormulaColumn,
    },
    {
      id: 'cl_3hOMA9YnfkD4WWx',
      title: 'Column12',
      uidt: UITypes.Formula,
      dt: 'varchar',
      pv: false,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      fk_model_id: 'model1',
      deleted: false,
      colOptions: {
        formula: '{cl_dYAQE3SFa1F4ysx}',
        formula_raw: '{Column11}',
        fk_column_id: 'cl_col12000000012',
        error: null,
        parsed_tree: {
          type: JSEPNode.IDENTIFIER,
          name: 'cl_dYAQE3SFa1F4ysx',
          dataType: FormulaDataTypes.STRING,
          referencedColumn: { id: 'cl_dYAQE3SFa1F4ysx', uidt: UITypes.Formula },
        },
        getParsedTree: () =>
          ({
            type: JSEPNode.IDENTIFIER,
            name: 'cl_dYAQE3SFa1F4ysx',
            dataType: FormulaDataTypes.STRING,
            referencedColumn: {
              id: 'cl_dYAQE3SFa1F4ysx',
              uidt: UITypes.Formula,
            },
          } as any),
      } as UnifiedMetaType.IFormulaColumn,
    },
    // case Function to rollup
    {
      id: 'cl_iro4tf7xfab6pjx',
      title: 'Max(Number) from Table-L1',
      uidt: UITypes.SingleLineText,
      base_id: 'base1',
    },
  ];

  const mockGetMeta: UnifiedMetaType.IGetModel = jest.fn(
    async (_context, options) => {
      if (options.id === 'model2') {
        return {
          id: 'model2',
          title: 'Model2',
          base_id: 'base1',
          columns: [
            {
              id: 'cl_col700000000007',
              title: 'Column7',
              uidt: UITypes.SingleLineText,
              dt: 'varchar',
              pv: true,
              base_id: 'base1',
              fk_workspace_id: 'ws1',
              fk_model_id: 'model2',
              deleted: false,
            },
          ],
        };
      }
      return {
        id: 'model1',
        title: 'Model1',
        base_id: 'base1',
        columns: mockColumns,
      };
    }
  );

  const mockClientOrSqlUi = SqlUiFactory.create({ client: 'pg' });

  const caseIdentifierRollup = {
    column: {
      id: 'cl_4o52mufchcfgi8x',
      source_id: 'bv4r9c7t9enq9vs',
      base_id: 'p4zgm45rxfc6izi',
      fk_model_id: 'mroakgv13nikn55',
      title: 'Formula',
      column_name: 'Formula',
      uidt: 'Formula',
      system: false,
      order: 10,
      meta: {
        display_column_meta: {
          meta: {},
          custom: {},
        },
        defaultViewColOrder: 10,
        defaultViewColVisibility: true,
      },
      readonly: false,
      fk_workspace_id: 'w5x8zatd',
      colOptions: {
        parsed_tree: {
          type: 'Identifier',
          name: 'cl_pqnd2bdmzg00x1x',
          raw: '{{cpqnd2bdmzg00x1}}',
          dataType: 'string',
          isDataArray: true,
          referencedColumn: {
            id: 'cl_zb6z4e94l7kiyrx',
            uidt: 'SingleLineText',
            intermediaryUidt: 'LinkToAnotherRecord',
            intermediaryId: 'cl_pqnd2bdmzg00x1x',
          },
        },
        id: 'fhl7s1abjhwj6e0',
        fk_column_id: 'cl_4o52mufchcfgi8x',
        formula: '{{cpqnd2bdmzg00x1}}',
        formula_raw: '{Table-L1}',
        base_id: 'p4zgm45rxfc6izi',
        fk_workspace_id: 'w5x8zatd',
      },
      extra: {
        display_type: 'SingleLineText',
      },
    },
    columns: [
      {
        id: 'cl_izch3j3b3inbivx',
        source_id: 'bv4r9c7t9enq9vs',
        base_id: 'p4zgm45rxfc6izi',
        fk_model_id: 'mroakgv13nikn55',
        title: 'Id',
        column_name: 'id',
        uidt: 'ID',
        order: 1,
        meta: {
          defaultViewColOrder: 2,
          defaultViewColVisibility: true,
        },
        readonly: false,
        fk_workspace_id: 'w5x8zatd',
      },
      {
        id: 'cl_pxst4a7s3wf3pbx',
        source_id: 'bv4r9c7t9enq9vs',
        base_id: 'p4zgm45rxfc6izi',
        fk_model_id: 'mroakgv13nikn55',
        title: 'Title',
        column_name: 'title',
        uidt: 'SingleLineText',
        pv: true,
        system: false,
        order: 7,
        meta: {
          defaultViewColOrder: 1,
          defaultViewColVisibility: true,
        },
        readonly: false,
        fk_workspace_id: 'w5x8zatd',
        extra: {},
      },
      {
        id: 'cl_pqnd2bdmzg00x1x',
        source_id: 'bv4r9c7t9enq9vs',
        base_id: 'p4zgm45rxfc6izi',
        fk_model_id: 'mroakgv13nikn55',
        title: 'Table-L1',
        uidt: 'LinkToAnotherRecord',
        virtual: true,
        order: 8,
        meta: {
          plural: 'Table-L1s',
          singular: 'Table-L1',
          custom: false,
          defaultViewColOrder: 8,
          defaultViewColVisibility: true,
        },
        readonly: false,
        fk_workspace_id: 'w5x8zatd',
        colOptions: {
          virtual: true,
          id: 'lurlzpshvoroi9a',
          type: 'hm',
          fk_column_id: 'cl_pqnd2bdmzg00x1x',
          fk_related_model_id: 'mr6xbpmnuuusa9y',
          fk_child_column_id: 'c1tmwp5y0mx5036',
          fk_parent_column_id: 'cl_izch3j3b3inbivx',
          base_id: 'p4zgm45rxfc6izi',
          fk_workspace_id: 'w5x8zatd',
        },
        extra: {},
      },
      {
        id: 'cl_cuxnqvpoueby3rx',
        source_id: 'bv4r9c7t9enq9vs',
        base_id: 'p4zgm45rxfc6izi',
        fk_model_id: 'mroakgv13nikn55',
        title: 'Max(Number) from Table-L1',
        column_name: 'Max(Number) from Table-L1',
        uidt: 'Rollup',
        system: false,
        order: 9,
        meta: {
          precision: 0,
          isLocaleString: false,
          defaultViewColOrder: 9,
          defaultViewColVisibility: true,
        },
        readonly: false,
        fk_workspace_id: 'w5x8zatd',
        colOptions: {
          id: 'rl6o2v6aesvywmry',
          fk_column_id: 'cl_cuxnqvpoueby3rx',
          fk_relation_column_id: 'cl_pqnd2bdmzg00x1x',
          fk_rollup_column_id: 'cl_iro4tf7xfab6pjx',
          rollup_function: 'max',
          base_id: 'p4zgm45rxfc6izi',
          fk_workspace_id: 'w5x8zatd',
        },
        extra: {},
      },
    ],
    formula: '{Max(Number) from Table-L1}',
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test cases for function name validation
  it('should throw INVALID_FUNCTION_NAME for unknown function', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'UNKNOWN_FUNC()',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'UNKNOWN_FUNC()',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.INVALID_FUNCTION_NAME);
  });

  it('should throw INVALID_FUNCTION_NAME for unsupported function by database', async () => {
    const mocked = jest
      .spyOn(mockClientOrSqlUi, 'getUnsupportedFnList')
      .mockReturnValue(['UPPER']);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'UPPER("test")',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'UPPER("test")',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.INVALID_FUNCTION_NAME);
    mocked.mockRestore();
  });

  // Test cases for argument validation
  it('should throw INVALID_ARG for missing required arguments', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'CONCAT()', // CONCAT requires at least 1 argument
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'CONCAT()',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.MIN_ARG);
  });

  it('should throw INVALID_ARG for too many arguments', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'UPPER("a", "b")', // NOT takes exactly 1 argument
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'UPPER("a", "b")',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.INVALID_ARG);
  });

  it('should throw INVALID_ARG for incorrect argument type (identifier)', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'MIN({Column1},{Column2})', // Column2 is numeric, UPPER expects string
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'MIN({Column1},{Column2})', // Column2 is numeric, UPPER expects string
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.INVALID_ARG);
  });

  it('should throw INVALID_ARG for incorrect argument type (literal)', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'MIN("day", 1)',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'MIN("day", 1)',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.INVALID_ARG);
  });

  // Test cases for identifier resolution
  it('should resolve column by title', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column1}',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.IDENTIFIER);
    expect((result as any).name).toBe('cl_col100000000001');
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  it('should resolve column by id', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{cl_col100000000001}',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.IDENTIFIER);
    expect((result as any).name).toBe('cl_col100000000001');
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  it('should throw INVALID_COLUMN for unknown column', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '{UNKNOWN_COL}',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '{UNKNOWN_COL}',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.INVALID_COLUMN);
  });

  it('should handle formula column correctly', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column4}', // Column4 is a formula column that references Column1
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.IDENTIFIER);
    expect((result as any).name).toBe('cl_col400000000004');
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  it('should handle lookup column correctly', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column5}', // Column5 is a lookup column
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.IDENTIFIER);
    expect((result as any).name).toBe('cl_col500000000005');
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  it('should handle LTAR column correctly', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column6}', // Column6 is an LTAR column
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.IDENTIFIER);
    expect((result as any).name).toBe('cl_col600000000006');
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  it('should detect circular reference in formula columns', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '{Column11}',
        column: mockColumns.find((c) => c.id === 'cl_3hOMA9YnfkD4WWx'), // col12 references col11, col11 references col12
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '{Column11}',
        column: mockColumns.find((c) => c.id === 'cl_3hOMA9YnfkD4WWx'),
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.CIRCULAR_REFERENCE);
  });

  // Test cases for literal handling
  it('should identify numeric literal', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '123',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.LITERAL);
    expect((result as any).dataType).toBe(FormulaDataTypes.NUMERIC);
  });

  it('should identify string literal', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '"hello"',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.LITERAL);
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  it('should identify boolean CALL_EXP', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: 'ISBLANK("")',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.CALL_EXP);
    expect((result as any).dataType).toBe(FormulaDataTypes.BOOLEAN);
  });

  // Test cases for unary expression
  it('should handle negative numeric literal', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '-123',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.UNARY_EXP);
    expect((result as any).dataType).toBe(FormulaDataTypes.NUMERIC);
  });

  it('should throw NOT_SUPPORTED for unsupported unary expression', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '!TRUE', // NOT is a function, not a unary operator in this context
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '!TRUE',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.NOT_SUPPORTED);
  });

  // Test cases for binary expression
  it('should handle date subtraction (DATE - DATE)', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column3} - {Column3}',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.CALL_EXP);
    expect((result as any).callee.name).toBe('DATETIME_DIFF');
    expect((result as any).dataType).toBe(FormulaDataTypes.NUMERIC);
  });

  it('should handle time subtraction (INTERVAL - INTERVAL)', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column9} - {Column9}',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.CALL_EXP);
    expect((result as any).callee.name).toBe('DATETIME_DIFF');
    expect((result as any).dataType).toBe(FormulaDataTypes.NUMERIC);
  });

  it('should handle date and interval subtraction (DATE - INTERVAL)', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column3} - {Column9}',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.BINARY_EXP);
    expect((result as any).operator).toBe('-');
    expect((result as any).dataType).toBe(FormulaDataTypes.DATE);
  });

  it('should handle date and interval addition (DATE + INTERVAL)', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column3} + {Column9}',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.BINARY_EXP);
    expect((result as any).operator).toBe('+');
    expect((result as any).dataType).toBe(FormulaDataTypes.DATE);
  });

  it('should handle interval addition (INTERVAL + INTERVAL)', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column9} + {Column9}',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.BINARY_EXP);
    expect((result as any).operator).toBe('+');
    expect((result as any).dataType).toBe(FormulaDataTypes.NUMERIC);
  });

  it('should handle comparison operators', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column2} > 10',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.BINARY_EXP);
    expect((result as any).operator).toBe('>');
    expect((result as any).dataType).toBe(FormulaDataTypes.COND_EXP);
  });

  it('should handle arithmetic operators', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column2} * 2',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.BINARY_EXP);
    expect((result as any).operator).toBe('*');
    expect((result as any).dataType).toBe(FormulaDataTypes.NUMERIC);
  });

  it('should handle string concatenation with &', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column1} & " suffix"',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.BINARY_EXP);
    expect((result as any).operator).toBe('&');
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  it('should handle string concatenation with + if one operand is string', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column2} + " suffix"',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.BINARY_EXP);
    expect((result as any).operator).toBe('+');
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  // Test cases for unsupported nodes
  it('should throw NOT_SUPPORTED for member expression', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'obj.property',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'obj.property',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.NOT_SUPPORTED);
  });

  it('should throw NOT_SUPPORTED for array expression', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '[1, 2, 3]',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '[1, 2, 3]',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.NOT_SUPPORTED);
  });

  it('should throw NOT_SUPPORTED for compound statement', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '1; 2',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '1; 2',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.NOT_SUPPORTED);
  });

  it('should handle nested formulas correctly', async () => {
    const formulaCol10 = mockColumns.find((c) => c.id === 'cl_col10000000010');
    (formulaCol10.colOptions as UnifiedMetaType.IFormulaColumn).formula =
      '{Column4}'; // col10 -> col4 -> col1
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column10}',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.IDENTIFIER);
    expect((result as any).name).toBe('cl_col10000000010');
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  it('should cast non-string arguments to string if expected type is string', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: 'CONCAT({Column1}, {Column2})', // Column2 is numeric, should be cast to string
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.CALL_EXP);
    expect((result as any).callee.name).toBe('CONCAT');
    expect((result as any).arguments[1].dataType).toBe(
      FormulaDataTypes.NUMERIC
    );
  });

  it('should throw INVALID_SYNTAX for missing parentheses after function name', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'UPPER',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: 'UPPER',
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toHaveProperty('type', FormulaErrorType.INVALID_SYNTAX);
  });
  it('should return correct when identifier to rollup', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: caseIdentifierRollup.formula,
      columns: caseIdentifierRollup.columns as any[],
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.referencedColumn.uidt).toBe('SingleLineText');
  });
});

describe('checkForCircularFormulaRef', () => {
  // Helper function to create a formula column
  // Note: formula string should contain actual column IDs (14-15 chars) for circular ref detection
  const createFormulaColumn = (config: {
    id: string;
    title: string;
    fk_model_id: string;
    base_id: string;
    formula: string;
    referencedColIds: string[];
    parsedTree?: ParsedFormulaNode;
  }): UnifiedMetaType.IColumn => ({
    id: config.id,
    title: config.title,
    uidt: UITypes.Formula,
    dt: 'varchar',
    pv: false,
    base_id: config.base_id,
    fk_workspace_id: 'ws1',
    fk_model_id: config.fk_model_id,
    deleted: false,
    colOptions: {
      formula: config.formula,
      formula_raw: config.formula,
      fk_column_id: config.id,
      error: null,
      parsed_tree: config.parsedTree,
    } as UnifiedMetaType.IFormulaColumn,
  });

  // Helper function to create a lookup column
  const createLookupColumn = (config: {
    id: string;
    title: string;
    fk_model_id: string;
    base_id: string;
    fk_relation_column_id: string;
    fk_lookup_column_id: string;
  }): UnifiedMetaType.IColumn => ({
    id: config.id,
    title: config.title,
    uidt: UITypes.Lookup,
    dt: 'varchar',
    pv: false,
    base_id: config.base_id,
    fk_workspace_id: 'ws1',
    fk_model_id: config.fk_model_id,
    deleted: false,
    colOptions: {
      fk_relation_column_id: config.fk_relation_column_id,
      fk_lookup_column_id: config.fk_lookup_column_id,
      fk_column_id: config.id,
    } as UnifiedMetaType.ILookupColumn,
  });

  // Helper function to create an LTAR column
  const createLTARColumn = (config: {
    id: string;
    title: string;
    fk_model_id: string;
    base_id: string;
    fk_related_model_id: string;
    fk_related_base_id?: string;
    type: 'hm' | 'mm' | 'bt' | 'oo';
  }): UnifiedMetaType.IColumn => ({
    id: config.id,
    title: config.title,
    uidt: UITypes.LinkToAnotherRecord,
    dt: 'varchar',
    pv: false,
    base_id: config.base_id,
    fk_workspace_id: 'ws1',
    fk_model_id: config.fk_model_id,
    deleted: false,
    colOptions: {
      fk_related_model_id: config.fk_related_model_id,
      fk_related_base_id: config.fk_related_base_id,
      type: config.type,
      fk_column_id: config.id,
      id: config.id,
    } as UnifiedMetaType.ILinkToAnotherRecordColumn,
  });

  // Helper function to create a simple text column
  const createTextColumn = (config: {
    id: string;
    title: string;
    fk_model_id: string;
    base_id: string;
    isPrimary?: boolean;
  }): UnifiedMetaType.IColumn => ({
    id: config.id,
    title: config.title,
    uidt: UITypes.SingleLineText,
    dt: 'varchar',
    pv: config.isPrimary || false,
    base_id: config.base_id,
    fk_workspace_id: 'ws1',
    fk_model_id: config.fk_model_id,
    deleted: false,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Direct Formula-to-Formula Circular References', () => {
    it('should throw CIRCULAR_REFERENCE for simple two-column circular reference', async () => {
      // FormulaA references FormulaB, FormulaB references FormulaA
      const colFormulaA = createFormulaColumn({
        id: 'cl_AbCdEfGhIjKlMn', // 15 chars
        title: 'FormulaA',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_XyZ0123456789a}', // References FormulaB's ID
        referencedColIds: ['cl_XyZ0123456789a'],
        parsedTree: {
          type: JSEPNode.IDENTIFIER,
          name: 'cl_XyZ0123456789a',
          raw: '{cl_XyZ0123456789a}',
        },
      });

      const colFormulaB = createFormulaColumn({
        id: 'cl_XyZ0123456789a', // 15 chars
        title: 'FormulaB',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_AbCdEfGhIjKlMn}', // References FormulaA's ID
        referencedColIds: ['cl_AbCdEfGhIjKlMn'],
        parsedTree: {
          type: JSEPNode.IDENTIFIER,
          name: 'cl_AbCdEfGhIjKlMn',
          raw: '{cl_AbCdEfGhIjKlMn}',
        },
      });

      const columns = [colFormulaA, colFormulaB];

      const mockGetMeta = jest.fn(async () => ({
        id: 'model1',
        title: 'Model1',
        base_id: 'base1',
        columns,
      }));

      await expect(
        checkForCircularFormulaRef(
          colFormulaA,
          {
            type: JSEPNode.IDENTIFIER,
            name: 'FormulaB',
            raw: '{FormulaB}',
          },
          columns,
          mockGetMeta
        )
      ).rejects.toHaveProperty('type', FormulaErrorType.CIRCULAR_REFERENCE);
    });

    it('should throw CIRCULAR_REFERENCE for three-column circular chain', async () => {
      // FormulaA → FormulaB → FormulaC → FormulaA
      const colFormulaA = createFormulaColumn({
        id: 'cAaAaAaAaAaAaAa', // 15 chars
        title: 'FormulaA',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cBbBbBbBbBbBbBb}', // References FormulaB
        referencedColIds: ['cBbBbBbBbBbBbBb'],
      });

      const colFormulaB = createFormulaColumn({
        id: 'cBbBbBbBbBbBbBb', // 15 chars
        title: 'FormulaB',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cCcCcCcCcCcCcCc}', // References FormulaC
        referencedColIds: ['cCcCcCcCcCcCcCc'],
      });

      const colFormulaC = createFormulaColumn({
        id: 'cCcCcCcCcCcCcCc', // 15 chars
        title: 'FormulaC',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cAaAaAaAaAaAaAa}', // References FormulaA
        referencedColIds: ['cAaAaAaAaAaAaAa'],
      });

      const columns = [colFormulaA, colFormulaB, colFormulaC];

      const mockGetMeta = jest.fn(async () => ({
        id: 'model1',
        title: 'Model1',
        base_id: 'base1',
        columns,
      }));

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'FormulaB',
      } as any;

      await expect(
        checkForCircularFormulaRef(
          colFormulaA,
          parsedTree,
          columns,
          mockGetMeta
        )
      ).rejects.toHaveProperty('type', FormulaErrorType.CIRCULAR_REFERENCE);
    });

    it('should throw CIRCULAR_REFERENCE for self-referencing formula', async () => {
      // FormulaA references itself
      const colFormulaA = createFormulaColumn({
        id: 'cSelfRefAaAaAaA', // 15 chars
        title: 'FormulaA',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cSelfRefAaAaAaA}', // References itself
        referencedColIds: ['cSelfRefAaAaAaA'],
      });

      const columns = [colFormulaA];

      const mockGetMeta = jest.fn(async () => ({
        id: 'model1',
        title: 'Model1',
        base_id: 'base1',
        columns,
      }));

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'FormulaA',
      } as any;

      await expect(
        checkForCircularFormulaRef(
          colFormulaA,
          parsedTree,
          columns,
          mockGetMeta
        )
      ).rejects.toHaveProperty('type', FormulaErrorType.CIRCULAR_REFERENCE);
    });
  });

  describe('Lookup-Based Circular References', () => {
    // TODO: check the function later
    it.skip('should throw CIRCULAR_REFERENCE when formula references lookup that creates cycle', async () => {
      // Table1: FormulaA → LookupB → Table2.FormulaC
      // Table2: FormulaC → LookupD → Table1.FormulaA

      // Table1 columns
      const table1LTARtoTable2 = createLTARColumn({
        id: 'cl_8hK2mNpQ3rTvXz9',
        title: 'RelationToTable2',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_related_model_id: 'model2',
        type: 'hm',
      });

      const table1LookupB = createLookupColumn({
        id: 'cl_5wJ9bLpM4sUyWa7',
        title: 'LookupB',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_relation_column_id: 'cl_8hK2mNpQ3rTvXz9',
        fk_lookup_column_id: 'cl_6xP3cQrN5tVzXb8',
      });

      const table1FormulaA = createFormulaColumn({
        id: 'cl_4fG8aHpL2qSxYc6',
        title: 'FormulaA',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_5wJ9bLpM4sUyWa7}',
        referencedColIds: ['cl_5wJ9bLpM4sUyWa7'],
      });

      const table1Columns = [table1FormulaA, table1LookupB, table1LTARtoTable2];

      // Table2 columns
      const table2LTARtoTable1 = createLTARColumn({
        id: 'cl_9iL3dRsO6uWaYd0',
        title: 'RelationToTable1',
        fk_model_id: 'model2',
        base_id: 'base1',
        fk_related_model_id: 'model1',
        type: 'bt',
      });

      const table2LookupD = createLookupColumn({
        id: 'cl_7yR4eStP7vXbZe1',
        title: 'LookupD',
        fk_model_id: 'model2',
        base_id: 'base1',
        fk_relation_column_id: 'cl_9iL3dRsO6uWaYd0',
        fk_lookup_column_id: 'cl_4fG8aHpL2qSxYc6',
      });

      const table2FormulaC = createFormulaColumn({
        id: 'cl_6xP3cQrN5tVzXb8',
        title: 'FormulaC',
        fk_model_id: 'model2',
        base_id: 'base1',
        formula: '{cl_7yR4eStP7vXbZe1}',
        referencedColIds: ['cl_7yR4eStP7vXbZe1'],
      });

      const table2Columns = [table2FormulaC, table2LookupD, table2LTARtoTable1];

      const mockGetMeta = jest.fn(async (_context, options) => {
        if (options.id === 'model2') {
          return {
            id: 'model2',
            title: 'Model2',
            base_id: 'base1',
            columns: table2Columns,
          };
        }
        return {
          id: 'model1',
          title: 'Model1',
          base_id: 'base1',
          columns: table1Columns,
        };
      });

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'LookupB',
      } as any;

      await expect(
        checkForCircularFormulaRef(
          table1FormulaA,
          parsedTree,
          table1Columns,
          mockGetMeta
        )
      ).rejects.toHaveProperty('type', FormulaErrorType.CIRCULAR_REFERENCE);
    });

    it('should pass when formula references lookup to non-formula column', async () => {
      // Table1: FormulaA → LookupB → Table2.TextColumn

      const table1LTARtoTable2 = createLTARColumn({
        id: 'cl_ltar1000000001',
        title: 'RelationToTable2',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_related_model_id: 'model2',
        type: 'hm',
      });

      const table1LookupB = createLookupColumn({
        id: 'cl_lookupb0000001',
        title: 'LookupB',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_relation_column_id: 'cl_ltar1000000001',
        fk_lookup_column_id: 'cl_text000000001',
      });

      const table1FormulaA = createFormulaColumn({
        id: 'cFormula_A_T1_15', // 15 chars
        title: 'FormulaA',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_lookupb0000001}',
        referencedColIds: ['cl_lookupb0000001'],
      });

      const table1Columns = [table1FormulaA, table1LookupB, table1LTARtoTable2];

      // Table2 with just a text column
      const table2TextCol = createTextColumn({
        id: 'cl_text000000001',
        title: 'TextColumn',
        fk_model_id: 'model2',
        base_id: 'base1',
      });

      const table2Columns = [table2TextCol];

      const mockGetMeta = jest.fn(async (_context, options) => {
        if (options.id === 'model2') {
          return {
            id: 'model2',
            title: 'Model2',
            base_id: 'base1',
            columns: table2Columns,
          };
        }
        return {
          id: 'model1',
          title: 'Model1',
          base_id: 'base1',
          columns: table1Columns,
        };
      });

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'LookupB',
      } as any;

      await expect(
        checkForCircularFormulaRef(
          table1FormulaA,
          parsedTree,
          table1Columns,
          mockGetMeta
        )
      ).resolves.not.toThrow();
    });

    // TODO: check the function later
    it.skip('should throw CIRCULAR_REFERENCE for multi-hop lookup chain with cycle', async () => {
      // Table1.FormulaA → Lookup1 → Table2.FormulaB
      // Table2.FormulaB → Lookup2 → Table3.FormulaC
      // Table3.FormulaC → Lookup3 → Table1.FormulaA

      // Table1
      const table1LTAR = createLTARColumn({
        id: 'cl_ltar1000000001',
        title: 'RelationToTable2',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_related_model_id: 'model2',
        type: 'hm',
      });

      const table1Lookup = createLookupColumn({
        id: 'cl_lookup10000001',
        title: 'Lookup1',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_relation_column_id: 'cl_ltar1000000001',
        fk_lookup_column_id: 'cFormula_B_T2_15',
      });

      const table1Formula = createFormulaColumn({
        id: 'cFormula_A_T1_15', // 15 chars
        title: 'FormulaA',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_lookup10000001}',
        referencedColIds: ['cl_lookup10000001'],
      });

      const table1Columns = [table1Formula, table1Lookup, table1LTAR];

      // Table2
      const table2LTAR = createLTARColumn({
        id: 'cl_ltar2000000002',
        title: 'RelationToTable3',
        fk_model_id: 'model2',
        base_id: 'base1',
        fk_related_model_id: 'model3',
        type: 'hm',
      });

      const table2Lookup = createLookupColumn({
        id: 'cl_lookup20000002',
        title: 'Lookup2',
        fk_model_id: 'model2',
        base_id: 'base1',
        fk_relation_column_id: 'cl_ltar2000000002',
        fk_lookup_column_id: 'cFormula_C_T3_15',
      });

      const table2Formula = createFormulaColumn({
        id: 'cFormula_B_T2_15', // 15 chars
        title: 'FormulaB',
        fk_model_id: 'model2',
        base_id: 'base1',
        formula: '{cl_lookup20000002}',
        referencedColIds: ['cl_lookup20000002'],
      });

      const table2Columns = [table2Formula, table2Lookup, table2LTAR];

      // Table3
      const table3LTAR = createLTARColumn({
        id: 'cl_ltar3000000003',
        title: 'RelationToTable1',
        fk_model_id: 'model3',
        base_id: 'base1',
        fk_related_model_id: 'model1',
        type: 'hm',
      });

      const table3Lookup = createLookupColumn({
        id: 'cl_lookup30000003',
        title: 'Lookup3',
        fk_model_id: 'model3',
        base_id: 'base1',
        fk_relation_column_id: 'cl_ltar3000000003',
        fk_lookup_column_id: 'cFormula_A_T1_15',
      });

      const table3Formula = createFormulaColumn({
        id: 'cFormula_C_T3_15', // 15 chars
        title: 'FormulaC',
        fk_model_id: 'model3',
        base_id: 'base1',
        formula: '{cl_lookup30000003}',
        referencedColIds: ['cl_lookup30000003'],
      });

      const table3Columns = [table3Formula, table3Lookup, table3LTAR];

      const mockGetMeta = jest.fn(async (_context, options) => {
        if (options.id === 'model2') {
          return {
            id: 'model2',
            title: 'Model2',
            base_id: 'base1',
            columns: table2Columns,
          };
        }
        if (options.id === 'model3') {
          return {
            id: 'model3',
            title: 'Model3',
            base_id: 'base1',
            columns: table3Columns,
          };
        }
        return {
          id: 'model1',
          title: 'Model1',
          base_id: 'base1',
          columns: table1Columns,
        };
      });

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'Lookup1',
      } as any;

      await expect(
        checkForCircularFormulaRef(
          table1Formula,
          parsedTree,
          table1Columns,
          mockGetMeta
        )
      ).rejects.toHaveProperty('type', FormulaErrorType.CIRCULAR_REFERENCE);
    });
  });

  describe('LTAR Primary Value Circular References', () => {
    it('should throw CIRCULAR_REFERENCE when formula references LTAR with circular primary value', async () => {
      // Table1.FormulaA references Table1.LTAR (which resolves to Table2's primary value)
      // Table2's primary value is FormulaB which references back to Table1.FormulaA

      const table1LTAR = createLTARColumn({
        id: 'cl_ltar1000000001',
        title: 'RelationToTable2',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_related_model_id: 'model2',
        type: 'hm',
      });

      const table1FormulaA = createFormulaColumn({
        id: 'cFormula_A_PV_15', // 15 chars - Primary Value
        title: 'FormulaA',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_ltar1000000001}',
        referencedColIds: ['cl_ltar1000000001'],
      });

      (table1FormulaA as any).pv = true; // Set as primary value

      const table1Columns = [table1FormulaA, table1LTAR];

      // Table2 with primary value as formula
      const table2LTAR = createLTARColumn({
        id: 'cl_ltar2000000002',
        title: 'RelationToTable1',
        fk_model_id: 'model2',
        base_id: 'base1',
        fk_related_model_id: 'model1',
        type: 'bt',
      });

      const table2FormulaB = createFormulaColumn({
        id: 'cFormula_B_PV_15', // 15 chars - Primary Value
        title: 'FormulaBPrimary',
        fk_model_id: 'model2',
        base_id: 'base1',
        formula: '{cl_ltar2000000002}',
        referencedColIds: ['cl_ltar2000000002'],
      });

      (table2FormulaB as any).pv = true; // Set as primary value

      const table2Columns = [table2FormulaB, table2LTAR];

      const mockGetMeta = jest.fn(async (_context, options) => {
        if (options.id === 'model2') {
          return {
            id: 'model2',
            title: 'Model2',
            base_id: 'base1',
            columns: table2Columns,
          };
        }
        return {
          id: 'model1',
          title: 'Model1',
          base_id: 'base1',
          columns: table1Columns,
        };
      });

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'RelationToTable2',
      } as any;

      await expect(
        checkForCircularFormulaRef(
          table1FormulaA,
          parsedTree,
          table1Columns,
          mockGetMeta
        )
      ).rejects.toHaveProperty('type', FormulaErrorType.CIRCULAR_REFERENCE);
    });

    it('should pass when LTAR points to non-formula primary value', async () => {
      // Table1.FormulaA references Table1.LTAR
      // Table2's primary value is a simple text column

      const table1LTAR = createLTARColumn({
        id: 'cl_ltar1000000001',
        title: 'RelationToTable2',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_related_model_id: 'model2',
        type: 'hm',
      });

      const table1FormulaA = createFormulaColumn({
        id: 'cl_formulaa000001',
        title: 'FormulaA',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_ltar1000000001}',
        referencedColIds: ['cl_ltar1000000001'],
      });

      const table1Columns = [table1FormulaA, table1LTAR];

      // Table2 with text primary value
      const table2TextPrimary = createTextColumn({
        id: 'cl_textprimar001',
        title: 'TextPrimary',
        fk_model_id: 'model2',
        base_id: 'base1',
        isPrimary: true,
      });

      const table2Columns = [table2TextPrimary];

      const mockGetMeta = jest.fn(async (_context, options) => {
        if (options.id === 'model2') {
          return {
            id: 'model2',
            title: 'Model2',
            base_id: 'base1',
            columns: table2Columns,
          };
        }
        return {
          id: 'model1',
          title: 'Model1',
          base_id: 'base1',
          columns: table1Columns,
        };
      });

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'RelationToTable2',
      } as any;

      await expect(
        checkForCircularFormulaRef(
          table1FormulaA,
          parsedTree,
          table1Columns,
          mockGetMeta
        )
      ).resolves.not.toThrow();
    });
  });

  describe('Cross-Base Circular References', () => {
    // TODO: check the function later
    it.skip('should throw CIRCULAR_REFERENCE for cross-base lookup with cycle', async () => {
      // Base1.Table1.FormulaA → Lookup → Base2.Table2.FormulaB
      // Base2.Table2.FormulaB → Lookup → Base1.Table1.FormulaA

      // Base1 Table1
      const table1LTAR = createLTARColumn({
        id: 'cl_ltar1000000001',
        title: 'CrossBaseRelation',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_related_model_id: 'model2',
        fk_related_base_id: 'base2',
        type: 'hm',
      });

      const table1Lookup = createLookupColumn({
        id: 'cl_lookup10000001',
        title: 'Lookup1',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_relation_column_id: 'cl_ltar1000000001',
        fk_lookup_column_id: 'cFormula_B_B2_15',
      });

      const table1Formula = createFormulaColumn({
        id: 'cFormula_A_B1_15', // 15 chars - Base1
        title: 'FormulaA',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_lookup10000001}',
        referencedColIds: ['cl_lookup10000001'],
      });

      const table1Columns = [table1Formula, table1Lookup, table1LTAR];

      // Base2 Table2
      const table2LTAR = createLTARColumn({
        id: 'cl_ltar2000000002',
        title: 'CrossBaseRelationBack',
        fk_model_id: 'model2',
        base_id: 'base2',
        fk_related_model_id: 'model1',
        fk_related_base_id: 'base1',
        type: 'bt',
      });

      const table2Lookup = createLookupColumn({
        id: 'cl_lookup20000002',
        title: 'Lookup2',
        fk_model_id: 'model2',
        base_id: 'base2',
        fk_relation_column_id: 'cl_ltar2000000002',
        fk_lookup_column_id: 'cFormula_A_B1_15',
      });

      const table2Formula = createFormulaColumn({
        id: 'cFormula_B_B2_15', // 15 chars - Base2
        title: 'FormulaB',
        fk_model_id: 'model2',
        base_id: 'base2',
        formula: '{cl_lookup20000002}',
        referencedColIds: ['cl_lookup20000002'],
      });

      const table2Columns = [table2Formula, table2Lookup, table2LTAR];

      const mockGetMeta = jest.fn(async (_context, options) => {
        if (options.id === 'model2') {
          return {
            id: 'model2',
            title: 'Model2',
            base_id: 'base2',
            columns: table2Columns,
          };
        }
        return {
          id: 'model1',
          title: 'Model1',
          base_id: 'base1',
          columns: table1Columns,
        };
      });

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'Lookup1',
      } as any;

      await expect(
        checkForCircularFormulaRef(
          table1Formula,
          parsedTree,
          table1Columns,
          mockGetMeta
        )
      ).rejects.toHaveProperty('type', FormulaErrorType.CIRCULAR_REFERENCE);
    });

    it('should pass for cross-base lookup without cycle', async () => {
      // Base1.Table1.FormulaA → Lookup → Base2.Table2.TextColumn

      const table1LTAR = createLTARColumn({
        id: 'cl_ltar1000000001',
        title: 'CrossBaseRelation',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_related_model_id: 'model2',
        fk_related_base_id: 'base2',
        type: 'hm',
      });

      const table1Lookup = createLookupColumn({
        id: 'cl_lookup10000001',
        title: 'Lookup1',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_relation_column_id: 'cl_ltar1000000001',
        fk_lookup_column_id: 'cl_text000000001',
      });

      const table1Formula = createFormulaColumn({
        id: 'cFormula_A_Pass15', // 15 chars
        title: 'FormulaA',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_lookup10000001}',
        referencedColIds: ['cl_lookup10000001'],
      });

      const table1Columns = [table1Formula, table1Lookup, table1LTAR];

      // Base2 Table2 with just text column
      const table2TextCol = createTextColumn({
        id: 'cl_text000000001',
        title: 'TextColumn',
        fk_model_id: 'model2',
        base_id: 'base2',
      });

      const table2Columns = [table2TextCol];

      const mockGetMeta = jest.fn(async (_context, options) => {
        if (options.id === 'model2') {
          return {
            id: 'model2',
            title: 'Model2',
            base_id: 'base2',
            columns: table2Columns,
          };
        }
        return {
          id: 'model1',
          title: 'Model1',
          base_id: 'base1',
          columns: table1Columns,
        };
      });

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'Lookup1',
      } as any;

      await expect(
        checkForCircularFormulaRef(
          table1Formula,
          parsedTree,
          table1Columns,
          mockGetMeta
        )
      ).resolves.not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should gracefully handle missing relation column in lookup', async () => {
      // Lookup references a relation column ID that doesn't exist
      const lookup = createLookupColumn({
        id: 'cl_lookup00000001',
        title: 'Lookup',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_relation_column_id: 'cl_nonexistlta01',
        fk_lookup_column_id: 'cl_text000000001',
      });

      const formula = createFormulaColumn({
        id: 'cl_formula0000001',
        title: 'Formula',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_lookup00000001}',
        referencedColIds: ['cl_lookup00000001'],
      });

      const columns = [formula, lookup];

      const mockGetMeta = jest.fn(async () => ({
        id: 'model1',
        title: 'Model1',
        base_id: 'base1',
        columns,
      }));

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'Lookup',
      } as any;

      // Should not throw - gracefully handles missing reference
      await expect(
        checkForCircularFormulaRef(formula, parsedTree, columns, mockGetMeta)
      ).resolves.not.toThrow();
    });

    it('should gracefully handle LTAR with missing related table', async () => {
      const ltar = createLTARColumn({
        id: 'cl_ltar000000001',
        title: 'LTAR',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_related_model_id: 'nonexistent_model',
        type: 'hm',
      });

      const formula = createFormulaColumn({
        id: 'cl_formula0000001',
        title: 'Formula',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_ltar000000001}',
        referencedColIds: ['cl_ltar000000001'],
      });

      const columns = [formula, ltar];

      const mockGetMeta = jest.fn(async (_context, options) => {
        if (options.id === 'nonexistent_model') {
          return null; // Simulate missing table
        }
        return {
          id: 'model1',
          title: 'Model1',
          base_id: 'base1',
          columns,
        };
      });

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'LTAR',
      } as any;

      // Should handle gracefully or throw appropriate error (not crash)
      await expect(
        checkForCircularFormulaRef(formula, parsedTree, columns, mockGetMeta)
      ).resolves.not.toThrow();
    });

    it('should gracefully handle lookup target column not found', async () => {
      const ltar = createLTARColumn({
        id: 'cl_ltar000000001',
        title: 'LTAR',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_related_model_id: 'model2',
        type: 'hm',
      });

      const lookup = createLookupColumn({
        id: 'cl_lookup00000001',
        title: 'Lookup',
        fk_model_id: 'model1',
        base_id: 'base1',
        fk_relation_column_id: 'cl_ltar000000001',
        fk_lookup_column_id: 'cl_nonexistcol01', // This column doesn't exist in model2
      });

      const formula = createFormulaColumn({
        id: 'cl_formula0000001',
        title: 'Formula',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_lookup00000001}',
        referencedColIds: ['cl_lookup00000001'],
      });

      const table1Columns = [formula, lookup, ltar];

      const table2TextCol = createTextColumn({
        id: 'cl_text000000001',
        title: 'TextColumn',
        fk_model_id: 'model2',
        base_id: 'base1',
      });

      const table2Columns = [table2TextCol]; // Does not include 'cl_nonexistcol01'

      const mockGetMeta = jest.fn(async (_context, options) => {
        if (options.id === 'model2') {
          return {
            id: 'model2',
            title: 'Model2',
            base_id: 'base1',
            columns: table2Columns,
          };
        }
        return {
          id: 'model1',
          title: 'Model1',
          base_id: 'base1',
          columns: table1Columns,
        };
      });

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'Lookup',
      } as any;

      // Should not throw - gracefully handles when lookup target is not found
      await expect(
        checkForCircularFormulaRef(
          formula,
          parsedTree,
          table1Columns,
          mockGetMeta
        )
      ).resolves.not.toThrow();
    });

    it('should pass when formula has no dependencies', async () => {
      // Formula only references regular columns (no Formula/Lookup/LTAR)
      const textCol = createTextColumn({
        id: 'cl_text000000001',
        title: 'TextColumn',
        fk_model_id: 'model1',
        base_id: 'base1',
      });

      const formula = createFormulaColumn({
        id: 'cl_formula0000001',
        title: 'Formula',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_text000000001}',
        referencedColIds: ['cl_text000000001'],
      });

      const columns = [textCol, formula];

      const mockGetMeta = jest.fn(async () => ({
        id: 'model1',
        title: 'Model1',
        base_id: 'base1',
        columns,
      }));

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'TextColumn',
      } as any;

      await expect(
        checkForCircularFormulaRef(formula, parsedTree, columns, mockGetMeta)
      ).resolves.not.toThrow();
    });

    it('should pass for complex valid formula network without cycle', async () => {
      // Multiple formulas referencing each other in valid DAG structure
      // FormulaA → FormulaB → FormulaC (no cycle)
      const colFormulaC = createFormulaColumn({
        id: 'cl_formulac000001',
        title: 'FormulaC',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '1 + 1',
        referencedColIds: [],
      });

      const colFormulaB = createFormulaColumn({
        id: 'cl_formulab000001',
        title: 'FormulaB',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_formulac000001}',
        referencedColIds: ['cl_formulac000001'],
      });

      const colFormulaA = createFormulaColumn({
        id: 'cl_formulaa000001',
        title: 'FormulaA',
        fk_model_id: 'model1',
        base_id: 'base1',
        formula: '{cl_formulab000001}',
        referencedColIds: ['cl_formulab000001'],
      });

      const columns = [colFormulaA, colFormulaB, colFormulaC];

      const mockGetMeta = jest.fn(async () => ({
        id: 'model1',
        title: 'Model1',
        base_id: 'base1',
        columns,
      }));

      const parsedTree = {
        type: JSEPNode.IDENTIFIER,
        name: 'FormulaB',
      } as any;

      await expect(
        checkForCircularFormulaRef(
          colFormulaA,
          parsedTree,
          columns,
          mockGetMeta
        )
      ).resolves.not.toThrow();
    });
  });
});
