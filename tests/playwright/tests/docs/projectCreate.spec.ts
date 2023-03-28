import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import { GridPage } from '../../pages/Dashboard/Grid';
import setup, { NcProjectType } from '../../setup';
import { Api, UITypes } from 'nocodb-sdk';

let api: Api<any>;

test.describe('Verify shortcuts', () => {
  let dashboard: DashboardPage, grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, projectType: NcProjectType.DOCS });
    dashboard = new DashboardPage(page, context.project);
    grid = dashboard.grid;
  });

  test.only('Verify docs project create', async ({ page }) => {
    console.log('Verify docs project create');
  });
});
