import * as nc_001_add_type_to_project from './v3/nc_001_add_type_to_project';
import * as nc_002_create_books from './v3/nc_002_create_books';
import * as nc_003_workspace from './v3/nc_003_workspace';
import * as nc_004_profile_account from './v3/nc_004_profile_account';
import * as nc_005_cowriter from './v3/nc_005_cowriter';
import * as nc_006_shared_erd from './v3/nc_006_shared_erd';

// Create a custom migration source class
export default class XcMigrationSourcev3 {
  // Must return a Promise containing a list of migrations.
  // Migrations can be whatever you want, they will be passed as
  // arguments to getMigrationName and getMigration
  public getMigrations(): Promise<any> {
    // In this run we are just returning migration names
    return Promise.resolve([
      'nc_001_add_type_to_project',
      'nc_002_create_books',
      'nc_003_workspace',
      'nc_004_profile_account',
      'nc_005_cowriter',
      'nc_006_shared_erd',
    ]);
  }

  public getMigrationName(migration): string {
    return migration;
  }

  public getMigration(migration): any {
    switch (migration) {
      case 'nc_001_add_type_to_project':
        return nc_001_add_type_to_project;
      case 'nc_002_create_books':
        return nc_002_create_books;
      case 'nc_003_workspace':
        return nc_003_workspace;
      case 'nc_004_profile_account':
        return nc_004_profile_account;
      case 'nc_005_cowriter':
        return nc_005_cowriter;
      case 'nc_006_shared_erd':
        return nc_006_shared_erd;
    }
  }
}
