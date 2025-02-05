export function maskKnexConfig(payload: Partial<{ config: any }>) {
  /*
    remove password from knex config
  */
  if (
    payload.config &&
    payload.config.connection &&
    payload.config.connection.password
  ) {
    delete payload.config.connection.password;
  }

  return payload;
}
