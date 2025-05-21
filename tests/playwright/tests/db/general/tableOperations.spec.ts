import { expect, test } from '@playwright/test';
import { Api, TableListType, TableType } from 'nocodb-sdk';
import { DashboardPage } from '../../../pages/Dashboard';
import { deepCompare } from '../../../tests/utils/objectCompareUtil';
import setup, { unsetup } from '../../../setup';
import { BaseInfoApiUtil, TableInfo } from '../../../tests/utils/baseInfoApiUtil';
import { isEE } from '../../../setup/db';
import { AuditPage } from '../../../pages/Dashboard/ProjectView/Audit';

test.describe('Table Operations', () => {
  let dashboard: DashboardPage, audit: AuditPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    audit = dashboard.baseView.dataSources.audit;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create, and delete table, verify in audit tab, rename City table, update icon and reorder tables', async () => {
    await dashboard.treeView.createTable({ title: 'tablex', baseTitle: context.base.title });
    await dashboard.treeView.verifyTable({ title: 'tablex' });

    await dashboard.treeView.deleteTable({ title: 'tablex' });
    await dashboard.treeView.verifyTable({ title: 'tablex', exists: false });

    // if (!isEE()) {
    //   // Audit logs in clickhouse; locally wont be accessible

    //   await dashboard.treeView.openProject({ title: context.base.title, context });

    //   await dashboard.baseView.tab_dataSources.click();
    //   await dashboard.baseView.dataSources.openAudit({ rowIndex: 0 });

    //   // await dashboard.treeView.baseSettings({ title: context.base.title });
    //   // await dashboard.settings.selectTab({ tab: 'dataSources' });
    //   // await dashboard.settings.dataSources.openAudit({ rowIndex: 0 });

    //   await audit.verifyRow({
    //     index: 0,
    //     opType: 'TABLE',
    //     opSubtype: 'DELETE',
    //     user: `user-${process.env.TEST_PARALLEL_INDEX}@nocodb.com`,
    //   });
    //   await audit.verifyRow({
    //     index: 1,
    //     opType: 'TABLE',
    //     opSubtype: 'CREATE',
    //     user: `user-${process.env.TEST_PARALLEL_INDEX}@nocodb.com`,
    //   });
    //   await audit.close();
    // }

    await dashboard.treeView.renameTable({ title: 'City', newTitle: 'Cityx' });
    await dashboard.treeView.verifyTable({ title: 'Cityx' });

    await dashboard.treeView.focusTable({ title: 'Actor' });
    await dashboard.treeView.verifyTable({ title: 'Actor', index: 0 });
    await dashboard.treeView.reorderTables({
      sourceTable: 'Actor',
      destinationTable: 'Address',
    });
    await dashboard.treeView.verifyTable({ title: 'Address', index: 0 });

    // verify table icon customization
    await dashboard.treeView.openTable({ title: 'Address' });
    await dashboard.treeView.changeTableIcon({ title: 'Address', icon: 'american-football', iconDisplay: '🏈' });
    await dashboard.treeView.verifyTabIcon({ title: 'Address', icon: 'american-football', iconDisplay: '🏈' });
  });

  test.skip('duplicate_table', async () => {
    const orginalTableName = 'Actor';
    const dupTableName = 'Actor copy';
    // verify table icon customization
    await dashboard.treeView.duplicateTable(orginalTableName, true, true);
    await dashboard.treeView.verifyTable({ title: dupTableName });
    // let baseInfoApiUtil: BaseInfoApiUtil = new BaseInfoApiUtil(context.token);
    // let originalTable: Promise<TableInfo> = baseInfoApiUtil.extractTableInfo(context.base_id, 'Address');
    // let duplicateTable: Promise<TableInfo> = await this.api.dbTable.list(baseId);.extractTableInfo(context.base_id, 'Address copy');
    const api: Api<any> = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
    const tables: TableListType = await api.dbTable.list(context.base.id);
    const originalTable: TableType = tables.list.filter(t => t.title === orginalTableName)[0];
    const duplicateTable: TableType = tables.list.filter(t => t.title === dupTableName)[0];
    expect(
      deepCompare(
        originalTable,
        duplicateTable,
        undefined,
        new Set(['.id', '.table_name', '.title', '.order', '.created_at', '.updated_at'])
      )
    ).toBeTruthy();
    // check individual field values where values does not match as per design
  });

  test.skip('duplicate_table_with_no_data_views', async () => {
    const originalTableName = 'Actor';
    const dupTableName = 'Actor copy';
    // verify table icon customization
    await dashboard.treeView.duplicateTable(originalTableName, false, false);
    await dashboard.treeView.verifyTable({ title: dupTableName });
    // let baseInfoApiUtil: BaseInfoApiUtil = new BaseInfoApiUtil(context.token);
    // let originalTable: Promise<TableInfo> = baseInfoApiUtil.extractTableInfo(context.base_id, 'Address');
    // let duplicateTable: Promise<TableInfo> = await this.api.dbTable.list(baseId);.extractTableInfo(context.base_id, 'Address copy');
    const api: Api<any> = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
    const tables: TableListType = await api.dbTable.list(context.base.id);
    const originalTable: TableType = tables.list.filter(t => t.title === originalTableName)[0];
    const duplicateTable: TableType = tables.list.filter(t => t.title === dupTableName)[0];
    const p: BaseInfoApiUtil = new BaseInfoApiUtil(context.token);
    const originalTableInfo: TableInfo = await p.extractTableInfo(originalTable, context.base.id);
    const duplicateTableInfo: TableInfo = await p.extractTableInfo(duplicateTable, context.base.id);
    expect(
      deepCompare(
        originalTableInfo,
        duplicateTableInfo,
        new Set(['created_at']),
        new Set([
          '.table.id',
          '.table.table_name',
          '.table.title',
          '.table.order',
          '.table.created_at',
          '.table.updated_at',
          '.views.0.view.ptn',
          '.views.0.view._ptn',
          '.views.0.view.ptn._ptn',
          '.views.0.view.ptn._ptn.ptype.tn',
          '.views.0.view.tn',
          '.views.0.view._tn',
          '.views.0.view.id',
          '.views.0.view.view.fk_view_id',
          '.views.0.view.view.updated_at',
          '.views.0.view.fk_model_id',
          '.views.0.view.title',
          '.views.0.view.updated_at',
          '.views.0.view.fk_view_id',

          // Mismatch length key:
          '.firstPageData.list',
          '.firstPageData.pageInfo',
          '.views.0.firstPageData',
        ])
      )
    ).toBeTruthy();
  });
  // check individual field values where values does not match as per design
});
