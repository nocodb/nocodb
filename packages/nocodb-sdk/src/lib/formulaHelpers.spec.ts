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
  });

  describe('binary expression', () => {
    it(`& operator will return string`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '"Hello" & "World"',
        columns: [],
        clientOrSqlUi: 'pg',
        getMeta: async () => ({}),
      });
      expect(result.dataType).toBe(FormulaDataTypes.STRING);
    });
  });

  describe('errors', () => {
    it(`will provide position for syntax error`, async () => {
      try {
        await validateFormulaAndExtractTreeWithType({
          formula: '1 +',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta: async () => ({}),
          trackPosition: true,
        });
      } catch (ex) {
        expect(ex.extra.position).toEqual({
          column: 3,
          row: 0,
          length: 1,
        });
      }
      try {
        await validateFormulaAndExtractTreeWithType({
          formula: '(1 + 1',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta: async () => ({}),
          trackPosition: true,
        });
      } catch (ex) {
        expect(ex.extra.position).toEqual({
          column: 6,
          row: 0,
          length: 1,
        });
      }
      try {
        await validateFormulaAndExtractTreeWithType({
          formula: 'CONCAT)',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta: async () => ({}),
          trackPosition: true,
        });
      } catch (ex) {
        expect(ex.extra.position).toEqual({
          column: 6,
          row: 0,
          length: 1,
        });
      }
    });
    it(`will provide position for column not found`, async () => {
      try {
        await validateFormulaAndExtractTreeWithType({
          formula: '1 + __a_',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta: async () => ({}),
          trackPosition: true,
        });
      } catch (ex) {
        expect(ex.extra.position).toEqual({
          column: 4,
          row: 0,
          length: 4,
        });
      }
      try {
        await validateFormulaAndExtractTreeWithType({
          formula: '__a_',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta: async () => ({}),
          trackPosition: true,
        });
      } catch (ex) {
        expect(ex.extra.position).toEqual({
          column: 0,
          row: 0,
          length: 4,
        });
      }
      try {
        await validateFormulaAndExtractTreeWithType({
          formula: 'CONCAT(__a_  , "A")',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta: async () => ({}),
          trackPosition: true,
        });
      } catch (ex) {
        expect(ex.extra.position).toEqual({
          column: 7,
          row: 0,
          length: 6,
        });
      }
    });
    it(`will handle formula missing parentheses`, async () => {
      try {
        await validateFormulaAndExtractTreeWithType({
          formula: 'CONCAT',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta: async () => ({}),
          trackPosition: true,
        });
      } catch (ex) {
        expect(ex.message).toContain('Missing parentheses after function name');
        expect(ex.extra.position).toEqual({
          column: 6,
          row: 0,
          length: 1,
        });
      }
      try {
        await validateFormulaAndExtractTreeWithType({
          formula: 'CONCAT(CONCAT)',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta: async () => ({}),
          trackPosition: true,
        });
      } catch (ex) {
        expect(ex.message).toContain('Missing parentheses after function name');
        expect(ex.extra.position).toEqual({
          column: 13,
          row: 0,
          length: 1,
        });
      }
    });
    it(`will handle formula minimum argument`, async () => {
      try {
        await validateFormulaAndExtractTreeWithType({
          formula: 'CONCAT(CONCAT())',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta: async () => ({}),
          trackPosition: true,
        });
      } catch (ex) {
        expect(ex.extra.position).toEqual({
          column: 7,
          row: 0,
          length: 8,
        });
      }
    });
  });

  describe('referenced info', () => {
    it(`will return referenced column when directly referenced`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{column1}',
        columns: [
          {
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Number,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta: async () => ({}),
      });

      expect(result.referencedColumn.id).toEqual('id1');
      expect(result.referencedColumn.uidt).toEqual(UITypes.Number);
    });
    it(`will return referenced column with binary operation`, async () => {
      const supportedTypes = [
        UITypes.Decimal,
        UITypes.Currency,
        UITypes.Percent,
        UITypes.SingleLineText,
        UITypes.LongText,
      ];
      for (const supportedType of supportedTypes) {
        const result = await validateFormulaAndExtractTreeWithType({
          formula: '{column1} + 3',
          columns: [
            {
              id: 'id1',
              title: 'column1',
              uidt: supportedType,
            },
          ],
          clientOrSqlUi: 'mysql2',
          getMeta: async () => ({}),
        });
        expect(result.referencedColumn.id).toEqual('id1');
        expect(result.referencedColumn.uidt).toEqual(supportedType);
      }
    });
    it(`will not return referenced column with impure binary operation`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{column1} + 3',
        columns: [
          {
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Number,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta: async () => ({}),
      });
      expect(result.referencedColumn).toBeUndefined();
      expect(result.uidtCandidates).toEqual([UITypes.Decimal]);
    });
    it(`will not return referenced column when multiple columns is used`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{column1} + {column2}',
        columns: [
          {
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Decimal,
          },
          {
            id: 'id2',
            title: 'column2',
            uidt: UITypes.Decimal,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta: async () => ({}),
      });

      expect(result.referencedColumn).toBeUndefined();
      const result2 = await validateFormulaAndExtractTreeWithType({
        formula: '{column1} + ({column2} + {column3})',
        columns: [
          {
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Decimal,
          },
          {
            id: 'id2',
            title: 'column2',
            uidt: UITypes.Decimal,
          },
          {
            id: 'id3',
            title: 'column3',
            uidt: UITypes.Decimal,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta: async () => ({}),
      });

      expect(result2.referencedColumn).toBeUndefined();
      const result3 = await validateFormulaAndExtractTreeWithType({
        formula: '{column1} + ({column2} + 1)',
        columns: [
          {
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Decimal,
          },
          {
            id: 'id2',
            title: 'column2',
            uidt: UITypes.Number,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta: async () => ({}),
      });

      expect(result3.referencedColumn).toBeUndefined();
    });

    it(`will return referenced column with pure call expression`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: 'MAX({column1}, 3)',
        columns: [
          {
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Number,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta: async () => ({}),
      });
      expect(result.referencedColumn.id).toEqual('id1');
      expect(result.referencedColumn.uidt).toEqual(UITypes.Number);
    });

    it(`will return referenced column with pure call expression for arrays`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{column1}',
        columns: [
          {
            id: 'id1',
            title: 'column1',
            uidt: UITypes.LinkToAnotherRecord,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta: async () => ({}),
      });
      expect(result.referencedColumn.id).toEqual('id1');
      expect(result.referencedColumn.uidt).toEqual(UITypes.LinkToAnotherRecord);

      const result1 = await validateFormulaAndExtractTreeWithType({
        formula: '{column1}',
        columns: [
          {
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Lookup,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta: async () => ({}),
      });
      expect(result1.referencedColumn.id).toEqual('id1');
      expect(result1.referencedColumn.uidt).toEqual(UITypes.Lookup);
    });

    it(`will not return referenced column with impure call expression`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: 'CEILING({column1})',
        columns: [
          {
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Number,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta: async () => ({}),
      });
      expect(result.referencedColumn).toBeUndefined();
      expect(result.uidtCandidates).toEqual([UITypes.Decimal]);
    });
  });
});
