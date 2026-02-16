import { describe, it, expect } from 'vitest';
import { IfNode } from '../src/nodes/if';
import type { IfNodeConfig } from '../src/nodes/if';

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
    const result = await node.validate({ conditions: [] } as IfNodeConfig);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('At least one condition');
  });

  it('should fail when field is missing', async () => {
    const node = createIfNode();
    const result = await node.validate({
      conditions: [{ field: '', comparison_op: Op.EQ, value: 'x' }],
    } as IfNodeConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: any) => e.message === 'Field is required')).toBe(true);
  });

  it('should fail when comparison_op is missing', async () => {
    const node = createIfNode();
    const result = await node.validate({
      conditions: [{ field: 'name', comparison_op: '', value: 'x' }],
    } as IfNodeConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: any) => e.message === 'Comparison operation is required')).toBe(true);
  });

  it('should fail when value is missing for ops that require it', async () => {
    const node = createIfNode();
    const result = await node.validate({
      conditions: [{ field: 'name', comparison_op: Op.EQ }],
    } as IfNodeConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: any) => e.message === 'Value is required for this operation')).toBe(true);
  });

  it('should pass when value is missing for blank/not_blank (no value needed)', async () => {
    const node = createIfNode();
    const blankResult = await node.validate({
      conditions: [{ field: 'name', comparison_op: Op.BLANK }],
    } as IfNodeConfig);
    expect(blankResult.valid).toBe(true);

    const notBlankResult = await node.validate({
      conditions: [{ field: 'name', comparison_op: Op.NOT_BLANK }],
    } as IfNodeConfig);
    expect(notBlankResult.valid).toBe(true);
  });

  it('should pass when value is missing for checked/not_checked (no value needed)', async () => {
    const node = createIfNode();
    const result = await node.validate({
      conditions: [{ field: 'active', comparison_op: Op.CHECKED }],
    } as IfNodeConfig);
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
    } as IfNodeConfig);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Group must have at least one child');
  });

  it('should pass for a valid condition', async () => {
    const node = createIfNode();
    const result = await node.validate({
      conditions: [{ field: 'name', comparison_op: Op.EQ, value: 'hello' }],
    } as IfNodeConfig);
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

describe('IfNode.run - error handling', () => {
  it('should return error status for unsupported operation', async () => {
    const conditions = [{ field: 'hello', dataType: DataType.TEXT, comparison_op: 'INVALID_OP' }];
    const node = createIfNode(conditions);
    const result = await node.run(createRunContext(conditions));
    expect(result.status).toBe('error');
    expect(result.error?.message).toContain('Unsupported');
  });
});
