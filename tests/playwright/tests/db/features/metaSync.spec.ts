import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import { enableQuickRun, isMysql, isPg, isSqlite, mysqlExec, pgExec, sqliteExec } from '../../../setup/db';
import { MetaDataPage } from '../../../pages/Dashboard/ProjectView/Metadata';

test.describe('Meta sync', () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage;
  let context: NcContext;
  let dbExec;
  let metaData: MetaDataPage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    metaData = dashboard.baseView.dataSources.metaData;

    switch (context.dbType) {
      case 'sqlite':
        dbExec = sqliteExec;
        break;
      case 'mysql':
        dbExec = mysqlExec;
        break;
      case 'pg':
        dbExec = query => pgExec(query, context);
        break;
    }
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Meta sync', async () => {
    test.setTimeout(process.env.CI ? 100000 : 70000);

    await dashboard.baseView.tab_dataSources.click();
    await dashboard.baseView.dataSources.openMetaSync({ rowIndex: 0 });

    await dbExec(`CREATE TABLE table1 (id INT NOT NULL, col1 INT NULL, PRIMARY KEY (id))`);
    await dbExec(`CREATE TABLE table2 (id INT NOT NULL, col1 INT NULL, PRIMARY KEY (id))`);

    await metaData.clickReload();
    await dashboard.rootPage.waitForTimeout(1000);

    await metaData.verifyRow({
      index: isPg(context) ? 21 : 16,
      model: `table1`,
      state: 'New table',
    });
    await metaData.verifyRow({
      index: isPg(context) ? 22 : 17,
      model: `table2`,
      state: 'New table',
    });

    await metaData.sync();
    await metaData.verifyRow({
      index: isPg(context) ? 21 : 16,
      model: 'Table1',
      state: 'No change identified',
    });
    await metaData.verifyRow({
      index: isPg(context) ? 22 : 17,
      model: 'Table2',
      state: 'No change identified',
    });

    if (!isSqlite(context)) {
      // Add relation
      if (isPg(context)) {
        await dbExec(`ALTER TABLE table1 ADD CONSTRAINT fk_idx FOREIGN KEY (id) REFERENCES table2 (id);`);
      } else {
        await dbExec(`ALTER TABLE table1 ADD INDEX fk1_idx (col1 ASC) VISIBLE`);
        await dbExec(
          `ALTER TABLE table1 ADD CONSTRAINT fk1 FOREIGN KEY (col1) REFERENCES table2 (id) ON DELETE NO ACTION ON UPDATE NO ACTION`
        );
      }
      await metaData.clickReload();
      await metaData.verifyRow({
        index: isPg(context) ? 21 : 16,
        model: 'Table1',
        state: 'New relation added',
      });

      //verify after sync
      await metaData.sync();
      await metaData.verifyRow({
        index: isPg(context) ? 21 : 16,
        model: 'Table1',
        state: 'No change identified',
      });

      // Remove relation
      if (isPg(context)) {
        await dbExec(`ALTER TABLE table1 DROP CONSTRAINT fk_idx`);
      } else {
        await dbExec(`ALTER TABLE table1 DROP FOREIGN KEY fk1`);
        await dbExec(`ALTER TABLE table1 DROP INDEX fk1_idx`);
      }
      await metaData.clickReload();
      await metaData.verifyRow({
        index: isPg(context) ? 21 : 16,
        model: 'Table1',
        state: 'Relation removed',
      });

      //verify after sync
      await metaData.sync();
      await metaData.verifyRow({
        index: isPg(context) ? 21 : 16,
        model: 'Table1',
        state: 'No change identified',
      });
    }

    // Add column
    if (isSqlite(context)) {
      await dbExec(`ALTER TABLE table1 ADD COLUMN newCol TEXT NULL`);
    } else if (isMysql(context)) {
      await dbExec(`ALTER TABLE table1 ADD COLUMN newCol VARCHAR(45) NULL AFTER id`);
    } else if (isPg(context)) {
      await dbExec(`ALTER TABLE table1 ADD COLUMN newCol INT`);
    }

    await metaData.clickReload();
    await metaData.verifyRow({
      index: isPg(context) ? 21 : 16,
      model: `Table1`,
      state: 'New column(newCol)',
    });

    //verify after sync
    await metaData.sync();
    await metaData.verifyRow({
      index: isPg(context) ? 21 : 16,
      model: 'Table1',
      state: 'No change identified',
    });

    // Edit column
    if (isSqlite(context)) {
      await dbExec(`ALTER TABLE table1 RENAME COLUMN newCol TO newColName`);
    } else if (isMysql(context)) {
      await dbExec(`ALTER TABLE table1 CHANGE COLUMN newCol newColName VARCHAR(45) NULL DEFAULT NULL`);
    } else if (isPg(context)) {
      await dbExec(`ALTER TABLE table1 RENAME COLUMN newCol TO newColName`);
    }

    await metaData.clickReload();
    await metaData.verifyRow({
      index: isPg(context) ? 21 : 16,
      model: `Table1`,
      state: 'New column(newColName), Column removed(newCol)',
    });

    //verify after sync
    await metaData.sync();
    await metaData.verifyRow({
      index: isPg(context) ? 21 : 16,
      model: 'Table1',
      state: 'No change identified',
    });

    // Delete column
    // todo: Add for sqlite
    if (!isSqlite(context)) {
      await dbExec(`ALTER TABLE table1 DROP COLUMN newColName`);
      await metaData.clickReload();
      await metaData.verifyRow({
        index: isPg(context) ? 21 : 16,
        model: `Table1`,
        state: 'Column removed(newColName)',
      });

      //verify after sync
      await metaData.sync();
      await metaData.verifyRow({
        index: isPg(context) ? 21 : 16,
        model: 'Table1',
        state: 'No change identified',
      });
    }

    // Delete table
    await dbExec(`DROP TABLE table1`);
    await dbExec(`DROP TABLE table2`);
    await metaData.clickReload();
    await metaData.verifyRow({
      index: isPg(context) ? 21 : 16,
      model: `table1`,
      state: 'Table removed',
    });
    await metaData.verifyRow({
      index: isPg(context) ? 22 : 17,
      model: `table2`,
      state: 'Table removed',
    });

    //verify after sync
    await metaData.sync();

    if (isSqlite(context)) {
      await metaData.verifyRow({
        index: 16,
        model: 'CustomerList',
        state: 'No change identified',
      });
      await metaData.verifyRow({
        index: 17,
        model: 'FilmList',
        state: 'No change identified',
      });
    }
    if (isPg(context)) {
      await metaData.verifyRow({
        index: 21,
        model: 'ActorInfo',
        state: 'No change identified',
      });
      await metaData.verifyRow({
        index: 22,
        model: 'CustomerList',
        state: 'No change identified',
      });
    } else if (isMysql(context)) {
      await metaData.verifyRow({
        index: 16,
        model: 'ActorInfo',
        state: 'No change identified',
      });
      await metaData.verifyRow({
        index: 17,
        model: 'CustomerList',
        state: 'No change identified',
      });
    }
  });

  test('Hide, filter, sort', async () => {
    await dbExec(
      `CREATE TABLE table1 (id INT NOT NULL, col1 INT NULL, col2 INT NULL, col3 INT NULL, col4 INT NULL, PRIMARY KEY (id))`
    );
    await dbExec(
      `INSERT INTO table1 (id, col1, col2, col3, col4) VALUES (1,1,1,1,1), (2,2,2,2,2), (3,3,3,3,3), (4,4,4,4,4), (5,5,5,5,5), (6,6,6,6,6), (7,7,7,7,7), (8,8,8,8,8), (9,9,9,9,9);`
    );

    await dashboard.baseView.tab_dataSources.click();
    await dashboard.baseView.dataSources.openMetaSync({ rowIndex: 0 });

    await metaData.clickReload();
    await metaData.sync();
    await metaData.close();

    await dashboard.treeView.openTable({ title: 'Table1' });

    await dashboard.grid.toolbar.clickFields();
    await dashboard.grid.toolbar.fields.click({ title: 'Col2' });
    await dashboard.grid.toolbar.clickFields();

    await dashboard.grid.toolbar.sort.add({
      title: 'Col2',
      ascending: false,
      locallySaved: false,
    });

    await dashboard.grid.toolbar.clickFilter();
    await dashboard.grid.toolbar.filter.add({
      title: 'Col2',
      operation: '>=',
      value: '5',
      locallySaved: false,
    });
    await dashboard.grid.toolbar.clickFilter();

    await dashboard.grid.verifyRowCount({ count: 5 });
  });
});
