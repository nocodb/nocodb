import { SSLUsage } from './enums';
import { buildSqlAuthSsl } from './connectionConfigUtils';
import {
  combinedSubTypeForClient,
  dataSourceClientOf,
  isCombinedDataSourceIntegration,
  isDataSourceIntegration,
  isMssqlStrictEncrypt,
  knexConfigFromSqlAuthConfig,
  sqlAuthConfigFromKnexConfig,
  sqlAuthExtraConnectionParams,
  supportsDataSourceUse,
} from './dataSourceIntegrationUtils';

const combined = {
  type: 'auth',
  sub_type: 'postgres',
  meta: { dataSource: true },
};

describe('combined data-source integrations', () => {
  it('new postgres, mysql and mssql auth rows are created combined', () => {
    expect(supportsDataSourceUse('auth', 'postgres')).toBe(true);
    expect(supportsDataSourceUse('auth', 'mysql')).toBe(true);
    expect(supportsDataSourceUse('auth', 'mssql')).toBe(true);
    expect(supportsDataSourceUse('auth', 'oracle')).toBe(false);
    expect(supportsDataSourceUse('database', 'pg')).toBe(false);
    expect(supportsDataSourceUse('sync', 'postgres')).toBe(false);
    expect(combinedSubTypeForClient('pg')).toBe('postgres');
    expect(combinedSubTypeForClient('mysql2')).toBe('mysql');
    expect(combinedSubTypeForClient('mssql')).toBe('mssql');
    expect(combinedSubTypeForClient('sqlite3')).toBe(undefined);
    expect(dataSourceClientOf({ ...combined, sub_type: 'mysql' })).toBe(
      'mysql2'
    );
  });

  it('needs the meta flag — a legacy auth row stays an app connection only', () => {
    expect(isCombinedDataSourceIntegration(combined)).toBe(true);
    expect(
      isCombinedDataSourceIntegration({ type: 'auth', sub_type: 'postgres' })
    ).toBe(false);
    expect(
      isCombinedDataSourceIntegration({
        ...combined,
        meta: JSON.stringify({ dataSource: true }),
      })
    ).toBe(true);
    expect(
      isDataSourceIntegration({ type: 'auth', sub_type: 'postgres', meta: {} })
    ).toBe(false);
  });

  it('legacy database rows remain data sources with their own client', () => {
    const legacy = { type: 'database', sub_type: 'pg' };
    expect(isDataSourceIntegration(legacy)).toBe(true);
    expect(isCombinedDataSourceIntegration(legacy)).toBe(false);
    expect(dataSourceClientOf(legacy)).toBe('pg');
    expect(dataSourceClientOf(combined)).toBe('pg');
  });

  it('maps the flat config to knex with the same SSL as the auth wrapper', () => {
    const flat = {
      host: 'db.example.com',
      port: '6543',
      username: 'u',
      password: { $vault: 'v/secret' },
      database: 'app',
      sslMode: SSLUsage.RequiredWithCa,
      sslCa: '-----BEGIN CERTIFICATE-----x',
    };
    expect(knexConfigFromSqlAuthConfig('pg', flat)).toEqual({
      client: 'pg',
      connection: {
        host: 'db.example.com',
        port: '6543',
        user: 'u',
        password: { $vault: 'v/secret' },
        database: 'app',
        ssl: buildSqlAuthSsl(flat),
      },
    });
    expect(buildSqlAuthSsl(flat)).toEqual({
      ca: '-----BEGIN CERTIFICATE-----x',
      rejectUnauthorized: true,
    });
  });

  it('defaults the port and omits ssl when SSL is off', () => {
    expect(
      knexConfigFromSqlAuthConfig('pg', {
        host: 'h',
        username: 'u',
        password: 'p',
        database: 'd',
        sslMode: SSLUsage.No,
      })
    ).toEqual({
      client: 'pg',
      connection: {
        host: 'h',
        port: 5432,
        user: 'u',
        password: 'p',
        database: 'd',
      },
    });
  });

  it('mysql: default port, no database when unset, same SSL', () => {
    expect(
      knexConfigFromSqlAuthConfig('mysql2', {
        host: 'h',
        username: 'root',
        password: 'p',
        sslMode: SSLUsage.Required,
      })
    ).toEqual({
      client: 'mysql2',
      connection: {
        host: 'h',
        port: 3306,
        user: 'root',
        password: 'p',
        ssl: { rejectUnauthorized: true },
      },
    });
  });

  it('mssql: TLS goes in tedious options, like the auth wrapper', () => {
    expect(
      knexConfigFromSqlAuthConfig('mssql', {
        host: 'h',
        username: 'sa',
        password: 'p',
        database: 'd',
        encrypt: 'false',
        schema: 'sales',
      })
    ).toEqual({
      client: 'mssql',
      connection: {
        host: 'h',
        port: 1433,
        user: 'sa',
        password: 'p',
        database: 'd',
        options: { encrypt: false, trustServerCertificate: true },
      },
      searchPath: ['sales'],
    });
    expect(
      knexConfigFromSqlAuthConfig('mssql', { host: 'h', sslCa: ' CA ' })
        .connection.options
    ).toEqual({
      encrypt: true,
      trustServerCertificate: false,
      cryptoCredentialsDetails: { ca: 'CA' },
    });
  });

  it('client cert/key, schema and extra params reach the connection', () => {
    const cfg = knexConfigFromSqlAuthConfig('pg', {
      host: 'h',
      sslMode: SSLUsage.Required,
      sslCert: 'CERT',
      sslKey: 'KEY',
      schema: ' reporting ',
      extraParams: { application_name: 'nocodb', statement_timeout: '5000' },
    });
    expect(cfg.connection.ssl).toEqual({
      cert: 'CERT',
      key: 'KEY',
      rejectUnauthorized: true,
    });
    expect(cfg.searchPath).toEqual(['reporting']);
    expect(cfg.connection.application_name).toBe('nocodb');
    expect(cfg.connection.statement_timeout).toBe('5000');
    // mysql has no schema
    expect(
      knexConfigFromSqlAuthConfig('mysql2', { schema: 'x' }).searchPath
    ).toBe(undefined);
  });

  it('extra params cannot change the target or the credentials', () => {
    const extraParams = {
      host: 'evil',
      connectionString: 'postgres://evil/db',
      socketPath: '/tmp/s',
      password: 'x',
      ssl: 'false',
      keepAlive: 'true',
    };
    expect(sqlAuthExtraConnectionParams({ extraParams })).toEqual({
      keepAlive: 'true',
    });
    const cfg = knexConfigFromSqlAuthConfig('pg', {
      host: 'real',
      extraParams,
    });
    expect(cfg.connection.host).toBe('real');
    expect(cfg.connection.connectionString).toBe(undefined);
    expect(cfg.connection.socketPath).toBe(undefined);
  });

  it('maps a parsed connection URL back to the flat fields', () => {
    expect(
      sqlAuthConfigFromKnexConfig({
        client: 'pg',
        connection: {
          host: 'db.example.com',
          port: 6543,
          user: 'u',
          password: 'p',
          database: 'app',
          ssl: true,
          application_name: 'x',
        },
      })
    ).toEqual({
      host: 'db.example.com',
      port: '6543',
      username: 'u',
      password: 'p',
      database: 'app',
      sslMode: SSLUsage.Required,
      extraParams: { application_name: 'x' },
    });
    expect(
      sqlAuthConfigFromKnexConfig({
        client: 'mysql2',
        connection: { host: 'h', port: '3306', user: 'root' },
      })
    ).toEqual({ host: 'h', port: '3306', username: 'root' });
  });

  // The server's URL parser returns query params as top-level strings.
  const mssqlUrl = (params: Record<string, unknown>) =>
    sqlAuthConfigFromKnexConfig({
      client: 'mssql',
      connection: { host: 'h', port: '1433', user: 'u', ...params },
    });

  it('a SQL Server URL sets encrypt / trustServerCertificate, not extra params', () => {
    expect(
      mssqlUrl({ trustServerCertificate: 'false', encrypt: 'yes' })
    ).toEqual({
      host: 'h',
      port: '1433',
      username: 'u',
      encrypt: true,
      trustServerCertificate: false,
    });
    // Any casing, the `options.` prefix, or an `options` JSON object.
    expect(mssqlUrl({ TrustServerCertificate: 'False' })).toMatchObject({
      trustServerCertificate: false,
    });
    expect(
      mssqlUrl({
        'options.trustServerCertificate': '0',
        'options.encrypt': '1',
      })
    ).toMatchObject({ trustServerCertificate: false, encrypt: true });
    expect(
      mssqlUrl({ options: '{"trustServerCertificate":false,"encrypt":true}' })
    ).toMatchObject({ trustServerCertificate: false, encrypt: true });
    expect(
      mssqlUrl({ options: { trustServerCertificate: 'no' } })
    ).toMatchObject({ trustServerCertificate: false });
  });

  it.each([
    ['true', true],
    ['TRUE', true],
    ['yes', true],
    ['1', true],
    ['false', false],
    ['no', false],
    ['0', false],
    [false, false],
  ])('reads SQL Server URL value %j as %j', (value, expected) => {
    const cfg = mssqlUrl({ trustServerCertificate: value });
    expect(cfg.trustServerCertificate).toBe(expected);
    expect(cfg.extraParams).toBe(undefined);
  });

  it('keeps a SQL Server value it cannot read visible in extra params, never a guess', () => {
    const cfg = mssqlUrl({ trustServerCertificate: 'maybe' });
    expect(cfg.trustServerCertificate).toBe(undefined);
    expect(cfg.extraParams).toEqual({ trustServerCertificate: 'maybe' });
  });

  it.each([
    [{ encrypt: 'strict' }, { encrypt: 'strict' }],
    [{ Encrypt: 'Strict' }, { Encrypt: 'Strict' }],
    [{ 'options.encrypt': 'strict' }, { 'options.encrypt': 'strict' }],
  ])(
    'encrypt=strict (TDS 8) stays visible and falls back to plain encryption: %j',
    (params, extraParams) => {
      const cfg = mssqlUrl(params);
      expect(cfg.extraParams).toEqual(extraParams);
      // Not supported yet: the connection encrypts, without strict mode.
      expect(cfg.encrypt).toBe(true);
      expect(
        knexConfigFromSqlAuthConfig('mssql', cfg).connection.options
      ).toMatchObject({
        encrypt: true,
      });
    }
  );

  it('reports encrypt=strict to the form, wherever the URL put it', () => {
    expect(isMssqlStrictEncrypt(mssqlUrl({ encrypt: 'strict' }))).toBe(true);
    expect(isMssqlStrictEncrypt(mssqlUrl({ Encrypt: 'Strict' }))).toBe(true);
    // `options` is not an extra parameter, so its strict is added as one.
    const fromOptions = mssqlUrl({ options: '{"encrypt":"strict"}' });
    expect(fromOptions.extraParams).toEqual({ 'options.encrypt': 'strict' });
    expect(fromOptions.encrypt).toBe(true);
    expect(isMssqlStrictEncrypt(fromOptions)).toBe(true);
    expect(isMssqlStrictEncrypt(mssqlUrl({ encrypt: 'yes' }))).toBe(false);
    expect(isMssqlStrictEncrypt(mssqlUrl({}))).toBe(false);
    expect(
      isMssqlStrictEncrypt({ extraParams: { application_name: 'strict' } })
    ).toBe(false);
  });

  it('only SQL Server has these fields', () => {
    expect(
      sqlAuthConfigFromKnexConfig({
        client: 'pg',
        connection: { host: 'h', user: 'u', trustServerCertificate: 'false' },
      })
    ).toEqual({
      host: 'h',
      username: 'u',
      extraParams: { trustServerCertificate: 'false' },
    });
  });
});
