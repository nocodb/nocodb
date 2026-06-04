// Reads the major version preset on the knex client by
// NcConnectionMgrv2.stashDbMajorVersion (from `source.meta.dbVersion`).
// Returns 0 when absent — callers should treat 0 as "use the broadest-
// compatibility path".
export const getDbMajor = (knex: any): number =>
  knex?.client?.config?.nocoDbMajorVersion ?? 0;
