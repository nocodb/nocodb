// Anything here reaches a base VIEWER on integration/source read, so it must
// cover every credential the connection can carry — not just `password`.
const MASKED_CONNECTION_KEYS = [
  'password',
  // a DSN embeds the password in the URI
  'connectionString',
  'connectionUri',
  'uri',
  'url',
];

// `ssl.key` is the client-certificate PRIVATE key; ca/cert/pfx are the rest of
// the keypair material.
const MASKED_SSL_KEYS = ['key', 'cert', 'ca', 'pfx', 'passphrase'];

export function maskKnexConfig(payload: Partial<{ config: any }>) {
  const connection = payload.config?.connection;

  if (!connection) return payload;

  for (const key of MASKED_CONNECTION_KEYS) {
    if (connection[key]) connection[key] = null;
  }

  // `ssl` is `true`/`false` or a string in some configs — only an object holds
  // key material.
  if (connection.ssl && typeof connection.ssl === 'object') {
    for (const key of MASKED_SSL_KEYS) {
      if (connection.ssl[key]) connection.ssl[key] = null;
    }
  }

  return payload;
}
