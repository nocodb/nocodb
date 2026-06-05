interface MssqlAuthConfig {
  host: string;
  port?: number;
  username: string;
  password: string;
  database: string;
  /** Encrypt the connection (TLS). Defaults to true. */
  encrypt?: string | boolean;
  /** Trust a self-signed server certificate. Defaults to true. */
  trustServerCertificate?: string | boolean;
  connectionLimit?: number;
  schema?: string;
}

export { MssqlAuthConfig };
