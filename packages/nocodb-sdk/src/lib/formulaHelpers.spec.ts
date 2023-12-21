import {
  FormulaDataTypes,
  validateFormulaAndExtractTreeWithType,
} from './formulaHelpers';
import UITypes from './UITypes';

describe('Formula parsing and type validation', () => {
  it('Simple formula', async () => {
    const result = validateFormulaAndExtractTreeWithType('1 + 2', []);

    expect(result.dataType).toEqual(FormulaDataTypes.NUMERIC);
  });

  it('Formula with IF condition', async () => {
    const result = validateFormulaAndExtractTreeWithType(
      'IF({column}, "Found", BLANK())',
      [
        {
          id: 'cid',
          title: 'column',
          uidt: UITypes.Number,
        },
      ]
    );

    expect(result.dataType).toEqual(FormulaDataTypes.STRING);
  });
  it('Complex formula', async () => {
    const result = validateFormulaAndExtractTreeWithType(
      'SWITCH({column2},"value1",IF({column1}, "Found", BLANK()),"value2", 2)',
      [
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
      ]
    );

    expect(result.dataType).toEqual(FormulaDataTypes.STRING);

    const result1 = validateFormulaAndExtractTreeWithType(
      'SWITCH({column2},"value1",IF({column1}, 1, 2),"value2", 2)',
      [
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
      ]
    );

    expect(result1.dataType).toEqual(FormulaDataTypes.NUMERIC);
  });
});
