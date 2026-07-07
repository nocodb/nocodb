// Neutralized (no-op). This migration once widened nc_operation_logs.entity_id
// to varchar(255) to fit the composite app-page permission id `<appId>::<pageId>`.
// That composite id was retired: app pages are now first-class nc_app_pages rows
// whose base-unique ids (`pg…`, 16 chars) fit the original varchar(20). The
// widen is therefore unnecessary; the file + its XcMigrationSource registrations
// are kept (not deleted) so knex's validateMigrationList still matches recorded
// migration names on DBs that already ran it. Fresh DBs no longer widen;
// already-migrated dev DBs keep the harmless wider column.
const up = async () => {};

const down = async () => {};

export { up, down };
