// Neutralized (no-op). This once widened nc_operation_logs.entity_id (meta-DB
// path, when NC_OP_LOG_DB is unset) to fit the retired composite app-page
// permission id. App pages are now first-class nc_app_pages rows with
// base-unique ids that fit the original column width, so the widen is
// unnecessary. The file + its XcMigrationSourcev0 registration are kept (not
// deleted) so knex's validateMigrationList still matches on already-migrated
// DBs. The satellite source (XcMigrationSourceOperationLogs) is likewise a
// no-op now (nc_002_widen_entity_id neutralized).
const up = async () => {};

const down = async () => {};

export { up, down };
