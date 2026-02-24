import type { AuthType } from '@noco-integrations/core';

export interface SmtpAuthConfig {
  type: AuthType;

  /** SMTP server hostname, e.g. "smtp.sendgrid.net" */
  host: string;

  /** SMTP port: 587 (STARTTLS), 465 (SSL), 25 (none) */
  port: number;

  /** Encryption method */
  encryption: 'tls' | 'ssl' | 'none';

  /** Whether to allow self-signed / invalid TLS certificates */
  allowSelfSigned: boolean;

  /** SMTP login username or API key */
  username: string;

  /** SMTP login password or API key secret */
  password: string;

  /** Default "From" email address, e.g. "noreply@acme.com" */
  fromEmail: string;

  /** Default "From" display name, e.g. "Acme Notifications" */
  fromName?: string;
}
