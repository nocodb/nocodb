import * as project from './v1/nc_001_init';
import * as m2m from './v1/nc_002_add_m2m';
import * as fkn from './v1/nc_003_add_fkn_column';
import * as viewType from './v1/nc_004_add_view_type_column';
import * as viewName from './v1/nc_005_add_view_name_column';
import * as nc_006_alter_nc_shared_views from './v1/nc_006_alter_nc_shared_views';
import * as nc_007_alter_nc_shared_views_1 from './v1/nc_007_alter_nc_shared_views_1';
import * as nc_008_add_nc_shared_bases from './v1/nc_008_add_nc_shared_bases';
import * as nc_009_add_model_order from './v1/nc_009_add_model_order';
import * as nc_010_add_parent_title_column from './v1/nc_010_add_parent_title_column';
import * as nc_011_remove_old_ses_plugin from './v1/nc_011_remove_old_ses_plugin';
import * as nc_012_cloud_cleanup from './v1/nc_012_cloud_cleanup';

// Create a custom migration source class
export default class XcMigrationSource {
  // Must return a Promise containing a list of migrations.
  // Migrations can be whatever you want, they will be passed as
  // arguments to getMigrationName and getMigration
  public getMigrations(): Promise<any> {
    // In this run we are just returning migration names
    return Promise.resolve([
      'project',
      'm2m',
      'fkn',
      'viewType',
      'viewName',
      'nc_006_alter_nc_shared_views',
      'nc_007_alter_nc_shared_views_1',
      'nc_008_add_nc_shared_bases',
      'nc_009_add_model_order',
      'nc_010_add_parent_title_column',
      'nc_011_remove_old_ses_plugin',
      'nc_012_cloud_cleanup',
    ]);
  }

  public getMigrationName(migration): string {
    return migration;
  }

  public getMigration(migration): any {
    switch (migration) {
      case 'project':
        return project;
      case 'm2m':
        return m2m;
      case 'fkn':
        return fkn;
      case 'viewType':
        return viewType;
      case 'viewName':
        return viewName;
      case 'nc_006_alter_nc_shared_views':
        return nc_006_alter_nc_shared_views;
      case 'nc_007_alter_nc_shared_views_1':
        return nc_007_alter_nc_shared_views_1;
      case 'nc_008_add_nc_shared_bases':
        return nc_008_add_nc_shared_bases;
      case 'nc_009_add_model_order':
        return nc_009_add_model_order;
      case 'nc_010_add_parent_title_column':
        return nc_010_add_parent_title_column;
      case 'nc_011_remove_old_ses_plugin':
        return nc_011_remove_old_ses_plugin;
      case 'nc_012_cloud_cleanup':
        return nc_012_cloud_cleanup;
    }
  }
}
