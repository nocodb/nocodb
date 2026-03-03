import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmtpAuthIntegration } from '../src/integration';
import { AuthType } from '@noco-integrations/core';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const BASE_CONFIG = {
  type: AuthType.ApiKey,
  host: 'smtp.example.com',
  port: 587,
  encryption: 'tls' as const,
  allowSelfSigned: false,
  username: 'apikey',
  password: 'secret',
  fromEmail: 'noreply@acme.com',
  fromName: 'Acme',
};

function createIntegration(config = BASE_CONFIG): SmtpAuthIntegration {
  return new SmtpAuthIntegration(config as any, { logger: () => {} });
}

// ──────────────────────────────────────────────
// authenticate()
// ──────────────────────────────────────────────

describe('SmtpAuthIntegration.authenticate', () => {
  it('should create a nodemailer transporter', async () => {
    const integration = createIntegration();
    const transporter = await integration.authenticate();
    expect(transporter).toBeDefined();
    expect(typeof transporter.sendMail).toBe('function');
    expect(typeof transporter.verify).toBe('function');
  });

  it('should set secure=false for TLS (STARTTLS)', async () => {
    const integration = createIntegration({ ...BASE_CONFIG, encryption: 'tls' });
    // Access internal transporter options — Nodemailer exposes via transporter.options
    const transporter = await integration.authenticate();
    const opts = (transporter as any).options;
    expect(opts.secure).toBe(false);
    expect(opts.requireTLS).toBe(true);
  });

  it('should set secure=true for SSL', async () => {
    const integration = createIntegration({ ...BASE_CONFIG, encryption: 'ssl', port: 465 });
    const transporter = await integration.authenticate();
    const opts = (transporter as any).options;
    expect(opts.secure).toBe(true);
    expect(opts.requireTLS).toBeFalsy();
  });

  it('should set secure=false and requireTLS=false for none', async () => {
    const integration = createIntegration({ ...BASE_CONFIG, encryption: 'none', port: 25 });
    const transporter = await integration.authenticate();
    const opts = (transporter as any).options;
    expect(opts.secure).toBe(false);
    expect(opts.requireTLS).toBe(false);
  });

  it('should set rejectUnauthorized=true when allowSelfSigned is false', async () => {
    const integration = createIntegration({ ...BASE_CONFIG, allowSelfSigned: false });
    const transporter = await integration.authenticate();
    const opts = (transporter as any).options;
    expect(opts.tls?.rejectUnauthorized).toBe(true);
  });

  it('should set rejectUnauthorized=false when allowSelfSigned is true', async () => {
    const integration = createIntegration({ ...BASE_CONFIG, allowSelfSigned: true });
    const transporter = await integration.authenticate();
    const opts = (transporter as any).options;
    expect(opts.tls?.rejectUnauthorized).toBe(false);
  });
});

// ──────────────────────────────────────────────
// testConnection()
// ──────────────────────────────────────────────

describe('SmtpAuthIntegration.testConnection', () => {
  it('should return success=true when verify() resolves', async () => {
    const integration = createIntegration();

    // Stub authenticate to return transporter with successful verify()
    vi.spyOn(integration, 'authenticate').mockResolvedValue({
      verify: vi.fn().mockResolvedValue(true),
    } as any);

    const result = await integration.testConnection();
    expect(result.success).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it('should return success=false with message when verify() throws ECONNREFUSED', async () => {
    const integration = createIntegration();
    const err = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });

    vi.spyOn(integration, 'authenticate').mockResolvedValue({
      verify: vi.fn().mockRejectedValue(err),
    } as any);

    const result = await integration.testConnection();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Connection refused');
    expect(result.message).toContain('smtp.example.com');
    expect(result.message).toContain('587');
  });

  it('should return friendly message for ETIMEDOUT', async () => {
    const integration = createIntegration();
    const err = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });

    vi.spyOn(integration, 'authenticate').mockResolvedValue({
      verify: vi.fn().mockRejectedValue(err),
    } as any);

    const result = await integration.testConnection();
    expect(result.success).toBe(false);
    expect(result.message).toContain('timed out');
  });

  it('should return friendly message for ENOTFOUND', async () => {
    const integration = createIntegration({ ...BASE_CONFIG, host: 'bad-host.invalid' });
    const err = Object.assign(new Error('getaddrinfo ENOTFOUND bad-host.invalid'), { code: 'ENOTFOUND' });

    vi.spyOn(integration, 'authenticate').mockResolvedValue({
      verify: vi.fn().mockRejectedValue(err),
    } as any);

    const result = await integration.testConnection();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Host not found');
    expect(result.message).toContain('bad-host.invalid');
  });

  it('should return friendly message for ESOCKET (TLS error)', async () => {
    const integration = createIntegration();
    const err = Object.assign(new Error('socket error'), { code: 'ESOCKET' });

    vi.spyOn(integration, 'authenticate').mockResolvedValue({
      verify: vi.fn().mockRejectedValue(err),
    } as any);

    const result = await integration.testConnection();
    expect(result.success).toBe(false);
    expect(result.message).toContain('TLS');
  });

  it('should return friendly message for 535 auth failure', async () => {
    const integration = createIntegration();
    const err = new Error('535 5.7.8 Username and Password not accepted');

    vi.spyOn(integration, 'authenticate').mockResolvedValue({
      verify: vi.fn().mockRejectedValue(err),
    } as any);

    const result = await integration.testConnection();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Authentication failed');
  });

  it('should return friendly message for 534 auth error', async () => {
    const integration = createIntegration();
    const err = new Error('534 5.7.9 Application-specific password required');

    vi.spyOn(integration, 'authenticate').mockResolvedValue({
      verify: vi.fn().mockRejectedValue(err),
    } as any);

    const result = await integration.testConnection();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Authentication');
  });

  it('should fall back to raw error message for unknown errors', async () => {
    const integration = createIntegration();
    const err = new Error('Something completely unexpected happened');

    vi.spyOn(integration, 'authenticate').mockResolvedValue({
      verify: vi.fn().mockRejectedValue(err),
    } as any);

    const result = await integration.testConnection();
    expect(result.success).toBe(false);
    expect(result.message).toBe('Something completely unexpected happened');
  });
});

// ──────────────────────────────────────────────
// shouldRefreshToken()
// ──────────────────────────────────────────────

describe('SmtpAuthIntegration.shouldRefreshToken', () => {
  it('should always return false — SMTP has no token refresh', () => {
    const integration = createIntegration();
    // Access protected method via cast
    expect((integration as any).shouldRefreshToken(new Error('401'))).toBe(false);
    expect((integration as any).shouldRefreshToken(new Error('token expired'))).toBe(false);
    expect((integration as any).shouldRefreshToken(null)).toBe(false);
  });
});

// ──────────────────────────────────────────────
// config shape
// ──────────────────────────────────────────────

describe('SmtpAuthIntegration - config', () => {
  it('should expose config properties correctly', () => {
    const integration = createIntegration();
    expect(integration.config.host).toBe('smtp.example.com');
    expect(integration.config.port).toBe(587);
    expect(integration.config.fromEmail).toBe('noreply@acme.com');
    expect(integration.config.fromName).toBe('Acme');
  });

  it('should work without optional fromName', () => {
    const integration = createIntegration({ ...BASE_CONFIG, fromName: undefined });
    expect(integration.config.fromName).toBeUndefined();
  });
});
