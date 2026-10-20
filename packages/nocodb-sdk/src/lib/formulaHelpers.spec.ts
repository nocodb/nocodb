import {
  FormulaDataTypes,
  substituteColumnAliasWithIdInFormula,
  substituteColumnIdWithAliasInFormula,
  validateFormulaAndExtractTreeWithType,
} from './formulaHelpers';
import { UnifiedMetaType } from './types';
import UITypes from './UITypes';
const base_id = 'pIJkwfxdDwd';

const getMeta: UnifiedMetaType.IGetModel = async (_context, _param) => ({
  base_id,
  columns: [],
  id: 'mWhcgaGWdKE',
  title: 'Table1',
});

describe('Formula parsing and type validation', () => {
  it('Simple formula', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: '1 + 2',
      columns: [],
      clientOrSqlUi: 'mysql2',
      getMeta,
    });

    expect(result.dataType).toEqual(FormulaDataTypes.NUMERIC);
  });

  it('Formula with IF condition', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula: 'IF({column}, "Found", BLANK())',
      columns: [
        {
          base_id,
          id: 'cid',
          title: 'column',
          uidt: UITypes.Number,
        },
      ],
      clientOrSqlUi: 'mysql2',
      getMeta,
    });

    expect(result.dataType).toEqual(FormulaDataTypes.STRING);
  });
  it('Complex formula', async () => {
    const result = await validateFormulaAndExtractTreeWithType({
      formula:
        'SWITCH({column2},"value1",IF({column1}, "Found", BLANK()),"value2", 2)',
      columns: [
        {
          base_id,
          id: 'id1',
          title: 'column1',
          uidt: UITypes.Number,
        },
        {
          base_id,
          id: 'id2',
          title: 'column2',
          uidt: UITypes.SingleLineText,
        },
      ],
      clientOrSqlUi: 'mysql2',
      getMeta,
    });
    expect(result.dataType).toEqual(FormulaDataTypes.STRING);

    const result1 = await validateFormulaAndExtractTreeWithType({
      formula: 'SWITCH({column2},"value1",IF({column1}, 1, 2),"value2", 2)',
      columns: [
        {
          base_id,
          id: 'id1',
          title: 'column1',
          uidt: UITypes.Number,
        },
        {
          base_id,
          id: 'id2',
          title: 'column2',
          uidt: UITypes.SingleLineText,
        },
      ],
      clientOrSqlUi: 'mysql2',
      getMeta,
    });

    expect(result1.dataType).toEqual(FormulaDataTypes.NUMERIC);
  });

  describe('Date and time interaction', () => {
    it('Time - time equals numeric', async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{Time1} - {Time2}',
        columns: [
          {
            base_id,
            id: 'TUrXeTf4JUHdnRvn',
            title: 'Time1',
            uidt: UITypes.Time,
          },
          {
            base_id,
            id: 'J3aD/yLDT2GF6NEB',
            title: 'Time2',
            uidt: UITypes.Time,
          },
        ],
        clientOrSqlUi: 'pg',
        getMeta,
      });
      expect(result.dataType).toEqual(FormulaDataTypes.NUMERIC);
    });
    it('Date + time equals date', async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{Date1} + {Time2}',
        columns: [
          {
            base_id,
            id: 'TUrXeTf4JUHdnRvn',
            title: 'Date1',
            uidt: UITypes.Date,
          },
          {
            base_id,
            id: 'J3aD/yLDT2GF6NEB',
            title: 'Time2',
            uidt: UITypes.Time,
          },
        ],
        clientOrSqlUi: 'pg',
        getMeta,
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
        getMeta,
      });
      expect(result.dataType).toBe(FormulaDataTypes.STRING);
    });
  });

  describe('errors', () => {
    it(`will provide position for syntax error`, async () => {
      await expect(
        validateFormulaAndExtractTreeWithType({
          formula: '1 +',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta,
          trackPosition: true,
        })
      ).rejects.toMatchObject({
        extra: {
          position: {
            column: 3,
            row: 0,
            length: 1,
          },
        },
      });
      await expect(
        validateFormulaAndExtractTreeWithType({
          formula: '(1 + 1',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta,
          trackPosition: true,
        })
      ).rejects.toMatchObject({
        extra: {
          position: {
            column: 6,
            row: 0,
            length: 1,
          },
        },
      });
      await expect(
        validateFormulaAndExtractTreeWithType({
          formula: 'CONCAT)',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta,
          trackPosition: true,
        })
      ).rejects.toMatchObject({
        extra: {
          position: {
            column: 6,
            row: 0,
            length: 1,
          },
        },
      });
    });
    it(`will provide position for column not found`, async () => {
      await expect(
        validateFormulaAndExtractTreeWithType({
          formula: '1 + __a_',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta,
          trackPosition: true,
        })
      ).rejects.toMatchObject({
        extra: {
          position: {
            column: 4,
            row: 0,
            length: 4,
          },
        },
      });
      await expect(
        validateFormulaAndExtractTreeWithType({
          formula: '__a_',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta,
          trackPosition: true,
        })
      ).rejects.toMatchObject({
        extra: {
          position: {
            column: 0,
            row: 0,
            length: 4,
          },
        },
      });
      await expect(
        validateFormulaAndExtractTreeWithType({
          formula: 'CONCAT(__a_  , "A")',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta,
          trackPosition: true,
        })
      ).rejects.toMatchObject({
        extra: {
          position: {
            column: 7,
            row: 0,
            length: 6,
          },
        },
      });
    });
    it(`will handle formula missing parentheses`, async () => {
      await expect(
        validateFormulaAndExtractTreeWithType({
          formula: 'CONCAT',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta,
          trackPosition: true,
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          'Missing parentheses after function name'
        ),
        extra: {
          position: {
            column: 6,
            row: 0,
            length: 1,
          },
        },
      });
      await expect(
        validateFormulaAndExtractTreeWithType({
          formula: 'CONCAT(CONCAT)',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta,
          trackPosition: true,
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          'Missing parentheses after function name'
        ),
        extra: {
          position: {
            column: 13,
            row: 0,
            length: 1,
          },
        },
      });
    });
    it(`will handle formula minimum argument`, async () => {
      await expect(
        validateFormulaAndExtractTreeWithType({
          formula: 'CONCAT(CONCAT())',
          columns: [],
          clientOrSqlUi: 'mysql2',
          getMeta,
          trackPosition: true,
        })
      ).rejects.toMatchObject({
        extra: {
          position: {
            column: 7,
            row: 0,
            length: 8,
          },
        },
      });
    });
  });

  describe('referenced info', () => {
    it(`will return referenced column when directly referenced`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{column1}',
        columns: [
          {
            base_id,
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Number,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta,
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
          // Cast partial mock column properly instead of double `as any`
          columns: [
            {
              base_id,
              id: 'id1',
              title: 'column1',
              uidt: supportedType as any,
            },
          ],
          clientOrSqlUi: 'mysql2',
          getMeta,
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
            base_id,
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Number,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta,
      });
      expect(result.referencedColumn).toBeUndefined();
      expect(result.uidtCandidates).toEqual([UITypes.Decimal]);
    });
    it(`will not return referenced column when multiple columns is used`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{column1} + {column2}',
        columns: [
          {
            base_id,
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Decimal,
          },
          {
            base_id,
            id: 'id2',
            title: 'column2',
            uidt: UITypes.Decimal,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta,
      });

      expect(result.referencedColumn).toBeUndefined();
      const result2 = await validateFormulaAndExtractTreeWithType({
        formula: '{column1} + ({column2} + {column3})',
        columns: [
          {
            base_id,
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Decimal,
          },
          {
            base_id,
            id: 'id2',
            title: 'column2',
            uidt: UITypes.Decimal,
          },
          {
            base_id,
            id: 'id3',
            title: 'column3',
            uidt: UITypes.Decimal,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta,
      });

      expect(result2.referencedColumn).toBeUndefined();
      const result3 = await validateFormulaAndExtractTreeWithType({
        formula: '{column1} + ({column2} + 1)',
        columns: [
          {
            base_id,
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Decimal,
          },
          {
            base_id,
            id: 'id2',
            title: 'column2',
            uidt: UITypes.Number,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta,
      });

      expect(result3.referencedColumn).toBeUndefined();
    });

    it(`will return referenced column with pure call expression`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: 'MAX({column1}, 3)',
        columns: [
          {
            base_id,
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Number,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta,
      });
      expect(result.referencedColumn.id).toEqual('id1');
      expect(result.referencedColumn.uidt).toEqual(UITypes.Number);
    });

    it(`will return referenced column with pure call expression for arrays`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: '{column1}',
        columns: [
          {
            base_id,
            id: 'id1',
            title: 'column1',
            uidt: UITypes.LinkToAnotherRecord,
            colOptions: <UnifiedMetaType.ILinkToAnotherRecordColumn>{
              fk_column_id: '',
              id: '',
              type: 'hm',
              getRelatedTable: async () => {
                return {
                  base_id,
                  columns: [
                    {
                      base_id,
                      id: 'col_lok1',
                      uidt: UITypes.SingleLineText,
                      title: 'LOK1',
                      pv: true,
                    },
                  ],
                  id: 'tbl1',
                  title: 'tbl1',
                };
              },
            },
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta,
      });
      expect(result.referencedColumn.id).toEqual('col_lok1');
      expect(result.referencedColumn.uidt).toEqual(UITypes.SingleLineText);

      const result1 = await validateFormulaAndExtractTreeWithType({
        formula: '{column1}',
        columns: [
          {
            base_id,
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Lookup,
            colOptions: <UnifiedMetaType.ILookupColumn>{
              fk_column_id: '',
              fk_relation_column_id: 'col_rel1',
              fk_lookup_column_id: 'col_lok1',
              getRelationColumn: async () => {
                return {
                  base_id,
                  fk_model_id: 'tbl1',
                  id: 'col_rel1',
                  uidt: UITypes.SingleLineText,
                  title: 'LOK1',
                  colOptions: <UnifiedMetaType.ILinkToAnotherRecordColumn>{
                    fk_column_id: '',
                    id: '',
                    type: 'hm',
                    getRelatedTable: async () => {
                      return {
                        base_id,
                        columns: [
                          {
                            base_id,
                            id: 'col_lok1',
                            uidt: UITypes.SingleLineText,
                            title: 'LOK1',
                            pv: true,
                          },
                        ],
                        id: 'tbl1',
                        title: 'tbl1',
                      };
                    },
                  },
                };
              },
              getLookupColumn: async () => {
                return {
                  base_id,
                  id: 'col_lok1',
                  uidt: UITypes.SingleLineText,
                  title: 'LOK1',
                };
              },
            },
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta,
      });
      expect(result1.referencedColumn.id).toEqual('col_lok1');
      expect(result1.referencedColumn.uidt).toEqual(UITypes.SingleLineText);
    });

    it(`will not return referenced column with impure call expression`, async () => {
      const result = await validateFormulaAndExtractTreeWithType({
        formula: 'CEILING({column1})',
        columns: [
          {
            base_id,
            id: 'id1',
            title: 'column1',
            uidt: UITypes.Number,
          },
        ],
        clientOrSqlUi: 'mysql2',
        getMeta,
      });
      expect(result.referencedColumn).toBeUndefined();
      expect(result.uidtCandidates).toEqual([UITypes.Decimal]);
    });
  });
});

describe('substituteColumnAliasWithIdInFormula', () => {
  const columns = [{ base_id, id: 'id1', title: 'N', uidt: UITypes.Number }];

  it('hints == once for a bare =', async () => {
    const error = await substituteColumnAliasWithIdInFormula(
      'IF({N} = 1, "a", "b")',
      columns
    ).catch((e) => e);
    expect(error.message.split('Use == for equality').length).toBe(2);
  });

  it('resolves a title before the column_name of a renamed field', async () => {
    const renamed = [
      {
        base_id,
        id: 'old',
        title: 'Submitted (old)',
        column_name: 'Submitted',
        uidt: UITypes.Date,
      },
      {
        base_id,
        id: 'new',
        title: 'Submitted',
        column_name: 'Submitted_1',
        uidt: UITypes.Date,
      },
    ];
    expect(
      await substituteColumnAliasWithIdInFormula('{Submitted}', renamed)
    ).toBe('{{new}}');
    expect(
      await substituteColumnAliasWithIdInFormula('{Submitted (old)}', renamed)
    ).toBe('{{old}}');
    expect(substituteColumnIdWithAliasInFormula('{Submitted}', renamed)).toBe(
      '{Submitted}'
    );
    expect(substituteColumnIdWithAliasInFormula('{Submitted_1}', renamed)).toBe(
      '{Submitted}'
    );
  });

  it('does not hint for other syntax errors', async () => {
    const error = await substituteColumnAliasWithIdInFormula(
      'IF({N} == 1, "a"',
      columns
    ).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).not.toContain('Use == for equality');
  });
});
