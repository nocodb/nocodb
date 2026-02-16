import { describe, it, expect } from 'vitest';
import { IfNode } from '../src/nodes/if';

// Enum shortcuts
const Op = {
  EQ: 'eq' as const,
  NEQ: 'neq' as const,
  LIKE: 'like' as const,
  NLIKE: 'nlike' as const,
  GT: 'gt' as const,
  LT: 'lt' as const,
  GTE: 'gte' as const,
  LTE: 'lte' as const,
  BLANK: 'blank' as const,
  NOT_BLANK: 'notblank' as const,
  CHECKED: 'checked' as const,
  NOT_CHECKED: 'notchecked' as const,
  ALL_OF: 'allof' as const,
  ANY_OF: 'anyof' as const,
  NOT_ALL_OF: 'nallof' as const,
  NOT_ANY_OF: 'nanyof' as const,
  IS_WITHIN: 'isWithin' as const,
  // Deprecated (backward compatibility)
  EMPTY: 'empty' as const,
  NOT_EMPTY: 'notempty' as const,
  NULL: 'null' as const,
  NOT_NULL: 'notnull' as const,
};

const DataType = {
  TEXT: 'text' as const,
  NUMBER: 'number' as const,
  DATE: 'date' as const,
  DATETIME: 'datetime' as const,
  BOOLEAN: 'boolean' as const,
  SELECT: 'select' as const,
  MULTI_SELECT: 'multiSelect' as const,
  JSON: 'json' as const,
};

function createIfNode(conditions: any[] = []): IfNode {
  return new IfNode(
    { conditions, _nocodb: {} } as any,
    { logger: () => {} },
  );
}

function createRunContext(conditions: any[]): any {
  return {
    inputs: { config: { conditions } },
    nodeId: 'test-node',
    executionId: 'test-exec',
  };
}

// ----- Validation Tests -----

describe('IfNode.validate', () => {
  it('should fail with no conditions', async () => {
    const node = createIfNode([]);
    const result = await node.validate({ conditions: [] } as any);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('At least one condition');
  });

  it('should fail when field is missing', async () => {
    const node = createIfNode();
    const result = await node.validate({
      conditions: [{ field: '', comparison_op: Op.EQ, value: 'x' }],
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: any) => e.message === 'Field is required')).toBe(true);
  });

  it('should fail when comparison_op is missing', async () => {
    const node = createIfNode();
    const result = await node.validate({
      conditions: [{ field: 'name', comparison_op: '', value: 'x' }],
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: any) => e.message === 'Comparison operation is required')).toBe(true);
  });

  it('should fail when value is missing for ops that require it', async () => {
    const node = createIfNode();
    const result = await node.validate({
      conditions: [{ field: 'name', comparison_op: Op.EQ }],
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: any) => e.message === 'Value is required for this operation')).toBe(true);
  });

  it('should pass when value is missing for blank/not_blank (no value needed)', async () => {
    const node = createIfNode();
    const blankResult = await node.validate({
      conditions: [{ field: 'name', comparison_op: Op.BLANK }],
    } as any);
    expect(blankResult.valid).toBe(true);

    const notBlankResult = await node.validate({
      conditions: [{ field: 'name', comparison_op: Op.NOT_BLANK }],
    } as any);
    expect(notBlankResult.valid).toBe(true);
  });

  it('should pass when value is missing for checked/not_checked (no value needed)', async () => {
    const node = createIfNode();
    const result = await node.validate({
      conditions: [{ field: 'active', comparison_op: Op.CHECKED }],
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should validate nested groups', async () => {
    const node = createIfNode();
    const result = await node.validate({
      conditions: [
        {
          is_group: true,
          logical_op: 'and',
          children: [],
        },
      ],
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Group must have at least one child');
  });

  it('should pass for a valid condition', async () => {
    const node = createIfNode();
    const result = await node.validate({
      conditions: [{ field: 'name', comparison_op: Op.EQ, value: 'hello' }],
    } as any);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ----- Run / Evaluation Tests -----

describe('IfNode.run - Text conditions', () => {
  it('EQ: should match equal strings', async () => {
    const conditions = [{ field: 'hello', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'hello' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.status).toBe('success');
    expect(result.outputs.result).toBe(true);
    expect(result.outputs.port).toBe('true');
  });

  it('EQ: should not match different strings', async () => {
    const conditions = [{ field: 'hello', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'world' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(false);
    expect(result.outputs.port).toBe('false');
  });

  it('NEQ: should detect inequality', async () => {
    const conditions = [{ field: 'hello', dataType: DataType.TEXT, comparison_op: Op.NEQ, value: 'world' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('LIKE: should match substring (case-insensitive)', async () => {
    const conditions = [{ field: 'Hello World', dataType: DataType.TEXT, comparison_op: Op.LIKE, value: 'hello' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NLIKE: should not match missing substring', async () => {
    const conditions = [{ field: 'Hello World', dataType: DataType.TEXT, comparison_op: Op.NLIKE, value: 'foo' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('BLANK: should be true for empty string', async () => {
    const conditions = [{ field: '', dataType: DataType.TEXT, comparison_op: Op.BLANK }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('BLANK: should be true for whitespace-only string', async () => {
    const conditions = [{ field: '   ', dataType: DataType.TEXT, comparison_op: Op.BLANK }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('BLANK: should be false for non-empty string', async () => {
    const conditions = [{ field: 'hello', dataType: DataType.TEXT, comparison_op: Op.BLANK }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(false);
  });

  it('NOT_BLANK: should be true for non-empty string', async () => {
    const conditions = [{ field: 'hello', dataType: DataType.TEXT, comparison_op: Op.NOT_BLANK }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_BLANK: should be false for empty string', async () => {
    const conditions = [{ field: '', dataType: DataType.TEXT, comparison_op: Op.NOT_BLANK }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(false);
  });
});

describe('IfNode.run - Number conditions', () => {
  it('EQ: should match equal numbers', async () => {
    const conditions = [{ field: 42, dataType: DataType.NUMBER, comparison_op: Op.EQ, value: 42 }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('GT: should detect greater than', async () => {
    const conditions = [{ field: 10, dataType: DataType.NUMBER, comparison_op: Op.GT, value: 5 }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('LT: should detect less than', async () => {
    const conditions = [{ field: 3, dataType: DataType.NUMBER, comparison_op: Op.LT, value: 5 }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('GTE: should detect greater than or equal', async () => {
    const conditions = [{ field: 5, dataType: DataType.NUMBER, comparison_op: Op.GTE, value: 5 }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('LTE: should detect less than or equal', async () => {
    const conditions = [{ field: 5, dataType: DataType.NUMBER, comparison_op: Op.LTE, value: 5 }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('BLANK: should be true for NaN field', async () => {
    const conditions = [{ field: 'abc', dataType: DataType.NUMBER, comparison_op: Op.BLANK }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_BLANK: should be true for valid number', async () => {
    const conditions = [{ field: 42, dataType: DataType.NUMBER, comparison_op: Op.NOT_BLANK }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });
});

describe('IfNode.run - Boolean conditions', () => {
  it('CHECKED: should be true for truthy value', async () => {
    const conditions = [{ field: true, dataType: DataType.BOOLEAN, comparison_op: Op.CHECKED }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_CHECKED: should be true for falsy value', async () => {
    const conditions = [{ field: false, dataType: DataType.BOOLEAN, comparison_op: Op.NOT_CHECKED }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('CHECKED: should be false for falsy value', async () => {
    const conditions = [{ field: false, dataType: DataType.BOOLEAN, comparison_op: Op.CHECKED }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(false);
  });
});

describe('IfNode.run - Select conditions', () => {
  it('EQ: should match single select value', async () => {
    const conditions = [{ field: 'option1', dataType: DataType.SELECT, comparison_op: Op.EQ, value: 'option1' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('ANY_OF: should match if field contains any comparison value', async () => {
    const conditions = [{ field: ['a', 'b', 'c'], dataType: DataType.MULTI_SELECT, comparison_op: Op.ANY_OF, value: ['b', 'x'] }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('ALL_OF: should match if field contains all comparison values', async () => {
    const conditions = [{ field: ['a', 'b', 'c'], dataType: DataType.MULTI_SELECT, comparison_op: Op.ALL_OF, value: ['a', 'b'] }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_ANY_OF: should be true when no overlap', async () => {
    const conditions = [{ field: ['a', 'b'], dataType: DataType.MULTI_SELECT, comparison_op: Op.NOT_ANY_OF, value: ['x', 'y'] }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });
});

describe('IfNode.run - JSON conditions', () => {
  it('EQ: should match equal JSON objects', async () => {
    const conditions = [{ field: '{"a":1}', dataType: DataType.JSON, comparison_op: Op.EQ, value: '{"a":1}' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NEQ: should detect different JSON objects', async () => {
    const conditions = [{ field: '{"a":1}', dataType: DataType.JSON, comparison_op: Op.NEQ, value: '{"a":2}' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });
});

describe('IfNode.run - Date conditions', () => {
  it('EQ: should match same day', async () => {
    const today = new Date().toISOString().split('T')[0];
    const conditions = [{ field: today, dataType: DataType.DATE, comparison_op: Op.EQ, value: today }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('GT: should detect date after', async () => {
    const conditions = [{ field: '2025-06-01', dataType: DataType.DATE, comparison_op: Op.GT, value: '2025-01-01' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('BLANK: should be true for invalid date', async () => {
    const conditions = [{ field: 'not-a-date', dataType: DataType.DATE, comparison_op: Op.BLANK }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });
});

describe('IfNode.run - Logical operators (AND/OR groups)', () => {
  it('AND group: all must be true', async () => {
    const conditions = [
      {
        is_group: true,
        logical_op: 'and',
        children: [
          { field: 'hello', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'hello' },
          { field: 'world', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'world' },
        ],
      },
    ];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('AND group: fails if one is false', async () => {
    const conditions = [
      {
        is_group: true,
        logical_op: 'and',
        children: [
          { field: 'hello', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'hello' },
          { field: 'world', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'nope' },
        ],
      },
    ];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(false);
  });

  it('OR group: passes if one is true', async () => {
    const conditions = [
      {
        is_group: true,
        logical_op: 'or',
        children: [
          { field: 'hello', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'nope' },
          { field: 'world', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'world' },
        ],
      },
    ];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('multiple top-level conditions use AND logic', async () => {
    const conditions = [
      { field: 'hello', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'hello' },
      { field: 'world', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'nope' },
    ];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(false);
  });
});

describe('IfNode.run - Date conditions (sub-ops)', () => {
  it('EQ with EXACT_DATE sub-op', async () => {
    const conditions = [{
      field: '2025-06-15',
      dataType: DataType.DATE,
      comparison_op: Op.EQ,
      comparison_sub_op: 'exactDate',
      value: '2025-06-15',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NEQ: should detect different dates', async () => {
    const conditions = [{
      field: '2025-06-15',
      dataType: DataType.DATE,
      comparison_op: Op.NEQ,
      value: '2025-07-01',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('LT: should detect date before', async () => {
    const conditions = [{
      field: '2025-01-01',
      dataType: DataType.DATE,
      comparison_op: Op.LT,
      value: '2025-06-01',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('GTE: should match same date', async () => {
    const conditions = [{
      field: '2025-06-15',
      dataType: DataType.DATE,
      comparison_op: Op.GTE,
      value: '2025-06-15',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('LTE: should match same date', async () => {
    const conditions = [{
      field: '2025-06-15',
      dataType: DataType.DATE,
      comparison_op: Op.LTE,
      value: '2025-06-15',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('EQ with TODAY sub-op', async () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const conditions = [{
      field: todayStr,
      dataType: DataType.DATE,
      comparison_op: Op.EQ,
      comparison_sub_op: 'today',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('EQ with TOMORROW sub-op', async () => {
    const tomorrow = new Date(Date.now() + 86400000);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    const conditions = [{
      field: tomorrowStr,
      dataType: DataType.DATE,
      comparison_op: Op.EQ,
      comparison_sub_op: 'tomorrow',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('EQ with YESTERDAY sub-op', async () => {
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const conditions = [{
      field: yesterdayStr,
      dataType: DataType.DATE,
      comparison_op: Op.EQ,
      comparison_sub_op: 'yesterday',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('GT with ONE_WEEK_FROM_NOW sub-op', async () => {
    const farFuture = '2099-01-01';
    const conditions = [{
      field: farFuture,
      dataType: DataType.DATE,
      comparison_op: Op.GT,
      comparison_sub_op: 'oneWeekFromNow',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('LT with ONE_WEEK_AGO sub-op', async () => {
    const farPast = '2000-01-01';
    const conditions = [{
      field: farPast,
      dataType: DataType.DATE,
      comparison_op: Op.LT,
      comparison_sub_op: 'oneWeekAgo',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('GT with ONE_MONTH_FROM_NOW sub-op', async () => {
    const conditions = [{
      field: '2099-01-01',
      dataType: DataType.DATE,
      comparison_op: Op.GT,
      comparison_sub_op: 'oneMonthFromNow',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('LT with ONE_MONTH_AGO sub-op', async () => {
    const conditions = [{
      field: '2000-01-01',
      dataType: DataType.DATE,
      comparison_op: Op.LT,
      comparison_sub_op: 'oneMonthAgo',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('GT with DAYS_FROM_NOW sub-op', async () => {
    const conditions = [{
      field: '2099-01-01',
      dataType: DataType.DATE,
      comparison_op: Op.GT,
      comparison_sub_op: 'daysFromNow',
      value: '30',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('LT with DAYS_AGO sub-op', async () => {
    const conditions = [{
      field: '2000-01-01',
      dataType: DataType.DATE,
      comparison_op: Op.LT,
      comparison_sub_op: 'daysAgo',
      value: '30',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_BLANK: should be true for valid date', async () => {
    const conditions = [{
      field: '2025-06-15',
      dataType: DataType.DATE,
      comparison_op: Op.NOT_BLANK,
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_BLANK: should be false for invalid date', async () => {
    const conditions = [{
      field: 'invalid',
      dataType: DataType.DATE,
      comparison_op: Op.NOT_BLANK,
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(false);
  });
});

describe('IfNode.run - Date IS_WITHIN conditions', () => {
  it('IS_WITHIN PAST_WEEK: recent date should match', async () => {
    const recent = new Date(Date.now() - 2 * 86400000).toISOString(); // 2 days ago
    const conditions = [{
      field: recent,
      dataType: DataType.DATETIME,
      comparison_op: Op.IS_WITHIN,
      comparison_sub_op: 'pastWeek',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('IS_WITHIN PAST_WEEK: old date should not match', async () => {
    const conditions = [{
      field: '2020-01-01T00:00:00Z',
      dataType: DataType.DATETIME,
      comparison_op: Op.IS_WITHIN,
      comparison_sub_op: 'pastWeek',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(false);
  });

  it('IS_WITHIN PAST_MONTH: recent date should match', async () => {
    const recent = new Date(Date.now() - 10 * 86400000).toISOString(); // 10 days ago
    const conditions = [{
      field: recent,
      dataType: DataType.DATETIME,
      comparison_op: Op.IS_WITHIN,
      comparison_sub_op: 'pastMonth',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('IS_WITHIN PAST_YEAR: date from 6 months ago should match', async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const conditions = [{
      field: sixMonthsAgo.toISOString(),
      dataType: DataType.DATETIME,
      comparison_op: Op.IS_WITHIN,
      comparison_sub_op: 'pastYear',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('IS_WITHIN NEXT_WEEK: near future should match', async () => {
    const soon = new Date(Date.now() + 2 * 86400000).toISOString(); // 2 days from now
    const conditions = [{
      field: soon,
      dataType: DataType.DATETIME,
      comparison_op: Op.IS_WITHIN,
      comparison_sub_op: 'nextWeek',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('IS_WITHIN NEXT_MONTH: date 2 weeks from now should match', async () => {
    const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString();
    const conditions = [{
      field: twoWeeks,
      dataType: DataType.DATETIME,
      comparison_op: Op.IS_WITHIN,
      comparison_sub_op: 'nextMonth',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('IS_WITHIN NEXT_YEAR: date 6 months from now should match', async () => {
    const sixMonths = new Date();
    sixMonths.setMonth(sixMonths.getMonth() + 6);
    const conditions = [{
      field: sixMonths.toISOString(),
      dataType: DataType.DATETIME,
      comparison_op: Op.IS_WITHIN,
      comparison_sub_op: 'nextYear',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('IS_WITHIN PAST_NUMBER_OF_DAYS: 5 days ago within 10 days', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
    const conditions = [{
      field: fiveDaysAgo,
      dataType: DataType.DATETIME,
      comparison_op: Op.IS_WITHIN,
      comparison_sub_op: 'pastNumberOfDays',
      value: '10',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('IS_WITHIN NEXT_NUMBER_OF_DAYS: 5 days from now within 10 days', async () => {
    const fiveDays = new Date(Date.now() + 5 * 86400000).toISOString();
    const conditions = [{
      field: fiveDays,
      dataType: DataType.DATETIME,
      comparison_op: Op.IS_WITHIN,
      comparison_sub_op: 'nextNumberOfDays',
      value: '10',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('IS_WITHIN with invalid sub-op defaults to false', async () => {
    const conditions = [{
      field: new Date().toISOString(),
      dataType: DataType.DATETIME,
      comparison_op: Op.IS_WITHIN,
      comparison_sub_op: 'invalidSubOp',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(false);
  });
});

describe('IfNode.run - Select conditions (additional)', () => {
  it('NEQ: should be true when values differ', async () => {
    const conditions = [{
      field: 'option1',
      dataType: DataType.SELECT,
      comparison_op: Op.NEQ,
      value: 'option2',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_ALL_OF: should be true when not all values present', async () => {
    const conditions = [{
      field: ['a', 'b'],
      dataType: DataType.MULTI_SELECT,
      comparison_op: Op.NOT_ALL_OF,
      value: ['a', 'b', 'c'],
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('BLANK: should be true for empty array', async () => {
    const conditions = [{
      field: [],
      dataType: DataType.MULTI_SELECT,
      comparison_op: Op.BLANK,
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_BLANK: should be true for non-empty array', async () => {
    const conditions = [{
      field: ['a'],
      dataType: DataType.MULTI_SELECT,
      comparison_op: Op.NOT_BLANK,
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('ALL_OF: comma-separated string value', async () => {
    const conditions = [{
      field: ['red', 'blue', 'green'],
      dataType: DataType.MULTI_SELECT,
      comparison_op: Op.ALL_OF,
      value: 'red, blue',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });
});

describe('IfNode.run - JSON conditions (additional)', () => {
  it('BLANK: should be true for null field', async () => {
    const conditions = [{
      field: null,
      dataType: DataType.JSON,
      comparison_op: Op.BLANK,
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('BLANK: should be true for native empty object', async () => {
    const conditions = [{
      field: {},
      dataType: DataType.JSON,
      comparison_op: Op.BLANK,
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_BLANK: should be true for non-empty object', async () => {
    const conditions = [{
      field: '{"a":1}',
      dataType: DataType.JSON,
      comparison_op: Op.NOT_BLANK,
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('EQ: should match native objects (not strings)', async () => {
    const conditions = [{
      field: { x: 1, y: 2 },
      dataType: DataType.JSON,
      comparison_op: Op.EQ,
      value: { x: 1, y: 2 },
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('should return false for invalid JSON parse', async () => {
    const conditions = [{
      field: 'not-json{{{',
      dataType: DataType.JSON,
      comparison_op: Op.EQ,
      value: '{"a":1}',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(false);
  });

  it('unsupported JSON op returns false (caught by try/catch)', async () => {
    const conditions = [{
      field: '{"a":1}',
      dataType: DataType.JSON,
      comparison_op: Op.GT,
      value: '{"a":2}',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    // The evaluateJsonCondition try/catch returns false for thrown errors
    expect(result.status).toBe('success');
    expect(result.outputs.result).toBe(false);
  });
});

describe('IfNode.run - auto data type detection', () => {
  it('should auto-detect number type', async () => {
    const conditions = [{
      field: 42,
      comparison_op: Op.EQ,
      value: 42,
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('should auto-detect boolean type', async () => {
    const conditions = [{
      field: true,
      comparison_op: Op.CHECKED,
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('should auto-detect Date instance', async () => {
    const now = new Date();
    const conditions = [{
      field: now,
      comparison_op: Op.NOT_BLANK,
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('should auto-detect date string', async () => {
    const conditions = [{
      field: '2025-06-15',
      comparison_op: Op.GT,
      value: '2020-01-01',
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('should auto-detect array as MULTI_SELECT', async () => {
    const conditions = [{
      field: ['a', 'b'],
      comparison_op: Op.ANY_OF,
      value: ['b'],
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('should auto-detect object as JSON', async () => {
    const conditions = [{
      field: { key: 'val' },
      comparison_op: Op.EQ,
      value: { key: 'val' },
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('should default null to TEXT and handle BLANK', async () => {
    const conditions = [{
      field: null,
      comparison_op: Op.BLANK,
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });
});

describe('IfNode.run - nested groups', () => {
  it('should handle deeply nested AND inside OR', async () => {
    const conditions = [{
      is_group: true,
      logical_op: 'or',
      children: [
        { field: 'x', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'wrong' },
        {
          is_group: true,
          logical_op: 'and',
          children: [
            { field: 10, dataType: DataType.NUMBER, comparison_op: Op.GT, value: 5 },
            { field: 'hello', dataType: DataType.TEXT, comparison_op: Op.EQ, value: 'hello' },
          ],
        },
      ],
    }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });
});

// ----- Backward Compatibility: deprecated EMPTY/NOT_EMPTY/NULL/NOT_NULL -----

describe('IfNode.run - deprecated ops (backward compatibility)', () => {
  it('EMPTY: should work like BLANK for text', async () => {
    const conditions = [{ field: '', dataType: DataType.TEXT, comparison_op: 'empty' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_EMPTY: should work like NOT_BLANK for text', async () => {
    const conditions = [{ field: 'hello', dataType: DataType.TEXT, comparison_op: 'notempty' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NULL: should work like BLANK for text', async () => {
    const conditions = [{ field: null, dataType: DataType.TEXT, comparison_op: 'null' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_NULL: should work like NOT_BLANK for text', async () => {
    const conditions = [{ field: 'value', dataType: DataType.TEXT, comparison_op: 'notnull' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('EMPTY: should work for number (NaN is empty)', async () => {
    const conditions = [{ field: 'abc', dataType: DataType.NUMBER, comparison_op: 'empty' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NULL: should work for date (invalid date is null)', async () => {
    const conditions = [{ field: 'invalid', dataType: DataType.DATE, comparison_op: 'null' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_EMPTY: should work for number', async () => {
    const conditions = [{ field: 42, dataType: DataType.NUMBER, comparison_op: 'notempty' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_NULL: should work for date', async () => {
    const conditions = [{ field: '2025-06-15', dataType: DataType.DATE, comparison_op: 'notnull' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('deprecated ops should not require value in validation', async () => {
    const node = createIfNode();
    for (const op of ['empty', 'notempty', 'null', 'notnull']) {
      const result = await node.validate({
        conditions: [{ field: 'name', comparison_op: op }],
      } as any);
      expect(result.valid).toBe(true);
    }
  });

  it('EMPTY: should work for JSON (null field)', async () => {
    const conditions = [{ field: null, dataType: DataType.JSON, comparison_op: 'empty' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });

  it('NOT_NULL: should work for select', async () => {
    const conditions = [{ field: ['a'], dataType: DataType.MULTI_SELECT, comparison_op: 'notnull' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.outputs.result).toBe(true);
  });
});

describe('IfNode.run - error handling', () => {
  it('should return error status for unsupported operation', async () => {
    const conditions = [{ field: 'hello', dataType: DataType.TEXT, comparison_op: 'INVALID_OP' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.status).toBe('error');
    expect(result.error?.message).toContain('Unsupported');
  });

  it('should return error for unknown data type', async () => {
    const conditions = [{ field: 'hello', dataType: 'unknown_type', comparison_op: Op.EQ, value: 'x' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.status).toBe('error');
    expect(result.error?.message).toContain('Unknown data type');
  });

  it('should return error for unsupported number op', async () => {
    const conditions = [{ field: 5, dataType: DataType.NUMBER, comparison_op: Op.LIKE, value: '5' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.status).toBe('error');
  });

  it('should return error for unsupported boolean op', async () => {
    const conditions = [{ field: true, dataType: DataType.BOOLEAN, comparison_op: Op.GT }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.status).toBe('error');
  });

  it('should return error for unsupported select op', async () => {
    const conditions = [{ field: 'a', dataType: DataType.SELECT, comparison_op: Op.LIKE, value: 'a' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.status).toBe('error');
  });

  it('should return error for unsupported date op', async () => {
    const conditions = [{ field: '2025-01-01', dataType: DataType.DATE, comparison_op: Op.LIKE, value: '2025' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.status).toBe('error');
  });

  it('should include metrics in error result', async () => {
    const conditions = [{ field: 'hello', dataType: 'bad_type', comparison_op: Op.EQ, value: 'x' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.metrics?.executionTimeMs).toBeDefined();
  });
});
