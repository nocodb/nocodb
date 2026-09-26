import { DB_CREDENTIAL_FIELDS, isSecretRef } from 'nocodb-sdk';

// Declared once in the SDK so masking, the vault write guard and the form's
// vault picker agree on which connection fields are credentials. Anything
// masked here reaches a base VIEWER on integration/source read.
const MASKED_CONNECTION_KEYS = DB_CREDENTIAL_FIELDS.filter(
  (field) => field.mask && field.path.length === 2,
).map((field) => field.path[1]);

const MASKED_SSL_KEYS = DB_CREDENTIAL_FIELDS.filter(
  (field) => field.mask && field.path.length === 3 && field.path[1] === 'ssl',
).map((field) => field.path[2]);

export function maskKnexConfig(payload: Partial<{ config: any }>) {
  const connection = payload.config?.connection;

  if (!connection) return payload;

  // A vault reference is a POINTER, not a credential — it names where the
  // value lives and carries none of it. Nulling it would break
  // the feature two ways: the client could not tell a vault-backed field from a
  // blank one, and the edit form's read-then-save round-trip would write the
  // null back over the reference. No-op in CE, where no reference exists.
  for (const key of MASKED_CONNECTION_KEYS) {
    if (connection[key] && !isSecretRef(connection[key])) {
      connection[key] = null;
    }
  }

  // `ssl` is `true`/`false` or a string in some configs — only an object holds
  // key material.
  if (connection.ssl && typeof connection.ssl === 'object') {
    for (const key of MASKED_SSL_KEYS) {
      if (connection.ssl[key] && !isSecretRef(connection.ssl[key])) {
        connection.ssl[key] = null;
      }
    }
  }

  return payload;
}
