import XcMigrationSourcev2CE from 'src/meta/migrations/XcMigrationSourcev2';

export default class XcMigrationSourcev2 extends XcMigrationSourcev2CE {
  public async getMigrations() {
    return (await super.getMigrations()).filter(
      (m) => m !== 'nc_035_add_username_to_users',
    );
  }
}
