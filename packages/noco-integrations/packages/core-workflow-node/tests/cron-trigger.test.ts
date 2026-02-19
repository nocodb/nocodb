import { describe, it, expect } from 'vitest';
import { CronTriggerNode } from '../src/nodes/cron-trigger';

function createNode(config: Record<string, any> = {}): CronTriggerNode {
  return new CronTriggerNode(
    { _nocodb: {}, ...config } as any,
    { logger: () => {} },
  );
}

// ──────────────────────────────────────────────
// validate() — required
// ──────────────────────────────────────────────

describe('CronTriggerNode.validate - required', () => {
  it('should fail when cronExpression is missing', async () => {
    const node = createNode();
    const result = await node.validate({} as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Cron expression is required' }),
    );
  });

  it('should fail when cronExpression is empty string', async () => {
    const node = createNode();
    const result = await node.validate({ cronExpression: '' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Cron expression is required' }),
    );
  });
});

// ──────────────────────────────────────────────
// validate() — valid cron expressions
// ──────────────────────────────────────────────

describe('CronTriggerNode.validate - valid expressions', () => {
  it.each([
    ['every minute', '* * * * *'],
    ['every hour', '0 * * * *'],
    ['every day at midnight', '0 0 * * *'],
    ['every Monday at 9am', '0 9 * * 1'],
    ['every 5 minutes', '*/5 * * * *'],
    ['first of every month', '0 0 1 * *'],
    ['weekdays at 8:30am', '30 8 * * 1-5'],
    ['every 15 min on weekdays', '*/15 * * * 1-5'],
    ['specific months', '0 0 1 1,6,12 *'],
  ])('should accept: %s (%s)', async (_desc, cron) => {
    const node = createNode();
    const result = await node.validate({ cronExpression: cron } as any);
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────
// validate() — invalid cron expressions
// ──────────────────────────────────────────────

describe('CronTriggerNode.validate - invalid expressions', () => {
  it('should reject random string', async () => {
    const node = createNode();
    const result = await node.validate({ cronExpression: 'not a cron' } as any);
    expect(result.valid).toBe(false);
  });

  it('should reject single word', async () => {
    const node = createNode();
    const result = await node.validate({ cronExpression: 'every-day' } as any);
    expect(result.valid).toBe(false);
  });

  it('should reject out-of-range values', async () => {
    const node = createNode();
    const result = await node.validate({ cronExpression: '60 25 32 13 8' } as any);
    expect(result.valid).toBe(false);
  });

  it('should reject invalid step syntax', async () => {
    const node = createNode();
    const result = await node.validate({ cronExpression: '*/0 * * * *' } as any);
    expect(result.valid).toBe(false);
  });
});

// ──────────────────────────────────────────────
// validate() — timezone
// ──────────────────────────────────────────────

describe('CronTriggerNode.validate - timezone', () => {
  it('should accept valid timezone', async () => {
    const node = createNode();
    const result = await node.validate({
      cronExpression: '0 9 * * *',
      timezone: 'America/New_York',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept UTC timezone', async () => {
    const node = createNode();
    const result = await node.validate({
      cronExpression: '0 9 * * *',
      timezone: 'UTC',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should default to UTC when timezone is missing', async () => {
    const node = createNode();
    const result = await node.validate({ cronExpression: '0 9 * * *' } as any);
    expect(result.valid).toBe(true);
  });

  it('should still parse with unrecognized timezone (cron-parser is lenient)', async () => {
    const node = createNode();
    const result = await node.validate({
      cronExpression: '0 9 * * *',
      timezone: 'Mars/Olympus',
    } as any);
    // cron-parser does not throw for unknown timezones — it falls back
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────
// run()
// ──────────────────────────────────────────────

describe('CronTriggerNode.run', () => {
  it('should return trigger metadata on success', async () => {
    const node = createNode({ cronExpression: '*/5 * * * *', timezone: 'UTC' });
    const result = await node.run({
      inputs: { scheduledTime: '2025-06-15T10:00:00Z' },
      nodeId: 'test',
      executionId: 'exec-1',
    } as any);

    expect(result.status).toBe('success');
    expect(result.outputs.trigger.type).toBe('cron');
    expect(result.outputs.trigger.cronExpression).toBe('*/5 * * * *');
    expect(result.outputs.trigger.timezone).toBe('UTC');
    expect(result.outputs.trigger.scheduledTime).toBe('2025-06-15T10:00:00Z');
    expect(result.outputs.trigger.timestamp).toBeDefined();
  });

  it('should fallback to triggeredAt when scheduledTime is missing', async () => {
    const node = createNode({ cronExpression: '0 0 * * *' });
    const result = await node.run({
      inputs: {},
      nodeId: 'test',
      executionId: 'exec-1',
    } as any);

    expect(result.status).toBe('success');
    // scheduledTime should be the triggeredAt timestamp
    expect(result.outputs.trigger.scheduledTime).toBe(result.outputs.trigger.timestamp);
  });
});
