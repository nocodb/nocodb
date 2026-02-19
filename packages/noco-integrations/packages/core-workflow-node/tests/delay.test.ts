import { describe, it, expect, vi } from 'vitest';
import { DelayNode } from '../src/nodes/delay';

function createNode(config: Record<string, any> = {}): DelayNode {
  return new DelayNode(
    { _nocodb: {}, ...config } as any,
    { logger: () => {} },
  );
}

function createRunContext(config: Record<string, any>): any {
  return {
    inputs: { config },
    nodeId: 'test-node',
    executionId: 'test-exec',
  };
}

// ──────────────────────────────────────────────
// validate() — duration
// ──────────────────────────────────────────────

describe('DelayNode.validate - duration', () => {
  it('should fail when duration is missing', async () => {
    const node = createNode();
    const result = await node.validate({ unit: 'minutes' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Duration must be greater than 0' }),
    );
  });

  it('should fail when duration is 0', async () => {
    const node = createNode();
    const result = await node.validate({ duration: 0, unit: 'minutes' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Duration must be greater than 0' }),
    );
  });

  it('should fail when duration is negative', async () => {
    const node = createNode();
    const result = await node.validate({ duration: -5, unit: 'minutes' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Duration must be greater than 0' }),
    );
  });

  it('should accept duration of 1', async () => {
    const node = createNode();
    const result = await node.validate({ duration: 1, unit: 'seconds' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept fractional duration', async () => {
    const node = createNode();
    const result = await node.validate({ duration: 0.5, unit: 'hours' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept large duration within 365 days', async () => {
    const node = createNode();
    const result = await node.validate({ duration: 364, unit: 'days' } as any);
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────
// validate() — unit
// ──────────────────────────────────────────────

describe('DelayNode.validate - unit', () => {
  it.each(['seconds', 'minutes', 'hours', 'days'])(
    'should accept valid unit: %s',
    async (unit) => {
      const node = createNode();
      const result = await node.validate({ duration: 5, unit } as any);
      expect(result.valid).toBe(true);
    },
  );

  it('should fail when unit is missing', async () => {
    const node = createNode();
    const result = await node.validate({ duration: 5 } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Valid unit is required (seconds, minutes, hours, days)' }),
    );
  });

  it('should fail for invalid unit', async () => {
    const node = createNode();
    const result = await node.validate({ duration: 5, unit: 'weeks' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Valid unit is required (seconds, minutes, hours, days)' }),
    );
  });

  it('should fail for empty string unit', async () => {
    const node = createNode();
    const result = await node.validate({ duration: 5, unit: '' } as any);
    expect(result.valid).toBe(false);
  });

  it('should fail for uppercase unit (case-sensitive)', async () => {
    const node = createNode();
    const result = await node.validate({ duration: 5, unit: 'MINUTES' } as any);
    expect(result.valid).toBe(false);
  });
});

// ──────────────────────────────────────────────
// validate() — max duration (365 days)
// ──────────────────────────────────────────────

describe('DelayNode.validate - max duration', () => {
  it('should accept exactly 365 days', async () => {
    const node = createNode();
    const result = await node.validate({ duration: 365, unit: 'days' } as any);
    expect(result.valid).toBe(true);
  });

  it('should reject 366 days', async () => {
    const node = createNode();
    const result = await node.validate({ duration: 366, unit: 'days' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Duration cannot exceed 365 days' }),
    );
  });

  it('should reject equivalent of >365 days in hours', async () => {
    const node = createNode();
    // 365 days = 8760 hours, so 8761 hours exceeds it
    const result = await node.validate({ duration: 8761, unit: 'hours' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Duration cannot exceed 365 days' }),
    );
  });

  it('should accept equivalent of exactly 365 days in minutes', async () => {
    const node = createNode();
    // 365 days = 525600 minutes
    const result = await node.validate({ duration: 525600, unit: 'minutes' } as any);
    expect(result.valid).toBe(true);
  });

  it('should reject equivalent of >365 days in seconds', async () => {
    const node = createNode();
    // 365 days = 31536000 seconds
    const result = await node.validate({ duration: 31536001, unit: 'seconds' } as any);
    expect(result.valid).toBe(false);
  });
});

// ──────────────────────────────────────────────
// validate() — multiple errors
// ──────────────────────────────────────────────

describe('DelayNode.validate - multiple errors', () => {
  it('should report both missing duration and missing unit', async () => {
    const node = createNode();
    const result = await node.validate({} as any);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
  });

  it('should report both negative duration and invalid unit', async () => {
    const node = createNode();
    const result = await node.validate({ duration: -1, unit: 'millennia' } as any);
    expect(result.valid).toBe(false);
    const messages = result.errors.map((e: any) => e.message);
    expect(messages).toContain('Duration must be greater than 0');
    expect(messages).toContain('Valid unit is required (seconds, minutes, hours, days)');
  });
});

// ──────────────────────────────────────────────
// run()
// ──────────────────────────────────────────────

describe('DelayNode.run', () => {
  it('should return resumeAt timestamp for valid delay', async () => {
    const before = Date.now();
    const node = createNode({ duration: 5, unit: 'minutes' });
    const result = await node.run(createRunContext({ duration: 5, unit: 'minutes' }));

    expect(result.status).toBe('success');
    expect(result.outputs.resumeAt).toBeGreaterThan(before);
    // 5 minutes = 300000ms
    expect(result.outputs.resumeAt).toBeGreaterThanOrEqual(before + 300000);
    expect(result.outputs.scheduledResumeTime).toBeDefined();
    expect(result.metrics?.delayMs).toBe(300000);
  });

  it('should calculate correct delay for seconds', async () => {
    const node = createNode({ duration: 30, unit: 'seconds' });
    const result = await node.run(createRunContext({ duration: 30, unit: 'seconds' }));
    expect(result.metrics?.delayMs).toBe(30000);
  });

  it('should calculate correct delay for hours', async () => {
    const node = createNode({ duration: 2, unit: 'hours' });
    const result = await node.run(createRunContext({ duration: 2, unit: 'hours' }));
    expect(result.metrics?.delayMs).toBe(7200000);
  });

  it('should calculate correct delay for days', async () => {
    const node = createNode({ duration: 1, unit: 'days' });
    const result = await node.run(createRunContext({ duration: 1, unit: 'days' }));
    expect(result.metrics?.delayMs).toBe(86400000);
  });

  it('should return ISO string for scheduledResumeTime', async () => {
    const node = createNode({ duration: 10, unit: 'seconds' });
    const result = await node.run(createRunContext({ duration: 10, unit: 'seconds' }));
    // Verify it's a valid ISO string
    const parsed = new Date(result.outputs.scheduledResumeTime);
    expect(parsed.getTime()).not.toBeNaN();
  });
});
