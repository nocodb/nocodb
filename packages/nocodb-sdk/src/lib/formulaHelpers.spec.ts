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

  describe('Date and time interaction', () => {
    it('Time - time equals numeric', async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{Time1} - {Time2}',
        columns: [
          {
            id: 'TUrXeTf4JUHdnRvn',
            title: 'Time1',
            uidt: UITypes.Time,
          },
          {
            id: 'J3aD/yLDT2GF6NEB',
            title: 'Time2',
            uidt: UITypes.Time,
          },
        ],
        clientOrSqlUi: 'pg',
        getMeta: async () => ({}),
      });
      expect(result.dataType).toEqual(FormulaDataTypes.NUMERIC);
    });
    it('Time - time equals numeric', async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{Time1} - {Time2}',
        columns: [
          {
            id: 'TUrXeTf4JUHdnRvn',
            title: 'Time1',
            uidt: UITypes.Time,
          },
          {
            id: 'J3aD/yLDT2GF6NEB',
            title: 'Time2',
            uidt: UITypes.Time,
          },
        ],
        clientOrSqlUi: 'pg',
        getMeta: async () => ({}),
      });
      expect(result.dataType).toEqual(FormulaDataTypes.NUMERIC);
    });
    it('Date + time equals date', async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{Date1} + {Time2}',
        columns: [
          {
            id: 'TUrXeTf4JUHdnRvn',
            title: 'Date1',
            uidt: UITypes.Date,
          },
          {
            id: 'J3aD/yLDT2GF6NEB',
            title: 'Time2',
            uidt: UITypes.Time,
          },
        ],
        clientOrSqlUi: 'pg',
        getMeta: async () => ({}),
      });
      expect(result.dataType).toEqual(FormulaDataTypes.DATE);
    });
  })
});
