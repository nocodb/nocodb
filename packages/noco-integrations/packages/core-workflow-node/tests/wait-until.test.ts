import { describe, it, expect, vi, afterEach } from 'vitest';
import { WaitUntilNode } from '../src/nodes/wait-until';

function createNode(config: Record<string, any> = {}): WaitUntilNode {
  return new WaitUntilNode(
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
// validate()
// ──────────────────────────────────────────────

describe('WaitUntilNode.validate - required', () => {
  it('should fail when datetime is missing', async () => {
    const node = createNode();
    const result = await node.validate({} as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Date & time is required' }),
    );
  });

  it('should fail when datetime is empty string', async () => {
    const node = createNode();
    const result = await node.validate({ datetime: '' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Date & time is required' }),
    );
  });

  it('should early return on missing datetime (no format error)', async () => {
    const node = createNode();
    const result = await node.validate({} as any);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Date & time is required');
  });
});

describe('WaitUntilNode.validate - format', () => {
  it('should accept valid ISO 8601 datetime with Z', async () => {
    const node = createNode();
    const result = await node.validate({ datetime: '2025-12-31T23:59:59Z' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept valid ISO 8601 datetime with timezone offset', async () => {
    const node = createNode();
    const result = await node.validate({ datetime: '2025-06-15T10:30:00+05:30' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept date-only string', async () => {
    const node = createNode();
    const result = await node.validate({ datetime: '2025-06-15' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept datetime without timezone (local)', async () => {
    const node = createNode();
    const result = await node.validate({ datetime: '2025-06-15T10:30:00' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept RFC 2822 date format', async () => {
    const node = createNode();
    const result = await node.validate({ datetime: 'Mon, 15 Jun 2025 10:30:00 GMT' } as any);
    expect(result.valid).toBe(true);
  });

  it('should reject obviously invalid date string', async () => {
    const node = createNode();
    const result = await node.validate({ datetime: 'not-a-date' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('Invalid date format') }),
    );
  });

  it('should reject random text', async () => {
    const node = createNode();
    const result = await node.validate({ datetime: 'hello world' } as any);
    expect(result.valid).toBe(false);
  });

  it('should reject impossible date', async () => {
    const node = createNode();
    const result = await node.validate({ datetime: '2025-13-45T99:99:99Z' } as any);
    expect(result.valid).toBe(false);
  });

  it('should reject empty whitespace', async () => {
    const node = createNode();
    // Empty string after trim is falsy — caught by required check
    const result = await node.validate({ datetime: '   ' } as any);
    // '   ' is truthy so it passes the required check but fails date parsing
    expect(result.valid).toBe(false);
  });
});

// ──────────────────────────────────────────────
// run() — future vs past
// ──────────────────────────────────────────────

describe('WaitUntilNode.run', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should set resumeAt for future datetime', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
    const node = createNode({ datetime: futureDate });
    const result = await node.run(createRunContext({ datetime: futureDate }));

    expect(result.status).toBe('success');
    expect(result.outputs.wasInPast).toBe(false);
    expect(result.outputs.resumeAt).toBeDefined();
    expect(result.outputs.delayDuration).toBeGreaterThan(0);
    expect(result.outputs.targetDateTime).toBe(futureDate);
  });

  it('should detect past datetime and continue immediately', async () => {
    const pastDate = '2020-01-01T00:00:00Z';
    const node = createNode({ datetime: pastDate });
    const result = await node.run(createRunContext({ datetime: pastDate }));

    expect(result.status).toBe('success');
    expect(result.outputs.wasInPast).toBe(true);
    expect(result.outputs.resumeAt).toBeUndefined();
    expect(result.outputs.targetDateTime).toBe(new Date(pastDate).toISOString());
  });

  it('should include correct targetDateTime in output', async () => {
    const dt = '2099-06-15T12:00:00Z';
    const node = createNode({ datetime: dt });
    const result = await node.run(createRunContext({ datetime: dt }));

    // new Date().toISOString() normalizes to include milliseconds
    expect(result.outputs.targetDateTime).toBe('2099-06-15T12:00:00.000Z');
  });

  it('should log warning for past date', async () => {
    const pastDate = '2000-01-01T00:00:00Z';
    const node = createNode({ datetime: pastDate });
    const result = await node.run(createRunContext({ datetime: pastDate }));

    const warnLog = result.logs.find((l: any) => l.level === 'warn');
    expect(warnLog).toBeDefined();
    expect(warnLog!.message).toContain('in the past');
  });

  it('should log info for future date', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const node = createNode({ datetime: futureDate });
    const result = await node.run(createRunContext({ datetime: futureDate }));

    const infoLog = result.logs.find((l: any) => l.level === 'info');
    expect(infoLog).toBeDefined();
    expect(infoLog!.message).toContain('will pause until');
  });
});
