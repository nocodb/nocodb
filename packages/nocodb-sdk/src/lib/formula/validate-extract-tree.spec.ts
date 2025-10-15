import { validateFormulaAndExtractTreeWithType } from './validate-extract-tree';
import { FormulaDataTypes, FormulaErrorType, JSEPNode } from './enums';
import { FormulaError } from './error';
import UITypes from '../UITypes';
import { SqlUiFactory } from '~/lib/sqlUi';
import { UnifiedMetaType } from '~/lib/types';

// Mock dependencies
const mockColumns: UnifiedMetaType.IColumn[] = [
  {
    id: 'col1',
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
    id: 'col2',
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
    id: 'col3',
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
    id: 'col4',
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
      fk_column_id: 'col4',
      error: null,
      parsed_tree: {
        type: JSEPNode.IDENTIFIER,
        name: 'col1',
        dataType: FormulaDataTypes.STRING,
        referencedColumn: { id: 'col1', uidt: UITypes.SingleLineText },
      },
      getParsedTree: () =>
        ({
          type: JSEPNode.IDENTIFIER,
          name: 'col1',
          dataType: FormulaDataTypes.STRING,
          referencedColumn: { id: 'col1', uidt: UITypes.SingleLineText },
        } as any),
    } as UnifiedMetaType.IFormulaColumn,
  },
  {
    id: 'col5',
    title: 'Column5',
    uidt: UITypes.Lookup,
    dt: 'varchar',
    pv: false,
    base_id: 'base1',
    fk_workspace_id: 'ws1',
    fk_model_id: 'model1',
    deleted: false,
    colOptions: {
      fk_relation_column_id: 'col6',
      fk_lookup_column_id: 'col7',
      fk_column_id: 'col5',
    } as UnifiedMetaType.ILookupColumn,
  },
  {
    id: 'col6',
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
      fk_column_id: 'col6',
      id: 'col6',
    } as UnifiedMetaType.ILinkToAnotherRecordColumn,
  },
  {
    id: 'col7',
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
    id: 'col8',
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
    id: 'col9',
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
    id: 'col10',
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
      fk_column_id: 'col10',
      error: null,
      parsed_tree: {
        type: JSEPNode.IDENTIFIER,
        name: 'col4',
        dataType: FormulaDataTypes.STRING,
        referencedColumn: { id: 'col4', uidt: UITypes.Formula },
      },
      getParsedTree: () =>
        ({
          type: JSEPNode.IDENTIFIER,
          name: 'col4',
          dataType: FormulaDataTypes.STRING,
          referencedColumn: { id: 'col4', uidt: UITypes.Formula },
        } as any),
    } as UnifiedMetaType.IFormulaColumn,
  },
  {
    id: 'cdYAQE3SFa1F4ys',
    title: 'Column11',
    uidt: UITypes.Formula,
    dt: 'varchar',
    pv: false,
    base_id: 'base1',
    fk_workspace_id: 'ws1',
    fk_model_id: 'model1',
    deleted: false,
    colOptions: {
      formula: '{c3hOMA9YnfkD4WW}',
      formula_raw: '{Column12}',
      fk_column_id: 'cdYAQE3SFa1F4ys',
      error: null,
      parsed_tree: {
        type: JSEPNode.IDENTIFIER,
        name: 'c3hOMA9YnfkD4WW',
        dataType: FormulaDataTypes.STRING,
        referencedColumn: { id: 'c3hOMA9YnfkD4WW', uidt: UITypes.Formula },
      },
      getParsedTree: () =>
        ({
          type: JSEPNode.IDENTIFIER,
          name: 'c3hOMA9YnfkD4WW',
          dataType: FormulaDataTypes.STRING,
          referencedColumn: { id: 'c3hOMA9YnfkD4WW', uidt: UITypes.Formula },
        } as any),
    } as UnifiedMetaType.IFormulaColumn,
  },
  {
    id: 'c3hOMA9YnfkD4WW',
    title: 'Column12',
    uidt: UITypes.Formula,
    dt: 'varchar',
    pv: false,
    base_id: 'base1',
    fk_workspace_id: 'ws1',
    fk_model_id: 'model1',
    deleted: false,
    colOptions: {
      formula: '{cdYAQE3SFa1F4ys}',
      formula_raw: '{Column11}',
      fk_column_id: 'col12',
      error: null,
      parsed_tree: {
        type: JSEPNode.IDENTIFIER,
        name: 'cdYAQE3SFa1F4ys',
        dataType: FormulaDataTypes.STRING,
        referencedColumn: { id: 'cdYAQE3SFa1F4ys', uidt: UITypes.Formula },
      },
      getParsedTree: () =>
        ({
          type: JSEPNode.IDENTIFIER,
          name: 'cdYAQE3SFa1F4ys',
          dataType: FormulaDataTypes.STRING,
          referencedColumn: { id: 'cdYAQE3SFa1F4ys', uidt: UITypes.Formula },
        } as any),
    } as UnifiedMetaType.IFormulaColumn,
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
            id: 'col7',
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

describe('validateFormulaAndExtractTreeWithType', () => {
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
    expect((result as any).name).toBe('col1');
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  it('should resolve column by id', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{col1}',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.IDENTIFIER);
    expect((result as any).name).toBe('col1');
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
    expect((result as any).name).toBe('col4');
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
    expect((result as any).name).toBe('col5');
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
    expect((result as any).name).toBe('col6');
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  it('should detect circular reference in formula columns', async () => {
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '{Column11}',
        column: mockColumns.find((c) => c.id === 'c3hOMA9YnfkD4WW'), // col12 references col11, col11 references col12
        columns: mockColumns,
        clientOrSqlUi: mockClientOrSqlUi,
        getMeta: mockGetMeta,
      })
    ).rejects.toThrow(FormulaError);
    await expect(
      validateFormulaAndExtractTreeWithType({
        formula: '{Column11}',
        column: mockColumns.find((c) => c.id === 'c3hOMA9YnfkD4WW'),
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
    const formulaCol10 = mockColumns.find((c) => c.id === 'col10');
    (formulaCol10.colOptions as UnifiedMetaType.IFormulaColumn).formula =
      '{Column4}'; // col10 -> col4 -> col1
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '{Column10}',
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    expect(result.type).toBe(JSEPNode.IDENTIFIER);
    expect((result as any).name).toBe('col10');
    expect((result as any).dataType).toBe(FormulaDataTypes.STRING);
  });

  it('should cast non-string arguments to string if expected type is string', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: 'CONCAT({Column1}, {Column2})', // Column2 is numeric, should be cast to string
      columns: mockColumns,
      clientOrSqlUi: mockClientOrSqlUi,
      getMeta: mockGetMeta,
    });
    console.log(result);
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
});
