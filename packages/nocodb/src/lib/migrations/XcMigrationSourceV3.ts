
import * as nc_025_add_type_to_project from './v3/nc_025_add_type_to_project';
import * as nc_026_create_books from './v3/nc_026_create_books';
import * as nc_027_workspace from './v3/nc_027_workspace';
import * as nc_030_profile_account from './v3/nc_030_profile_account';
import * as nc_035_cowriter from './v3/nc_035_cowriter';

// Create a custom migration source class
export default class XcMigrationSourcev3 {
  // Must return a Promise containing a list of migrations.
  // Migrations can be whatever you want, they will be passed as
  // arguments to getMigrationName and getMigration
  public getMigrations(): Promise<any> {
    // In this run we are just returning migration names
    return Promise.resolve([
      'nc_025_add_type_to_project',
      'nc_026_create_books',
      'nc_027_workspace',
      'nc_030_profile_account',
      'nc_035_cowriter',
    ]);
  }

  public getMigrationName(migration): string {
    return migration;
  }

  public getMigration(migration): any {
    switch (migration) {
      case 'nc_025_add_type_to_project':
        return nc_025_add_type_to_project;
      case 'nc_026_create_books':
        return nc_026_create_books;
      case 'nc_027_workspace':
        return nc_027_workspace;
      case 'nc_030_profile_account':
        return nc_030_profile_account;
      case 'nc_035_cowriter':
        return nc_035_cowriter;
    }
  }
}
