import nodemailer from 'nodemailer';
import { AuthIntegration } from '@noco-integrations/core';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { TestConnectionResponse } from '@noco-integrations/core';
import type { SmtpAuthConfig } from './types';

export class SmtpAuthIntegration extends AuthIntegration<
  SmtpAuthConfig,
  Transporter<SMTPTransport.SentMessageInfo>
> {
  public async authenticate(): Promise<
    Transporter<SMTPTransport.SentMessageInfo>
  > {
    const { host, port, encryption, username, password, allowSelfSigned } =
      this.config;

    const secure = encryption === 'ssl'; // TLS on connect (port 465)
    const requireTLS = encryption === 'tls'; // STARTTLS upgrade (port 587)

    this.client = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: { user: username, pass: password },
      tls: { rejectUnauthorized: !allowSelfSigned },
    });

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const transporter = await this.authenticate();
      // verify() opens a TCP connection and runs EHLO/AUTH — no email sent
      await transporter.verify();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: this.friendlyError(error),
      };
    }
  }

  // SMTP is stateless per-send — no token refresh needed
  protected shouldRefreshToken(_err: any): boolean {
    return false;
  }

  private friendlyError(error: any): string {
    const code: string = error?.code || '';
    const msg: string = error?.message || 'Unknown error';

    if (code === 'ECONNREFUSED')
      return `Connection refused — check host (${this.config.host}) and port (${this.config.port})`;
    if (code === 'ETIMEDOUT')
      return 'Connection timed out — server may be unreachable or port is blocked by a firewall';
    if (code === 'ENOTFOUND')
      return `Host not found: "${this.config.host}" — check the SMTP hostname`;
    if (code === 'ESOCKET')
      return 'TLS handshake failed — try a different encryption setting or enable "Allow self-signed certificates"';
    if (msg.includes('535') || msg.includes('534'))
      return 'Authentication failed — check your username and password';
    return msg;
  }
}
