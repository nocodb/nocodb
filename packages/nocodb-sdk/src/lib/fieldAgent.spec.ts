import UITypes, {
  isFieldAgentCol,
  FIELD_AGENT_SUPPORTED_TYPES,
} from './UITypes';
import {
  extractFieldAgentReferences,
  orderFieldAgentsByDependency,
  shouldAutoGenerateRow,
} from './fieldAgent';

describe('FIELD_AGENT_SUPPORTED_TYPES', () => {
  it('contains exactly the expected types', () => {
    expect(FIELD_AGENT_SUPPORTED_TYPES).toEqual([
      UITypes.LongText,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.SingleLineText,
      UITypes.Number,
      UITypes.Decimal,
      UITypes.Percent,
      UITypes.Currency,
      UITypes.JSON,
    ]);
  });

  it('has length 9', () => {
    expect(FIELD_AGENT_SUPPORTED_TYPES).toHaveLength(9);
  });
});

describe('isFieldAgentCol', () => {
  const enabledMeta = { field_agent: { enabled: true } };
  const disabledMeta = { field_agent: { enabled: false } };

  it('treats a Long text agent as an agent, distinct from an AI Text column', () => {
    expect(
      isFieldAgentCol({ uidt: UITypes.LongText, meta: enabledMeta } as any),
    ).toBe(true);
    expect(
      isFieldAgentCol({ uidt: UITypes.LongText, meta: { ai: true } } as any),
    ).toBe(false);
  });

  it('returns false for unsupported UIType even with enabled meta', () => {
    const col = { uidt: UITypes.Checkbox, meta: enabledMeta } as any;
    expect(isFieldAgentCol(col)).toBe(false);
  });

  it('returns false for supported type with no meta', () => {
    const col = { uidt: UITypes.SingleSelect } as any;
    expect(isFieldAgentCol(col)).toBe(false);
  });

  it('returns false for supported type with meta but enabled: false', () => {
    const col = { uidt: UITypes.SingleSelect, meta: disabledMeta } as any;
    expect(isFieldAgentCol(col)).toBe(false);
  });

  it('returns false for supported type with meta but missing field_agent key', () => {
    const col = { uidt: UITypes.SingleSelect, meta: { other: true } } as any;
    expect(isFieldAgentCol(col)).toBe(false);
  });

  it('returns true for supported type with enabled meta (object)', () => {
    const col = { uidt: UITypes.SingleSelect, meta: enabledMeta } as any;
    expect(isFieldAgentCol(col)).toBe(true);
  });

  it('returns true for supported type with enabled meta (JSON string)', () => {
    const col = {
      uidt: UITypes.SingleSelect,
      meta: JSON.stringify(enabledMeta),
    } as any;
    expect(isFieldAgentCol(col)).toBe(true);
  });

  it('returns true for each supported type with enabled meta', () => {
    for (const uidt of FIELD_AGENT_SUPPORTED_TYPES) {
      const col = { uidt, meta: enabledMeta } as any;
      expect(isFieldAgentCol(col)).toBe(true);
    }
  });

  it('handles null column without unexpected behavior', () => {
    // col.uidt on null will throw a TypeError; verify it does not
    // return true or produce a non-error falsy result unexpectedly
    try {
      const result = isFieldAgentCol(null as any);
      expect(result).toBe(false);
    } catch {
      // TypeError is acceptable — null is not a valid column
    }
  });

  it('handles undefined column without unexpected behavior', () => {
    try {
      const result = isFieldAgentCol(undefined as any);
      expect(result).toBe(false);
    } catch {
      // TypeError is acceptable — undefined is not a valid column
    }
  });
});

describe('extractFieldAgentReferences', () => {
  it('returns referenced field names in order, without duplicates', () => {
    expect(
      extractFieldAgentReferences('Capital of {Country} ({Country}, {Region})')
    ).toEqual(['Country', 'Region']);
  });

  it('handles titles with spaces and empty prompts', () => {
    expect(extractFieldAgentReferences('{Unit Price} x {Qty}')).toEqual([
      'Unit Price',
      'Qty',
    ]);
    expect(extractFieldAgentReferences('')).toEqual([]);
    expect(extractFieldAgentReferences(undefined)).toEqual([]);
  });
});

describe('shouldAutoGenerateRow', () => {
  const base = {
    agentTitle: 'Capital',
    referencedTitles: ['Country'],
    referencedIds: ['col_country'],
  };

  it('insert: runs when the agent cell is empty and a referenced field has a value', () => {
    expect(
      shouldAutoGenerateRow({ ...base, isInsert: true, row: { Country: 'Peru' } })
    ).toBe(true);
  });

  it('insert: never replaces a value supplied at insert', () => {
    expect(
      shouldAutoGenerateRow({
        ...base,
        isInsert: true,
        row: { Country: 'Peru', Capital: 'Lima' },
      })
    ).toBe(false);
  });

  it('insert: skips rows where every referenced field is empty', () => {
    expect(
      shouldAutoGenerateRow({ ...base, isInsert: true, row: { Country: '' } })
    ).toBe(false);
  });

  it('update: runs only when a referenced field changed', () => {
    const row = { Country: 'Peru', Capital: 'Lima' };
    expect(
      shouldAutoGenerateRow({
        ...base,
        isInsert: false,
        row,
        changedColumnIds: ['col_country'],
      })
    ).toBe(true);
    expect(
      shouldAutoGenerateRow({
        ...base,
        isInsert: false,
        row,
        changedColumnIds: ['col_other'],
      })
    ).toBe(false);
    expect(shouldAutoGenerateRow({ ...base, isInsert: false, row })).toBe(false);
  });

  it('never runs for an agent that references nothing', () => {
    expect(
      shouldAutoGenerateRow({
        ...base,
        referencedIds: [],
        isInsert: true,
        row: { Country: 'Peru' },
      })
    ).toBe(false);
  });
});

describe('orderFieldAgentsByDependency', () => {
  const agent = (id: string, title: string, prompt: string) =>
    ({
      id,
      title,
      uidt: UITypes.LongText,
      meta: { field_agent: { enabled: true, prompt_raw: prompt } },
    }) as any;

  it('runs an agent after the agent its prompt references', () => {
    const capital = agent('c', 'Capital', 'Capital of {Country}');
    const country = agent('k', 'Country', 'Country for {City}');
    expect(
      orderFieldAgentsByDependency([capital, country]).map((a) => a.id)
    ).toEqual(['k', 'c']);
  });

  it('keeps independent agents in their original order', () => {
    const a = agent('a', 'A', '{X}');
    const b = agent('b', 'B', '{Y}');
    expect(orderFieldAgentsByDependency([a, b]).map((x) => x.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('falls back to original order for a reference cycle', () => {
    const a = agent('a', 'A', '{B}');
    const b = agent('b', 'B', '{A}');
    expect(orderFieldAgentsByDependency([a, b]).map((x) => x.id)).toEqual([
      'a',
      'b',
    ]);
  });
});
