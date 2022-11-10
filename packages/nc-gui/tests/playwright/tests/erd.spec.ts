import { test } from '@playwright/test';
import {
  mysqlSakilaSqlViews,
  mysqlSakilaTables,
  pgSakilaSqlViews,
  pgSakilaTables,
  sqliteSakilaSqlViews,
} from './utils/sakila';
import { DashboardPage } from '../pages/Dashboard';
import { SettingsSubTab, SettingTab } from '../pages/Dashboard/Settings';
import setup from '../setup';
import { isMysql, isPg, isSqlite } from '../setup/db';
import { SettingsErdPage } from '../pages/Dashboard/Settings/Erd';

test.describe('Erd', () => {
  let dashboard: DashboardPage;
  let context: any;
  let sakilaTables, sakilaSqlViews;

  test.slow();

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);

    if (isPg(context)) {
      sakilaTables = pgSakilaTables;
      sakilaSqlViews = pgSakilaSqlViews;
    } else if (isMysql(context)) {
      sakilaTables = mysqlSakilaTables;
      sakilaSqlViews = mysqlSakilaSqlViews;
    } else if (isSqlite(context)) {
      sakilaTables = mysqlSakilaTables;
      sakilaSqlViews = sqliteSakilaSqlViews;
    }
  });

  const enableMM = async () => {
    await dashboard.settings.selectTab({ tab: SettingTab.ProjectMetadata, subTab: SettingsSubTab.Miscellaneous });
    await dashboard.settings.miscellaneous.clickShowM2MTables();
    await dashboard.settings.selectSubTab({ subTab: SettingsSubTab.ERD });
  };

  const openSettingsErd = async () => {
    await dashboard.gotoSettings();
    await dashboard.settings.selectTab({ tab: SettingTab.ProjectMetadata, subTab: SettingsSubTab.ERD });
  };

  const openErdOfATable = async (tableName: string) => {
    await dashboard.treeView.openTable({ title: tableName });
    await dashboard.grid.toolbar.clickActions();
    await dashboard.grid.toolbar.actions.click('ERD View');
  };

  test('Verify default config, all columns disabled, only PK and FK disabled, Sql views and MM table option, junction table names', async () => {
    await openSettingsErd();
    await enableMM();

    const erd: SettingsErdPage = dashboard.settings.erd;

    await erd.dbClickShowColumnNames();

    if (isPg(context)) {
      await erd.verifyNodesCount(sakilaTables.length);
      await erd.verifyEdgesCount({
        count: 32,
        circleCount: 29,
        rectangleCount: 35,
      });
    } else {
      await erd.verifyNodesCount(mysqlSakilaTables.length);
      await erd.verifyEdgesCount({
        count: 14,
        circleCount: 11,
        rectangleCount: 17,
      });
    }
    for (const tableName of sakilaTables) {
      await erd.verifyNode({ tableName });
    }

    // Verify Actor table
    await erd.verifyColumns({
      tableName: `actor`,
      columns: actorTableColumn,
    });

    // Verify Payment table
    await erd.verifyColumns({
      tableName: `payment`,
      columns: isPg(context) ? pgPaymentTableColumns : mysqlPaymentTableColumns,
    });

    // Disable show column names and pk/fk
    // todo: rerender edges, otherwise some edges wont be rendered
    await erd.clickShowColumnNames();
    await erd.clickShowJunctionTableNames();
    await erd.clickShowJunctionTableNames();

    await erd.verifyColumns({
      tableName: `actor`,
      columns: actorLTARColumns,
    });
    await erd.verifyColumns({
      tableName: `payment`,
      columns: paymentLTARColumns,
    });

    // Enable show column names and disable pk/fk
    await erd.clickShowColumnNames();
    await erd.clickShowPkAndFk();

    await erd.verifyColumns({
      tableName: `actor`,
      columns: actorNonPkFkColumns,
    });
    await erd.verifyColumns({
      tableName: `payment`,
      columns: isPg(context) ? pgPaymentNonPkFkColumns : paymentNonPkFkColumns,
    });

    await erd.clickShowPkAndFk();
    // Verify views
    await erd.clickShowSqlViews();
    if (isPg(context)) {
      await erd.verifyNodesCount(sakilaTables.length + sakilaSqlViews.length);
      await erd.verifyEdgesCount({
        count: 32,
        circleCount: 29,
        rectangleCount: 35,
      });
    } else {
      await erd.verifyNodesCount(sakilaTables.length + sakilaSqlViews.length);
      await erd.verifyEdgesCount({
        count: 14,
        circleCount: 11,
        rectangleCount: 17,
      });
    }

    for (const tableName of [...sakilaTables, ...sakilaSqlViews]) {
      await erd.verifyNode({ tableName });
    }

    // Verify ActorInfo SQL View
    await erd.verifyColumns({
      tableName: `sales_by_store`,
      columns: salesByStoreColumns,
    });

    await erd.clickShowSqlViews(); // disable sql views

    await erd.verifyNodeDoesNotExist({ tableName: `store` });

    // // Verify MM tables
    await erd.clickShowMMTables();
    await erd.clickShowJunctionTableNames();
    await erd.clickShowJunctionTableNames();

    await erd.verifyNodesCount(isPg(context) ? 21 : 16);
    await erd.verifyEdgesCount({
      count: isPg(context) ? 44 : 26,
      circleCount: isPg(context) ? 40 : 22,
      rectangleCount: isPg(context) ? 48 : 30,
    });

    await erd.verifyNode({ tableName: `store` });

    // Verify show junction table names
    await erd.clickShowJunctionTableNames();
    await erd.verifyJunctionTableLabel({
      tableName: `film_actor`,
      tableTitle: 'filmactor',
    });
  });

  test('Verify ERD Table view, and verify column operations are reflected to the ERD view', async () => {
    await openErdOfATable('Country');
    const erd = dashboard.grid.toolbar.actions.erd;

    // Verify tables with default config
    await erd.verifyColumns({
      tableName: `country`,
      columns: ['country_id', 'country', 'last_update', 'city_list'],
    });

    await erd.verifyColumns({
      tableName: `city`,
      columns: ['city_id', 'city', 'country_id', 'last_update', 'country', 'address_list'],
    });

    // Verify with PK/FK disabled
    await erd.clickShowPkAndFk();
    await erd.verifyColumns({
      tableName: `country`,
      columns: ['country', 'last_update', 'city_list'],
    });

    await erd.verifyColumns({
      tableName: `city`,
      columns: ['city', 'last_update', 'country', 'address_list'],
    });

    // Verify with all columns disabled
    await erd.clickShowColumnNames();
    await erd.verifyColumns({ tableName: `country`, columns: ['city_list'] });

    await erd.verifyColumns({
      tableName: `city`,
      columns: ['country', 'address_list'],
    });

    // Enable All columns
    await erd.clickShowColumnNames();

    await erd.close();

    // Add column
    await dashboard.grid.column.create({ title: 'test_column' });
    // Verify in Settings ERD and table ERD
    await openSettingsErd();
    await dashboard.settings.erd.verifyNode({
      tableName: `country`,
      columnName: 'test_column',
    });
    await dashboard.settings.close();

    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.grid.toolbar.clickActions();
    await dashboard.grid.toolbar.actions.click('ERD View');
    await dashboard.grid.toolbar.actions.erd.verifyNode({
      tableName: `country`,
      columnName: 'test_column',
    });
    await dashboard.grid.toolbar.actions.erd.close();

    // Update column
    await dashboard.grid.column.openEdit({ title: 'test_column' });
    await dashboard.grid.column.fillTitle({ title: 'new_test_column' });
    await dashboard.grid.column.save({
      isUpdated: true,
    });
    // Verify in Settings ERD and table ERD
    await openSettingsErd();
    await dashboard.settings.erd.verifyNode({
      tableName: `country`,
      columnName: 'new_test_column',
    });
    await dashboard.settings.close();

    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.grid.toolbar.clickActions();
    await dashboard.grid.toolbar.actions.click('ERD View');
    await dashboard.grid.toolbar.actions.erd.verifyNode({
      tableName: `country`,
      columnName: 'new_test_column',
    });
    await dashboard.grid.toolbar.actions.erd.close();

    // Delete column
    await dashboard.grid.column.delete({ title: 'new_test_column' });
    // Verify in Settings ERD and table ERD
    await openSettingsErd();
    await dashboard.settings.erd.verifyNode({
      tableName: `country`,
      columnNameShouldNotExist: 'new_test_column',
    });
    await dashboard.settings.close();
  });

  test('Verify table operations sync with ERD', async () => {
    await openSettingsErd();
    await dashboard.settings.close();

    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.grid.toolbar.clickActions();
    await dashboard.grid.toolbar.actions.click('ERD View');
    await dashboard.grid.toolbar.actions.erd.verifyNode({
      tableName: `country`,
      columnNameShouldNotExist: 'new_test_column',
    });
    await dashboard.grid.toolbar.actions.erd.close();

    // Create table and verify ERD
    await dashboard.treeView.createTable({ title: 'Test' });
    // Verify in Settings ERD and table ERD
    await openSettingsErd();
    await dashboard.settings.erd.verifyNode({
      tableName: `Test`,
    });
    await dashboard.settings.close();

    // Delete table and verify ERD
    await dashboard.treeView.deleteTable({ title: 'Test' });
    await openSettingsErd();
    await dashboard.settings.erd.verifyNodeDoesNotExist({
      tableName: `Test`,
    });

    // Verify that `show mm table` option disabled will not trigger easter in ERD options
    await dashboard.settings.selectSubTab({ subTab: SettingsSubTab.Miscellaneous });
    await dashboard.settings.miscellaneous.clickShowM2MTables(); // disable
    await dashboard.settings.selectSubTab({ subTab: SettingsSubTab.ERD });
    await dashboard.settings.close();
  });
});

const actorTableColumn = ['actor_id', 'first_name', 'last_name', 'last_update', 'film_list'];

const mysqlPaymentTableColumns = [
  'payment_id',
  'customer_id',
  'staff_id',
  'rental_id',
  'amount',
  'payment_date',
  'last_update',
  'customer',
  'rental',
  'staff',
];

const pgPaymentTableColumns = [
  'payment_id',
  'customer_id',
  'staff_id',
  'rental_id',
  'amount',
  'payment_date',
  'customer',
  'rental',
  'staff',
];

const actorLTARColumns = ['filmactor_list', 'film_list'];

const actorNonPkFkColumns = ['first_name', 'last_name', 'last_update', 'film_list', 'filmactor_list'];

const paymentLTARColumns = ['customer', 'rental', 'staff'];

const pgPaymentNonPkFkColumns = ['amount', 'payment_date', 'customer', 'rental', 'staff'];
const paymentNonPkFkColumns = [...pgPaymentNonPkFkColumns, 'last_update'];

const salesByStoreColumns = ['store', 'manager', 'total_sales'];
