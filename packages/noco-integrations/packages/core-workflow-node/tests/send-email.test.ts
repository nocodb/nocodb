import { describe, it, expect, vi } from 'vitest';
import { SendEmailAction } from '../src/nodes/send-email';

function createNode(config: Record<string, any> = {}): SendEmailAction {
  return new SendEmailAction(
    { _nocodb: {}, ...config } as any,
    { logger: () => {} },
  );
}

function createNodeWithMail(
  config: Record<string, any>,
  sendMailRaw: any,
): SendEmailAction {
  return new SendEmailAction(
    { _nocodb: { mailService: { sendMailRaw } }, ...config } as any,
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
// validate() — required fields
// ──────────────────────────────────────────────

describe('SendEmailAction.validate - required fields', () => {
  it('should fail when to is missing', async () => {
    const node = createNode();
    const result = await node.validate({ to: '', subject: 'Hi', body: 'Hello' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'To field is required' }),
    );
  });

  it('should fail when to is whitespace', async () => {
    const node = createNode();
    const result = await node.validate({ to: '   ', subject: 'Hi', body: 'Hello' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'To field is required' }),
    );
  });

  it('should fail when subject is missing', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'test@example.com', subject: '', body: 'Hello' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Subject is required' }),
    );
  });

  it('should fail when subject is whitespace', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'test@example.com', subject: '   ', body: 'Hello' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Subject is required' }),
    );
  });

  it('should fail when body is missing', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'test@example.com', subject: 'Hi', body: '' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Body is required' }),
    );
  });

  it('should fail when body is whitespace', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'test@example.com', subject: 'Hi', body: '   ' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Body is required' }),
    );
  });

  it('should collect all missing field errors at once', async () => {
    const node = createNode();
    const result = await node.validate({ to: '', subject: '', body: '' } as any);
    expect(result.valid).toBe(false);
    const messages = result.errors.map((e: any) => e.message);
    expect(messages).toContain('To field is required');
    expect(messages).toContain('Subject is required');
    expect(messages).toContain('Body is required');
  });
});

// ──────────────────────────────────────────────
// validate() — email format
// ──────────────────────────────────────────────

describe('SendEmailAction.validate - email format', () => {
  it('should accept valid email', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'user@example.com', subject: 'Hi', body: 'Hello' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept email with subdomain', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'user@mail.example.co.uk', subject: 'Hi', body: 'Hello' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept email with plus addressing', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'user+tag@example.com', subject: 'Hi', body: 'Hello' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept email with dots in local part', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'first.last@example.com', subject: 'Hi', body: 'Hello' } as any);
    expect(result.valid).toBe(true);
  });

  it('should reject email without @', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'not-an-email', subject: 'Hi', body: 'Hello' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Please provide a valid email address' }),
    );
  });

  it('should reject email without domain', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'user@', subject: 'Hi', body: 'Hello' } as any);
    expect(result.valid).toBe(false);
  });

  it('should reject email without local part', async () => {
    const node = createNode();
    const result = await node.validate({ to: '@example.com', subject: 'Hi', body: 'Hello' } as any);
    expect(result.valid).toBe(false);
  });

  it('should reject email with spaces', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'user @example.com', subject: 'Hi', body: 'Hello' } as any);
    expect(result.valid).toBe(false);
  });

  it('should reject double dots in domain', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'user@example..com', subject: 'Hi', body: 'Hello' } as any);
    expect(result.valid).toBe(false);
  });
});

// ──────────────────────────────────────────────
// validate() — comma-separated emails
// ──────────────────────────────────────────────

describe('SendEmailAction.validate - multiple recipients', () => {
  it('should reject comma-separated emails (whole string fails first validateEmail check)', async () => {
    // The code validates the full `to` string first, so "a@b.com, c@d.com" fails
    // because the whole string with comma is not a valid single email
    const node = createNode();
    const result = await node.validate({
      to: 'user1@example.com, user2@example.com',
      subject: 'Hi',
      body: 'Hello',
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Please provide a valid email address' }),
    );
  });

  it('should reject if any email is invalid in comma list', async () => {
    const node = createNode();
    const result = await node.validate({
      to: 'user1@example.com, bad-email, user3@example.com',
      subject: 'Hi',
      body: 'Hello',
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Please provide a valid email address' }),
    );
  });

  it('should reject trailing comma (whole string fails first check)', async () => {
    const node = createNode();
    const result = await node.validate({
      to: 'user@example.com,',
      subject: 'Hi',
      body: 'Hello',
    } as any);
    expect(result.valid).toBe(false);
  });

  it('should reject extra spaces around email (whole string fails first check)', async () => {
    const node = createNode();
    const result = await node.validate({
      to: '  user1@example.com  ,  user2@example.com  ',
      subject: 'Hi',
      body: 'Hello',
    } as any);
    expect(result.valid).toBe(false);
  });
});

// ──────────────────────────────────────────────
// validate() — dynamic expressions
// ──────────────────────────────────────────────

describe('SendEmailAction.validate - dynamic expressions', () => {
  it('should skip email validation for dynamic to field', async () => {
    const node = createNode();
    const result = await node.validate({
      to: '$(nodes.trigger.email)',
      subject: 'Hi',
      body: 'Hello',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should skip per-entry validation for dynamic entries in comma list', async () => {
    const node = createNode();
    const result = await node.validate({
      to: '$(nodes.trigger.email), user@example.com',
      subject: 'Hi',
      body: 'Hello',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should skip per-entry validation when entry contains dynamic expression', async () => {
    const node = createNode();
    const result = await node.validate({
      to: 'prefix-$(nodes.trigger.email)@example.com',
      subject: 'Hi',
      body: 'Hello',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept dynamic subject and body', async () => {
    const node = createNode();
    const result = await node.validate({
      to: 'user@example.com',
      subject: '$(nodes.trigger.subject)',
      body: '$(nodes.trigger.body)',
    } as any);
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────
// validate() — complete valid config
// ──────────────────────────────────────────────

describe('SendEmailAction.validate - complete configs', () => {
  it('should accept minimal valid config', async () => {
    const node = createNode();
    const result = await node.validate({
      to: 'user@example.com',
      subject: 'Test',
      body: 'Hello there',
    } as any);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept config with cc and bcc (not validated)', async () => {
    const node = createNode();
    const result = await node.validate({
      to: 'user@example.com',
      subject: 'Test',
      body: 'Hello',
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
    } as any);
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────
// run()
// ──────────────────────────────────────────────

describe('SendEmailAction.run - success', () => {
  it('should return success when email sends', async () => {
    const sendMailRaw = vi.fn().mockResolvedValue(true);
    const config = { to: 'user@example.com', subject: 'Hi', body: 'Hello' };
    const node = createNodeWithMail(config, sendMailRaw);
    const result = await node.run(createRunContext(config));

    expect(result.status).toBe('success');
    expect(result.outputs.success).toBe(true);
    expect(sendMailRaw).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: 'Hi',
      text: 'Hello',
    });
  });

  it('should include cc and bcc when provided', async () => {
    const sendMailRaw = vi.fn().mockResolvedValue(true);
    const config = {
      to: 'user@example.com',
      subject: 'Hi',
      body: 'Hello',
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
    };
    const node = createNodeWithMail(config, sendMailRaw);
    await node.run(createRunContext(config));

    expect(sendMailRaw).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: 'Hi',
      text: 'Hello',
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
    });
  });

  it('should not include cc/bcc when empty', async () => {
    const sendMailRaw = vi.fn().mockResolvedValue(true);
    const config = { to: 'user@example.com', subject: 'Hi', body: 'Hello', cc: '', bcc: '' };
    const node = createNodeWithMail(config, sendMailRaw);
    await node.run(createRunContext(config));

    const callArgs = sendMailRaw.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('cc');
    expect(callArgs).not.toHaveProperty('bcc');
  });

  it('should include executionTimeMs in metrics', async () => {
    const sendMailRaw = vi.fn().mockResolvedValue(true);
    const config = { to: 'user@example.com', subject: 'Hi', body: 'Hello' };
    const node = createNodeWithMail(config, sendMailRaw);
    const result = await node.run(createRunContext(config));

    expect(result.metrics?.executionTimeMs).toBeDefined();
    expect(result.metrics!.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include info logs', async () => {
    const sendMailRaw = vi.fn().mockResolvedValue(true);
    const config = { to: 'user@example.com', subject: 'Hi', body: 'Hello' };
    const node = createNodeWithMail(config, sendMailRaw);
    const result = await node.run(createRunContext(config));

    expect(result.logs.length).toBeGreaterThanOrEqual(2);
    expect(result.logs.some((l: any) => l.message.includes('Sending email'))).toBe(true);
    expect(result.logs.some((l: any) => l.message.includes('sent successfully'))).toBe(true);
  });
});

describe('SendEmailAction.run - failure', () => {
  it('should return error when sendMailRaw returns false', async () => {
    const sendMailRaw = vi.fn().mockResolvedValue(false);
    const config = { to: 'user@example.com', subject: 'Hi', body: 'Hello' };
    const node = createNodeWithMail(config, sendMailRaw);
    const result = await node.run(createRunContext(config));

    expect(result.status).toBe('error');
    expect(result.outputs.success).toBe(false);
    expect(result.error?.message).toBe('Failed to send email');
  });

  it('should return error when sendMailRaw throws', async () => {
    const sendMailRaw = vi.fn().mockRejectedValue(new Error('SMTP connection failed'));
    const config = { to: 'user@example.com', subject: 'Hi', body: 'Hello' };
    const node = createNodeWithMail(config, sendMailRaw);
    const result = await node.run(createRunContext(config));

    expect(result.status).toBe('error');
    expect(result.outputs.success).toBe(false);
    expect(result.error?.message).toBe('SMTP connection failed');
  });

  it('should include error log when sendMailRaw throws', async () => {
    const sendMailRaw = vi.fn().mockRejectedValue(new Error('timeout'));
    const config = { to: 'user@example.com', subject: 'Hi', body: 'Hello' };
    const node = createNodeWithMail(config, sendMailRaw);
    const result = await node.run(createRunContext(config));

    const errorLog = result.logs.find((l: any) => l.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog!.message).toContain('timeout');
  });

  it('should include error code when available', async () => {
    const err = new Error('ECONNREFUSED') as any;
    err.code = 'ECONNREFUSED';
    const sendMailRaw = vi.fn().mockRejectedValue(err);
    const config = { to: 'user@example.com', subject: 'Hi', body: 'Hello' };
    const node = createNodeWithMail(config, sendMailRaw);
    const result = await node.run(createRunContext(config));

    expect(result.error?.code).toBe('ECONNREFUSED');
  });

  it('should include metrics on failure', async () => {
    const sendMailRaw = vi.fn().mockResolvedValue(false);
    const config = { to: 'user@example.com', subject: 'Hi', body: 'Hello' };
    const node = createNodeWithMail(config, sendMailRaw);
    const result = await node.run(createRunContext(config));

    expect(result.metrics?.executionTimeMs).toBeDefined();
  });
});
