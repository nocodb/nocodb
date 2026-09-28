import { DB_CREDENTIAL_FIELDS, isSecretRef } from 'nocodb-sdk';

// Credential fields are declared in the SDK. Masked values reach a base viewer.
const MASKED_CONNECTION_KEYS = DB_CREDENTIAL_FIELDS.filter(
  (field) => field.mask && field.path.length === 2,
).map((field) => field.path[1]);

const MASKED_SSL_KEYS = DB_CREDENTIAL_FIELDS.filter(
  (field) => field.mask && field.path.length === 3 && field.path[1] === 'ssl',
).map((field) => field.path[2]);

export function maskKnexConfig(payload: Partial<{ config: any }>) {
  const connection = payload.config?.connection;

  if (!connection) return payload;

  // A vault reference is a pointer, not a credential, so it is kept — nulling
  // it would let the edit form's read-then-save write null over it.
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
