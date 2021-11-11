import * as project from '../migrations/nc_001_init';
import * as m2m from '../migrations/nc_002_add_m2m';
import * as fkn from '../migrations/nc_003_add_fkn_column';
import * as viewType from '../migrations/nc_004_add_view_type_column';
import * as viewName from '../migrations/nc_005_add_view_name_column';
import * as nc_006_alter_nc_shared_views from '../migrations/nc_006_alter_nc_shared_views';
import * as nc_007_alter_nc_shared_views_1 from '../migrations/nc_007_alter_nc_shared_views_1';
import * as nc_008_add_nc_shared_bases from '../migrations/nc_008_add_nc_shared_bases';

// Create a custom migration source class
export default class XcMigrationSource {
  // Must return a Promise containing a list of migrations.
  // Migrations can be whatever you want, they will be passed as
  // arguments to getMigrationName and getMigration
  public getMigrations(): Promise<any> {
    // In this example we are just returning migration names
    return Promise.resolve([
      'project',
      'm2m',
      'fkn',
      'viewType',
      'viewName',
      'nc_006_alter_nc_shared_views',
      'nc_007_alter_nc_shared_views_1',
      'nc_008_add_nc_shared_bases'
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
    }
  }
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
