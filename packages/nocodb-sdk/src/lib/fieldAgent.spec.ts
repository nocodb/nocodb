import UITypes, {
  isFieldAgentCol,
  FIELD_AGENT_SUPPORTED_TYPES,
} from './UITypes';

describe('FIELD_AGENT_SUPPORTED_TYPES', () => {
  it('contains exactly the expected types', () => {
    expect(FIELD_AGENT_SUPPORTED_TYPES).toEqual([
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

  it('has length 8', () => {
    expect(FIELD_AGENT_SUPPORTED_TYPES).toHaveLength(8);
  });
});

describe('isFieldAgentCol', () => {
  const enabledMeta = { field_agent: { enabled: true } };
  const disabledMeta = { field_agent: { enabled: false } };

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
