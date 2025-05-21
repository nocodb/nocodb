import { DriverClient } from './constants';

interface Connection {
  driver?: DriverClient;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?:
    | boolean
    | {
        ca?: string;
        cert?: string;
        key?: string;
        caFilePath?: string;
        certFilePath?: string;
        keyFilePath?: string;
      };
  filename?: string;
}

interface DbConfig {
  client: DriverClient;
  connection: Connection;
  acquireConnectionTimeout?: number;
  useNullAsDefault?: boolean;
  pool?: {
    min?: number;
    max?: number;
    idleTimeoutMillis?: number;
  };
  migrations?: {
    directory?: string;
    tableName?: string;
  };
}

export { DriverClient, Connection, DbConfig };
