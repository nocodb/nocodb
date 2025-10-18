import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';

test.describe('Scripts - Configuration & Settings', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let scriptId: string;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);

    await dashboard.treeView.createScript({
      title: 'Config Test Script',
      baseTitle: context.base.title,
    });

    await dashboard.treeView.openScript({
      title: 'Config Test Script',
      baseTitle: context.base.title,
    });

    await page.waitForTimeout(1000);

    const url = page.url();
    const match = url.match(/\/automations\/([^/]+)/);
    scriptId = match ? match[1] : '';
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Should display config form, collect input, and execute script', async () => {
    // 1. Test text input config - Run and verify config UI appears
    let script = `
const config = input.config({
  title: "Text Input Test",
  description: "Testing text input configuration",
  items: [
    input.config.text('userName', {
      label: 'User Name',
      description: 'Enter your name'
    })
  ]
});

console.log('User Name:', config.userName);
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    // Check if script settings button is visible
    await dashboard.scripts.topbar.verifySettingsButtonVisible();

    // Click settings button to open config panel
    await dashboard.scripts.topbar.clickSettings();

    // Verify config panel is visible
    await dashboard.scripts.configPanel.verifyVisible();
    await dashboard.scripts.configPanel.verifyTitle('Text Input Test');

    // Fill in the text input and save
    await dashboard.scripts.configPanel.fillInput('userName', 'John Doe');
    await dashboard.scripts.configPanel.save();

    // Click Run button to execute script with config
    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    // Verify output shows the config value
    await dashboard.scripts.playground.verifyOutputContains('John Doe');

    // 2. Test number input config - Run and interact
    script = `
const config = input.config({
  title: "Number Input Test",
  description: "Testing number input configuration",
  items: [
    input.config.number('recordLimit', {
      label: 'Record Limit',
      description: 'Maximum number of records'
    })
  ]
});

console.log('Record Limit:', config.recordLimit);
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    // Click settings button to open config panel
    await dashboard.scripts.topbar.clickSettings();

    // Verify config panel and fill number input
    await dashboard.scripts.configPanel.verifyVisible();
    await dashboard.scripts.configPanel.verifyTitle('Number Input Test');
    await dashboard.scripts.configPanel.fillInput('recordLimit', 100);
    await dashboard.scripts.configPanel.save();

    // Click Run button to execute
    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    // Verify output
    await dashboard.scripts.playground.verifyOutputContains('100');

    // 3. Test select dropdown config
    script = `
const config = input.config({
  title: "Select Input Test",
  description: "Testing select dropdown configuration",
  items: [
    input.config.select('priority', {
      label: 'Priority Level',
      description: 'Select priority',
      options: [
        { value: 'high', label: 'High Priority' },
        { value: 'medium', label: 'Medium Priority' },
        { value: 'low', label: 'Low Priority' }
      ]
    })
  ]
});

console.log('Priority:', config.priority);
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    // Open config panel and select option
    await dashboard.scripts.topbar.clickSettings();
    await dashboard.scripts.configPanel.verifyVisible();
    await dashboard.scripts.configPanel.fillInput('priority', 'High Priority');
    await dashboard.scripts.configPanel.save();

    // Run and verify
    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();
    await dashboard.scripts.playground.verifyOutputContains('high');

    // 4. Test table selector config
    script = `
const config = input.config({
  title: "Table Selector Test",
  description: "Testing table selector configuration",
  items: [
    input.config.table('sourceTable', {
      label: 'Source Table',
      description: 'Select the source table'
    })
  ]
});

console.log('Source Table:', config.sourceTable);
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    // Open config panel and select table
    await dashboard.scripts.topbar.clickSettings();
    await dashboard.scripts.configPanel.verifyVisible();
    await dashboard.scripts.configPanel.fillInput('sourceTable', 'Actor');
    await dashboard.scripts.configPanel.save();

    // Run and verify
    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();
    await dashboard.scripts.playground.verifyOutputContains('Source Table');

    // 5. Test view selector config with parentTable
    script = `
const config = input.config({
  title: "View Selector Test",
  description: "Testing view selector configuration",
  items: [
    input.config.table('mainTable', {
      label: 'Main Table',
      description: 'Select the main table'
    }),
    input.config.view('mainView', {
      label: 'Main View',
      description: 'Select the view',
      parentTable: 'mainTable'
    })
  ]
});

console.log('Main Table:', config.mainTable);
console.log('Main View:', config.mainView);
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    // Open config panel and select table first
    await dashboard.scripts.topbar.clickSettings();
    await dashboard.scripts.configPanel.verifyVisible();
    await dashboard.scripts.configPanel.fillInput('mainTable', 'Actor');

    // Then select view (should be enabled after table selection)
    await dashboard.scripts.configPanel.fillInput('mainView', 'Actor');
    await dashboard.scripts.configPanel.save();

    // Run and verify
    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();
    await dashboard.scripts.playground.verifyOutputContains('Main Table');
    await dashboard.scripts.playground.verifyOutputContains('Main View');

    // 6. Test field selector config with parentTable
    script = `
const config = input.config({
  title: "Field Selector Test",
  description: "Testing field selector configuration",
  items: [
    input.config.table('dataTable', {
      label: 'Data Table',
      description: 'Select the data table'
    }),
    input.config.field('nameField', {
      label: 'Name Field',
      description: 'Select the name field',
      parentTable: 'dataTable'
    })
  ]
});

console.log('Data Table:', config.dataTable);
console.log('Name Field:', config.nameField);
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    // Open config panel and select table first
    await dashboard.scripts.topbar.clickSettings();
    await dashboard.scripts.configPanel.verifyVisible();
    await dashboard.scripts.configPanel.fillInput('dataTable', 'Actor');

    // Then select field (should be enabled after table selection)
    await dashboard.scripts.configPanel.fillInput('nameField', 'FirstName');
    await dashboard.scripts.configPanel.save();

    // Run and verify
    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();
    await dashboard.scripts.playground.verifyOutputContains('Data Table');
    await dashboard.scripts.playground.verifyOutputContains('Name Field');

    // 7. Test comprehensive config with all types
    script = `
const config = input.config({
  title: "Complete Configuration Test",
  description: "Testing all config types together",
  items: [
    input.config.table('sourceTable', {
      label: 'Source Table',
      description: 'Select the table containing your data'
    }),
    input.config.view('sourceView', {
      label: 'Source View',
      description: 'Select the view to filter records',
      parentTable: 'sourceTable'
    }),
    input.config.field('emailField', {
      label: 'Email Field',
      description: 'Select the field containing emails',
      parentTable: 'sourceTable'
    }),
    input.config.text('prefix', {
      label: 'Record Prefix',
      description: 'Prefix to add to record names'
    }),
    input.config.number('limit', {
      label: 'Processing Limit',
      description: 'Maximum number of records to process'
    }),
    input.config.select('status', {
      label: 'Status Filter',
      description: 'Filter by status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'pending', label: 'Pending' }
      ]
    })
  ]
});

console.log('Complete configuration loaded');
console.log('Table:', config.sourceTable);
console.log('View:', config.sourceView);
console.log('Field:', config.emailField);
console.log('Prefix:', config.prefix);
console.log('Limit:', config.limit);
console.log('Status:', config.status);
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    // Open config panel and fill all config types
    await dashboard.scripts.topbar.clickSettings();
    await dashboard.scripts.configPanel.verifyVisible();
    await dashboard.scripts.configPanel.verifyTitle('Complete Configuration Test');

    // Fill table (required first for view and field)
    await dashboard.scripts.configPanel.fillInput('sourceTable', 'Actor');

    // Fill view (depends on table)
    await dashboard.scripts.configPanel.fillInput('sourceView', 'Actor');

    // Fill field (depends on table)
    await dashboard.scripts.configPanel.fillInput('emailField', 'FirstName');

    // Fill text input
    await dashboard.scripts.configPanel.fillInput('prefix', 'TEST-');

    // Fill number input
    await dashboard.scripts.configPanel.fillInput('limit', 50);

    // Fill select dropdown
    await dashboard.scripts.configPanel.fillInput('status', 'Active');

    // Save config
    await dashboard.scripts.configPanel.save();

    // Run and verify all outputs
    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Complete configuration loaded');
    await dashboard.scripts.playground.verifyOutputContains('Table:');
    await dashboard.scripts.playground.verifyOutputContains('View:');
    await dashboard.scripts.playground.verifyOutputContains('Field:');
    await dashboard.scripts.playground.verifyOutputContains('Prefix: TEST-');
    await dashboard.scripts.playground.verifyOutputContains('Limit: 50');
    await dashboard.scripts.playground.verifyOutputContains('Status: active');
  });
});
