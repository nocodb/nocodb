interface PostgresAuthConfig {
  host: string;
  port?: number;
  username: string;
  password: string;
  database: string;
  ssl?: string | boolean;
  connectionLimit?: number;
  schema?: string;
}

export {
  PostgresAuthConfig
}