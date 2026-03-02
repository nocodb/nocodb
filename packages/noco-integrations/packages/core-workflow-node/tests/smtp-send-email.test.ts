import { describe, it, expect, vi } from 'vitest';
import { SmtpSendEmailNode } from '../src/nodes/smtp-send-email';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function createNode(config: Record<string, any> = {}): SmtpSendEmailNode {
  return new SmtpSendEmailNode(
    { _nocodb: {}, ...config } as any,
    { logger: () => {} },
  );
}

function createNodeWithAuth(
  config: Record<string, any>,
  mockSendMail: ReturnType<typeof vi.fn>,
  integrationConfig: Record<string, any> = {},
): SmtpSendEmailNode {
  const node = new SmtpSendEmailNode(
    { _nocodb: {}, ...config } as any,
    { logger: () => {} },
  );

  // Stub getIntegration to return a fake SmtpAuthIntegration
  (node as any).getIntegration = vi.fn().mockResolvedValue({
    config: {
      fromEmail: 'default@acme.com',
      fromName: 'Acme',
      ...integrationConfig,
    },
    use: async (fn: (t: any) => any) => fn({ sendMail: mockSendMail }),
  });

  return node;
}

function createRunContext(config: Record<string, any>): any {
  return {
    inputs: { config },
    nodeId: 'test-node',
    executionId: 'test-exec',
  };
}

const VALID_CONFIG = {
  authIntegrationId: 'auth-123',
  to: 'recipient@example.com',
  subject: 'Hello',
  body: 'Test body',
};

// ──────────────────────────────────────────────
// validate() — required fields
// ──────────────────────────────────────────────

describe('SmtpSendEmailNode.validate - required fields', () => {
  it('should fail when authIntegrationId is missing', async () => {
    const node = createNode();
    const result = await node.validate({ to: 'a@b.com', subject: 'Hi', body: 'Body' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'SMTP account is required' }),
    );
  });

  it('should fail when to is missing', async () => {
    const node = createNode();
    const result = await node.validate({ authIntegrationId: 'id', to: '', subject: 'Hi', body: 'Body' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: 'config.to' }),
    );
  });

  it('should fail when subject is missing', async () => {
    const node = createNode();
    const result = await node.validate({ authIntegrationId: 'id', to: 'a@b.com', subject: '', body: 'Body' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Subject is required' }),
    );
  });

  it('should fail when subject is whitespace', async () => {
    const node = createNode();
    const result = await node.validate({ authIntegrationId: 'id', to: 'a@b.com', subject: '   ', body: 'Body' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Subject is required' }),
    );
  });

  it('should fail when body is missing', async () => {
    const node = createNode();
    const result = await node.validate({ authIntegrationId: 'id', to: 'a@b.com', subject: 'Hi', body: '' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Body is required' }),
    );
  });

  it('should collect multiple errors at once', async () => {
    const node = createNode();
    const result = await node.validate({ authIntegrationId: '', to: '', subject: '', body: '' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ──────────────────────────────────────────────
// validate() — email format
// ──────────────────────────────────────────────

describe('SmtpSendEmailNode.validate - email format', () => {
  it('should accept valid single email in to', async () => {
    const node = createNode();
    const result = await node.validate({ ...VALID_CONFIG } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept comma-separated valid emails in to', async () => {
    const node = createNode();
    const result = await node.validate({
      ...VALID_CONFIG,
      to: 'a@example.com, b@example.com',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid email in to', async () => {
    const node = createNode();
    const result = await node.validate({ ...VALID_CONFIG, to: 'not-an-email' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ path: 'config.to' }));
  });

  it('should reject invalid email mixed in to list', async () => {
    const node = createNode();
    const result = await node.validate({
      ...VALID_CONFIG,
      to: 'valid@example.com, bad-email',
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ path: 'config.to' }));
  });

  it('should accept dynamic $(variable) in to without email validation', async () => {
    const node = createNode();
    const result = await node.validate({ ...VALID_CONFIG, to: '$(trigger.email)' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept mixed static and dynamic entries in to', async () => {
    const node = createNode();
    const result = await node.validate({
      ...VALID_CONFIG,
      to: 'real@example.com, $(trigger.extra)',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should validate cc when provided', async () => {
    const node = createNode();
    const result = await node.validate({ ...VALID_CONFIG, cc: 'bad-email' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ path: 'config.cc' }));
  });

  it('should accept valid cc', async () => {
    const node = createNode();
    const result = await node.validate({ ...VALID_CONFIG, cc: 'cc@example.com' } as any);
    expect(result.valid).toBe(true);
  });

  it('should validate fromAddress when provided and not dynamic', async () => {
    const node = createNode();
    const result = await node.validate({ ...VALID_CONFIG, fromAddress: 'not-email' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ path: 'config.fromAddress' }));
  });

  it('should accept dynamic fromAddress without validation', async () => {
    const node = createNode();
    const result = await node.validate({ ...VALID_CONFIG, fromAddress: '$(trigger.from)' } as any);
    expect(result.valid).toBe(true);
  });

  it('should validate bcc when provided', async () => {
    const node = createNode();
    const result = await node.validate({ ...VALID_CONFIG, bcc: 'bad-email' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ path: 'config.bcc' }));
  });

});

// ──────────────────────────────────────────────
// run() — success cases
// ──────────────────────────────────────────────

describe('SmtpSendEmailNode.run - success', () => {
  it('should return success and call sendMail with correct args', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: '<msg-123@smtp.example.com>',
      accepted: ['recipient@example.com'],
      rejected: [],
      envelope: { from: 'default@acme.com', to: ['recipient@example.com'] },
    });
    const node = createNodeWithAuth(VALID_CONFIG, sendMail);
    const result = await node.run(createRunContext(VALID_CONFIG));

    expect(result.status).toBe('success');
    expect(result.outputs.success).toBe(true);
    expect(result.outputs.messageId).toBe('<msg-123@smtp.example.com>');
    expect(result.outputs.accepted).toEqual(['recipient@example.com']);
    expect(result.outputs.rejected).toEqual([]);
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it('should send plain text body', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: 'id', accepted: [], rejected: [], envelope: {},
    });
    const node = createNodeWithAuth(VALID_CONFIG, sendMail);
    await node.run(createRunContext(VALID_CONFIG));

    const call = sendMail.mock.calls[0][0];
    expect(call.text).toBe('Test body');
    expect(call.html).toBeUndefined();
  });

  it('should use integration fromEmail as default From', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: 'id', accepted: [], rejected: [], envelope: {},
    });
    const node = createNodeWithAuth(VALID_CONFIG, sendMail, {
      fromEmail: 'default@acme.com',
      fromName: 'Acme',
    });
    await node.run(createRunContext(VALID_CONFIG));

    const call = sendMail.mock.calls[0][0];
    expect(call.from).toBe('"Acme" <default@acme.com>');
  });

  it('should override From with node-level fromAddress', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: 'id', accepted: [], rejected: [], envelope: {},
    });
    const config = { ...VALID_CONFIG, fromAddress: 'override@acme.com', fromName: 'Override' };
    const node = createNodeWithAuth(config, sendMail, { fromEmail: 'default@acme.com' });
    await node.run(createRunContext(config));

    const call = sendMail.mock.calls[0][0];
    expect(call.from).toContain('override@acme.com');
  });

  it('should include cc when provided', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: 'id', accepted: [], rejected: [], envelope: {},
    });
    const config = { ...VALID_CONFIG, cc: 'cc@example.com' };
    const node = createNodeWithAuth(config, sendMail);
    await node.run(createRunContext(config));

    expect(sendMail.mock.calls[0][0].cc).toBe('cc@example.com');
  });

  it('should include bcc when provided', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: 'id', accepted: [], rejected: [], envelope: {},
    });
    const config = { ...VALID_CONFIG, bcc: 'bcc@example.com' };
    const node = createNodeWithAuth(config, sendMail);
    await node.run(createRunContext(config));

    expect(sendMail.mock.calls[0][0].bcc).toBe('bcc@example.com');
  });

  it('should omit cc/bcc when not provided', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: 'id', accepted: [], rejected: [], envelope: {},
    });
    const node = createNodeWithAuth(VALID_CONFIG, sendMail);
    await node.run(createRunContext(VALID_CONFIG));

    const call = sendMail.mock.calls[0][0];
    expect(call).not.toHaveProperty('cc');
    expect(call).not.toHaveProperty('bcc');
  });

  it('should include executionTimeMs in metrics', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: 'id', accepted: [], rejected: [], envelope: {},
    });
    const node = createNodeWithAuth(VALID_CONFIG, sendMail);
    const result = await node.run(createRunContext(VALID_CONFIG));

    expect(result.metrics?.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include info logs on success', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: 'id', accepted: [], rejected: [], envelope: {},
    });
    const node = createNodeWithAuth(VALID_CONFIG, sendMail);
    const result = await node.run(createRunContext(VALID_CONFIG));

    expect(result.logs.some((l: any) => l.message.includes('Sending email'))).toBe(true);
    expect(result.logs.some((l: any) => l.message.includes('sent successfully'))).toBe(true);
  });
});

// ──────────────────────────────────────────────
// run() — failure cases
// ──────────────────────────────────────────────

describe('SmtpSendEmailNode.run - failure', () => {
  it('should return error when authIntegrationId is missing', async () => {
    const node = createNode();
    const config = { to: 'a@b.com', subject: 'Hi', body: 'Body' };
    const result = await node.run(createRunContext(config));

    expect(result.status).toBe('error');
    expect(result.outputs.success).toBe(false);
    expect(result.error?.code).toBe('MISSING_AUTH');
  });

  it('should return error when sendMail throws', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('SMTP connection refused'));
    const node = createNodeWithAuth(VALID_CONFIG, sendMail);
    const result = await node.run(createRunContext(VALID_CONFIG));

    expect(result.status).toBe('error');
    expect(result.outputs.success).toBe(false);
    expect(result.error?.message).toBe('SMTP connection refused');
  });

  it('should include error code when present on thrown error', async () => {
    const err = Object.assign(new Error('auth failed'), { code: 'EAUTH' });
    const sendMail = vi.fn().mockRejectedValue(err);
    const node = createNodeWithAuth(VALID_CONFIG, sendMail);
    const result = await node.run(createRunContext(VALID_CONFIG));

    expect(result.error?.code).toBe('EAUTH');
  });

  it('should include error log on failure', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('timeout'));
    const node = createNodeWithAuth(VALID_CONFIG, sendMail);
    const result = await node.run(createRunContext(VALID_CONFIG));

    const errorLog = result.logs.find((l: any) => l.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog?.message).toContain('timeout');
  });

  it('should include metrics on failure', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('err'));
    const node = createNodeWithAuth(VALID_CONFIG, sendMail);
    const result = await node.run(createRunContext(VALID_CONFIG));

    expect(result.metrics?.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});

// ──────────────────────────────────────────────
// sanitizeHeader — SMTP injection prevention
// ──────────────────────────────────────────────

describe('SmtpSendEmailNode - header injection prevention', () => {
  it('should strip CR from subject', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: 'id', accepted: [], rejected: [], envelope: {},
    });
    const config = { ...VALID_CONFIG, subject: 'Hello\rWorld' };
    const node = createNodeWithAuth(config, sendMail);
    await node.run(createRunContext(config));

    expect(sendMail.mock.calls[0][0].subject).not.toContain('\r');
  });

  it('should strip LF from subject', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: 'id', accepted: [], rejected: [], envelope: {},
    });
    const config = { ...VALID_CONFIG, subject: 'Hello\nBcc: attacker@evil.com' };
    const node = createNodeWithAuth(config, sendMail);
    await node.run(createRunContext(config));

    // The newline is replaced with a space — injection prevented
    // "Bcc:" remains as harmless plain text within the subject value
    expect(sendMail.mock.calls[0][0].subject).not.toContain('\n');
  });

  it('should strip CRLF from to field', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: 'id', accepted: [], rejected: [], envelope: {},
    });
    const config = { ...VALID_CONFIG, to: 'a@b.com\r\nBcc: x@evil.com' };
    const node = createNodeWithAuth(config, sendMail);
    await node.run(createRunContext(config));

    expect(sendMail.mock.calls[0][0].to).not.toContain('\r\n');
  });
});

// ──────────────────────────────────────────────
// generateInputVariables / generateOutputVariables
// ──────────────────────────────────────────────

describe('SmtpSendEmailNode - variable definitions', () => {
  it('should always include to/subject/body in input variables', async () => {
    const node = createNode({ authIntegrationId: 'id', to: 'a@b.com', subject: 'Hi', body: 'Body' });
    const vars = await node.generateInputVariables();
    const keys = vars.map((v) => v.key);
    expect(keys).toContain('config.to');
    expect(keys).toContain('config.subject');
    expect(keys).toContain('config.body');
  });

  it('should include cc in input variables only when configured', async () => {
    const nodeWithCc = createNode({ ...VALID_CONFIG, cc: 'cc@example.com' });
    const nodeWithout = createNode({ ...VALID_CONFIG });

    const withCcKeys = (await nodeWithCc.generateInputVariables()).map((v) => v.key);
    const withoutKeys = (await nodeWithout.generateInputVariables()).map((v) => v.key);

    expect(withCcKeys).toContain('config.cc');
    expect(withoutKeys).not.toContain('config.cc');
  });

  it('should include bcc in input variables only when configured', async () => {
    const node = createNode({ ...VALID_CONFIG, bcc: 'b@b.com' });
    const vars = await node.generateInputVariables();
    const keys = vars.map((v) => v.key);
    expect(keys).toContain('config.bcc');
  });

  it('should include success/messageId/accepted/rejected in output variables', async () => {
    const node = createNode();
    const vars = await node.generateOutputVariables();
    const keys = vars.map((v) => v.key);
    expect(keys).toContain('success');
    expect(keys).toContain('messageId');
    expect(keys).toContain('accepted');
    expect(keys).toContain('rejected');
  });
});

// ──────────────────────────────────────────────
// definition()
// ──────────────────────────────────────────────

describe('SmtpSendEmailNode.definition', () => {
  it('should return correct node id and category', async () => {
    const node = createNode();
    const def = await node.definition();
    expect(def.id).toBe('core.action.send_smtp_email');
    expect(def.category).toBe('action');
  });

  it('should have SelectIntegration field for SMTP account', async () => {
    const node = createNode();
    const def = await node.definition();
    const authField = def.form.find((f: any) => f.model === 'config.authIntegrationId');
    expect(authField).toBeDefined();
    expect(authField?.integrationFilter?.sub_type).toBe('smtp');
  });

  it('should have an output port', async () => {
    const node = createNode();
    const def = await node.definition();
    expect(def.ports).toContainEqual(
      expect.objectContaining({ id: 'output', direction: 'output' }),
    );
  });

  it('should include smtp-related keywords', async () => {
    const node = createNode();
    const def = await node.definition();
    expect(def.keywords).toContain('smtp');
    expect(def.keywords).toContain('email');
  });
});
