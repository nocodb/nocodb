import {
  FormulaDataTypes,
  validateFormulaAndExtractTreeWithType,
} from './formulaHelpers';
import UITypes from './UITypes';

describe('Formula parsing and type validation', () => {
  it('Simple formula', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '1 + 2',
      columns: [],
      clientOrSqlUi: 'mysql2',
      getMeta: async () => ({}),
    });

    expect(result.dataType).toEqual(FormulaDataTypes.NUMERIC);
  });

  it('Formula with IF condition', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: 'IF({column}, "Found", BLANK())',
      columns: [
        {
          id: 'cid',
          title: 'column',
          uidt: UITypes.Number,
        },
      ],
      clientOrSqlUi: 'mysql2',
      getMeta: async () => ({}),
    });

    expect(result.dataType).toEqual(FormulaDataTypes.STRING);
  });
  it('Complex formula', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula:
        'SWITCH({column2},"value1",IF({column1}, "Found", BLANK()),"value2", 2)',
      columns: [
        {
          id: 'id1',
          title: 'column1',
          uidt: UITypes.Number,
        },
        {
          id: 'id2',
          title: 'column2',
          uidt: UITypes.SingleLineText,
        },
      ],
      clientOrSqlUi: 'mysql2',
      getMeta: async () => ({}),
    });

    expect(result.dataType).toEqual(FormulaDataTypes.STRING);

    const result1 = await validateFormulaAndExtractTreeWithType({
      formula: 'SWITCH({column2},"value1",IF({column1}, 1, 2),"value2", 2)',
      columns: [
        {
          id: 'id1',
          title: 'column1',
          uidt: UITypes.Number,
        },
        {
          id: 'id2',
          title: 'column2',
          uidt: UITypes.SingleLineText,
        },
      ],
      clientOrSqlUi: 'mysql2',
      getMeta: async () => ({}),
    });

    expect(result1.dataType).toEqual(FormulaDataTypes.NUMERIC);
  });
});
