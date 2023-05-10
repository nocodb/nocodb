import { expect, test } from '@playwright/test';
import { Api, TableListType, TableType } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import { SettingsPage, SettingTab } from '../../pages/Dashboard/Settings';
import { deepCompare } from '../utils/objectCompareUtil';
import setup from '../../setup';
import { ProjectInfoApiUtil, TableInfo } from '../utils/projectInfoApiUtil';

test.describe('Table Operations', () => {
  let dashboard: DashboardPage, settings: SettingsPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.project);
    settings = dashboard.settings;
  });

  test('Create, and delete table, verify in audit tab, rename City table, update icon and reorder tables', async () => {
    await dashboard.treeView.createTable({ title: 'tablex' });
    await dashboard.treeView.verifyTable({ title: 'tablex' });

    await dashboard.treeView.deleteTable({ title: 'tablex' });
    await dashboard.treeView.verifyTable({ title: 'tablex', exists: false });

    await dashboard.gotoSettings();
    await settings.selectTab({ tab: SettingTab.Audit });
    await settings.audit.verifyRow({
      index: 0,
      opType: 'TABLE',
      opSubtype: 'DELETE',
      user: 'user@nocodb.com',
    });
    await settings.audit.verifyRow({
      index: 1,
      opType: 'TABLE',
      opSubtype: 'CREATE',
      user: 'user@nocodb.com',
    });
    await settings.close();

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
    await dashboard.treeView.changeTableIcon({ title: 'Address', icon: 'american-football' });
    await dashboard.treeView.verifyTabIcon({ title: 'Address', icon: 'american-football' });
  });

  test.only('duplicate_table', async () => {
    const orginalTableName = 'Actor';
    const dupTableName = 'Actor copy';
    // verify table icon customization
    await dashboard.treeView.duplicateTable(orginalTableName, true, true);
    await dashboard.treeView.verifyTable({ title: dupTableName });
    // let projectInfoApiUtil: ProjectInfoApiUtil = new ProjectInfoApiUtil(context.token);
    // let orginalTable: Promise<TableInfo> = projectInfoApiUtil.extractTableInfo(context.project_id, 'Address');
    // let duplicateTable: Promise<TableInfo> = await this.api.dbTable.list(projectId);.extractTableInfo(context.project_id, 'Address copy');
    const api: Api<any> = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
    const tables: TableListType = await api.dbTable.list(context.project.id);
    const orginalTable: TableType = await tables.list.filter(t => t.title === orginalTableName)[0];
    const duplicateTable: TableType = await tables.list.filter(t => t.title === dupTableName)[0];
    expect(
      deepCompare(
        orginalTable,
        duplicateTable,
        undefined,
        new Set([
          '.id',
          '.id.base_id.project_id.table_name',
          '.id.base_id.project_id.table_name.title',
          '.id.base_id.project_id.table_name.title.type.meta.schema.enabled.mm.tags.pinned.deleted.order',
          '.id.base_id.project_id.table_name.title.type.meta.schema.enabled.mm.tags.pinned.deleted.order.created_at',
          '.id.base_id.project_id.table_name.title.type.meta.schema.enabled.mm.tags.pinned.deleted.order.created_at.updated_at',
        ])
      )
    ).toBeTruthy();
    // check individual field values where values does not match as per design
  });

  test.only('duplicate_table_with_no_data_views', async () => {
    const orginalTableName = 'Actor';
    const dupTableName = 'Actor copy';
    // verify table icon customization
    await dashboard.treeView.duplicateTable(orginalTableName, false, false);
    await dashboard.treeView.verifyTable({ title: dupTableName });
    // let projectInfoApiUtil: ProjectInfoApiUtil = new ProjectInfoApiUtil(context.token);
    // let orginalTable: Promise<TableInfo> = projectInfoApiUtil.extractTableInfo(context.project_id, 'Address');
    // let duplicateTable: Promise<TableInfo> = await this.api.dbTable.list(projectId);.extractTableInfo(context.project_id, 'Address copy');
    const api: Api<any> = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
    const tables: TableListType = await api.dbTable.list(context.project.id);
    const orginalTable: TableType = await tables.list.filter(t => t.title === orginalTableName)[0];
    const duplicateTable: TableType = await tables.list.filter(t => t.title === dupTableName)[0];
    const p: ProjectInfoApiUtil = new ProjectInfoApiUtil(context.token);
    const orginalTableInfo: TableInfo = await p.extractTableInfo(orginalTable, context.project.id);
    const duplicateTableInfo: TableInfo = await p.extractTableInfo(duplicateTable, context.project.id);
    expect(
      deepCompare(
        orginalTableInfo,
        duplicateTableInfo,
        new Set(['created_at']),
        new Set([
          '.table.id',
          '.table.id.base_id.project_id.table_name',
          '.table.id.base_id.project_id.table_name.title',
          '.table.id.base_id.project_id.table_name.title.type.meta.schema.enabled.mm.tags.pinned.deleted.order',
          '.table.id.base_id.project_id.table_name.title.type.meta.schema.enabled.mm.tags.pinned.deleted.order.created_at',
          '.table.id.base_id.project_id.table_name.title.type.meta.schema.enabled.mm.tags.pinned.deleted.order.created_at.updated_at',
          '.table.shares.views.0.view.filters.sorts.firstPageData',
          '.table.shares.views.webhooks.firstPageData.list.pageInfo.totalRows',
          '.table.shares.views.0.view.ptn',
          '.table.id.base_id.project_id.table_name.title.type.meta.schema.enabled.mm.tags.pinned.deleted.order.updated_at',
          '.table.shares.views.0.view.ptn._ptn',
          '.table.shares.views.0.view.ptn._ptn.ptype.tn',
          '.table.shares.views.0.view.ptn._ptn.ptype.tn._tn',
          '.table.shares.views.0.view.ptn._ptn.ptype.tn._tn.table_meta.id',
          '.table.shares.views.0.view.ptn._ptn.ptype.tn._tn.table_meta.id.base_id.project_id.fk_model_id',
          '.table.shares.views.0.view.ptn._ptn.ptype.tn._tn.table_meta.id.base_id.project_id.fk_model_id.title',
          '.table.shares.views.0.view.ptn._ptn.ptype.tn._tn.table_meta.id.base_id.project_id.fk_model_id.title.type.is_default.show_system_fields.lock_type.uuid.password.show.order.updated_at',
          '.table.shares.views.0.view.ptn._ptn.ptype.tn._tn.table_meta.id.base_id.project_id.fk_model_id.title.type.is_default.show_system_fields.lock_type.uuid.password.show.order.updated_at.meta.description.view.fk_view_id',
          '.table.shares.views.0.view.ptn._ptn.ptype.tn._tn.table_meta.id.base_id.project_id.fk_model_id.title.type.is_default.show_system_fields.lock_type.uuid.password.show.order.updated_at.meta.description.view.fk_view_id.base_id.project_id.uuid.updated_at',
          '.table.shares.views.webhooks.firstPageData.list.pageInfo.totalRows.page.pageSize.isFirstPage.isLastPage',

          // Mismatch length key:
          '.table.shares.views.webhooks.firstPageData.list',
        ])
      )
    ).toBeTruthy();
  });
  // check individual field values where values does not match as per design
});
