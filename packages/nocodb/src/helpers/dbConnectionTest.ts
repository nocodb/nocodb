import { dbTargetFields } from '~/helpers/validateDbConnectionHost';

/** What a test may override on a stored connection; mirrors Source.getConfig. */
export function sourceOverridesOnly(body: any): Record<string, any> {
  const override: Record<string, any> = {};

  if (body?.connection?.database !== undefined) {
    override.connection = { database: body.connection.database };
  }
  if (body?.searchPath !== undefined) override.searchPath = body.searchPath;

  return override;
}

export const SAVED_CONNECTION_OVERRIDE_MESSAGE =
  'Only the database and schema can be overridden when testing a saved connection';

/** True when a test body sets a client or target field the stored config doesn't have. */
export function overridesDbTarget(stored: any, body: any): boolean {
  if (body?.client !== undefined && body.client !== stored?.client) return true;

  const storedFields = dbTargetFields(stored);
  return Object.entries(dbTargetFields(body)).some(
    ([key, value]) => storedFields[key] !== value,
  );
}

export const CONNECTION_TEST_FAILED_MESSAGE =
  'Unable to connect to the database. Check the connection details and try again.';

// Safe categories for a failed test; matched against the driver error here,
// never echoed back.
const CONNECTION_TEST_CATEGORIES: {
  message: string;
  codes: RegExp;
  text: RegExp;
}[] = [
  {
    message:
      'SSL/TLS negotiation failed. Check the SSL settings and certificates.',
    codes: /CERT|^EPROTO$|^ERR_(SSL|TLS)_|HOSTNAME_MISMATCH/,
    text: /\b(ssl|tls)\b|certificate|self[- ]signed|handshake/i,
  },
  {
    message:
      'Database not found or not accessible. Check the database name and permissions.',
    codes: /^(3D000|ER_BAD_DB_ERROR|ER_DBACCESS_DENIED_ERROR|ORA-12514)$/,
    text: /database .* does not exist|unknown database|cannot open database|ORA-12514|does not exist or not authorized|access denied for user .* to database/i,
  },
  {
    message: 'Authentication failed. Check the username and password.',
    codes: /^(28P01|28000|ELOGIN|ER_ACCESS_DENIED_ERROR|ORA-01017)$/,
    text: /password authentication failed|access denied for user|login failed|authentication failed|invalid username\/password|ORA-01017|incorrect username or password|invalid (access )?token/i,
  },
  {
    message:
      'Unable to reach the database host. Check the host, port and network access.',
    codes:
      /^(ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|ECONNRESET|EAI_AGAIN|EPIPE|ESOCKET|ETIMEOUT)$/,
    text: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|ECONNRESET|EAI_AGAIN|time(d)? ?out|could not connect|failed to connect|connection (lost|refused|terminated)|socket hang up|getaddrinfo|ORA-12170|ORA-12541|NJS-5\d\d/i,
  },
];

// What the UI's SSL auto-fix keys on (nc-gui utils/baseCreateUtils.ts).
const SSL_HINT_CODES = new Set([
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  '28000',
  '08P01',
]);
const SSL_HINT_MESSAGES = [
  'unable to get local issuer certificate',
  'self signed certificate in certificate chain',
  'SSL is required',
  'The server does not support SSL connections',
];

/** A connection-test failure as a safe category, without the driver's text. */
export function genericConnectionTestError(
  message?: unknown,
  code?: unknown,
): { message: string; sql_code?: string } {
  const text = typeof message === 'string' ? message : '';
  const errorCode = typeof code === 'string' ? code : '';
  const lower = text.toLowerCase();

  const hint = SSL_HINT_MESSAGES.find((h) => lower.includes(h.toLowerCase()));
  const category =
    CONNECTION_TEST_CATEGORIES.find(
      (c) => errorCode && c.codes.test(errorCode),
    ) ?? CONNECTION_TEST_CATEGORIES.find((c) => c.text.test(text));

  return {
    message: hint ?? category?.message ?? CONNECTION_TEST_FAILED_MESSAGE,
    sql_code: SSL_HINT_CODES.has(errorCode) ? errorCode : undefined,
  };
}
