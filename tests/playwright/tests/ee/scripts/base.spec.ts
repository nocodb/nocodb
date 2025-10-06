import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';

test.describe.only('Scripts - Base Object', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let scriptId: string;
  let script;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);

    await dashboard.treeView.createScript({
      title: 'Base Object Test Script',
      baseTitle: context.base.title,
    });

    await dashboard.treeView.openScript({
      title: 'Base Object Test Script',
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

  test('Should test all base object features', async () => {
    // Should access base properties (id, name, tables)
    script = `
// Test base.id property
output.text('Base ID: ' + base.id);

// Test base.name property
output.text('Base Name: ' + base.name);

// Test base.tables property
output.text('Number of tables: ' + base.tables.length);

// List all tables
output.markdown('# Tables in this base:');
for (const table of base.tables) {
  output.text('- ' + table.name + ' (ID: ' + table.id + ')');
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    // Verify base properties are displayed
    await dashboard.scripts.playground.verifyOutputContains('Base ID:');
    await dashboard.scripts.playground.verifyOutputContains('Base Name:');
    await dashboard.scripts.playground.verifyOutputContains('Number of tables:');
    await dashboard.scripts.playground.verifyOutputContains('Tables in this base:');

    // Should use getTable() method with table name
    script = `
// Get table by name
const actorTable = base.getTable('Actor');

if (actorTable) {
  output.text('Table found: ' + actorTable.name);
  output.text('Table ID: ' + actorTable.id);
  output.text('Number of fields: ' + actorTable.fields.length);
  output.text('Number of views: ' + actorTable.views.length);
} else {
  output.text('Table not found');
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Table found: Actor');
    await dashboard.scripts.playground.verifyOutputContains('Table ID:');
    await dashboard.scripts.playground.verifyOutputContains('Number of fields:');
    await dashboard.scripts.playground.verifyOutputContains('Number of views:');

    // Should use getTable() method with table ID
    script = `
// First get the table to find its ID
const actorTable = base.getTable('Actor');

if (actorTable) {
  const tableId = actorTable.id;
  output.text('Found table ID: ' + tableId);
  
  // Now get the same table by ID
  const tableById = base.getTable(tableId);
  
  if (tableById) {
    output.text('Retrieved table by ID: ' + tableById.name);
    output.text('IDs match: ' + (tableById.id === tableId));
  } else {
    output.text('Failed to retrieve table by ID');
  }
} else {
  output.text('Actor table not found');
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Found table ID:');
    await dashboard.scripts.playground.verifyOutputContains('Retrieved table by ID: Actor');
    await dashboard.scripts.playground.verifyOutputContains('IDs match: true');

    // Should return null for non-existent table
    script = `
// Try to get a non-existent table
const nonExistentTable = base.getTable('NonExistentTable');

if (nonExistentTable) {
  output.text('Table found (unexpected)');
} else {
  output.text('Table not found (expected)');
}

// Verify with check pattern
const tableName = 'NonExistentTable';
const table = base.getTable(tableName);
if (table) {
  output.text('Table ' + tableName + ' found!');
} else {
  output.text('Table ' + tableName + ' not found.');
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Table not found (expected)');
    await dashboard.scripts.playground.verifyOutputContains('Table NonExistentTable not found.');

    // Should access activeCollaborators property
    script = `
// Test base.activeCollaborators property
output.markdown('# Active Collaborators:');
output.text('Number of collaborators: ' + base.activeCollaborators.length);

// List all collaborators
for (const collaborator of base.activeCollaborators) {
  const displayName = collaborator.name || 'Unnamed User';
  output.text('- ' + displayName + ' (' + collaborator.email + ') - ID: ' + collaborator.id);
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Active Collaborators:');
    await dashboard.scripts.playground.verifyOutputContains('Number of collaborators:');

    // Should use getCollaborator() method with email
    script = `
// Get current user from session
const currentUser = session.currentUser;
const currentUserEmail = currentUser.email;

output.text('Current user email: ' + currentUserEmail);

// Get collaborator by email
const collaborator = base.getCollaborator(currentUserEmail);

if (collaborator) {
  const displayName = collaborator.name || 'Unnamed User';
  output.text('Collaborator found: ' + displayName);
  output.text('Email: ' + collaborator.email);
  output.text('ID: ' + collaborator.id);
} else {
  output.text('Collaborator not found');
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Current user email:');
    await dashboard.scripts.playground.verifyOutputContains('Collaborator found:');
    await dashboard.scripts.playground.verifyOutputContains('Email:');
    await dashboard.scripts.playground.verifyOutputContains('ID:');

    // Should use getCollaborator() method with ID
    script = `
// Get first collaborator to find their ID
if (base.activeCollaborators.length > 0) {
  const firstCollaborator = base.activeCollaborators[0];
  const collaboratorId = firstCollaborator.id;
  
  output.text('First collaborator ID: ' + collaboratorId);
  
  // Get collaborator by ID
  const collaboratorById = base.getCollaborator(collaboratorId);
  
  if (collaboratorById) {
    const displayName = collaboratorById.name || 'Unnamed User';
    output.text('Retrieved collaborator by ID: ' + displayName);
    output.text('IDs match: ' + (collaboratorById.id === collaboratorId));
  } else {
    output.text('Failed to retrieve collaborator by ID');
  }
} else {
  output.text('No collaborators found');
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('First collaborator ID:');
    await dashboard.scripts.playground.verifyOutputContains('Retrieved collaborator by ID:');
    await dashboard.scripts.playground.verifyOutputContains('IDs match: true');

    // Should use getCollaborator() method with name
    script = `
// Get current user from session
const currentUser = session.currentUser;
const currentUserName = currentUser.name || currentUser.email;

output.text('Current user name: ' + currentUserName);

// Get collaborator by name
const collaborator = base.getCollaborator(currentUserName);

if (collaborator) {
  const displayName = collaborator.name || 'Unnamed User';
  output.text('Collaborator found by name: ' + displayName);
  output.text('Email: ' + collaborator.email);
} else {
  output.text('Collaborator not found by name');
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Current user name:');

    // Should return null for non-existent collaborator
    script = `
// Try to get a non-existent collaborator
const nonExistentEmail = 'nonexistent@example.com';
const collaborator = base.getCollaborator(nonExistentEmail);

if (collaborator) {
  output.text('Collaborator found (unexpected)');
} else {
  output.text('Collaborator not found (expected)');
}

// Verify with check pattern
const userEmail = 'team@example.com';
const teamMember = base.getCollaborator(userEmail);
if (teamMember) {
  const memberName = teamMember.name || 'Unnamed User';
  output.text(memberName + ' has access to this base.');
} else {
  output.text('No collaborator found with email ' + userEmail + '.');
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Collaborator not found (expected)');
    await dashboard.scripts.playground.verifyOutputContains('No collaborator found with email team@example.com.');

    // Should handle email case-insensitivity for getCollaborator()
    script = `
// Get current user email
const currentUser = session.currentUser;
const originalEmail = currentUser.email;

output.text('Original email: ' + originalEmail);

// Test with uppercase
const upperCaseEmail = originalEmail.toUpperCase();
const collaboratorUpper = base.getCollaborator(upperCaseEmail);

if (collaboratorUpper) {
  output.text('Found with uppercase email: ' + collaboratorUpper.email);
} else {
  output.text('Not found with uppercase email');
}

// Test with lowercase
const lowerCaseEmail = originalEmail.toLowerCase();
const collaboratorLower = base.getCollaborator(lowerCaseEmail);

if (collaboratorLower) {
  output.text('Found with lowercase email: ' + collaboratorLower.email);
} else {
  output.text('Not found with lowercase email');
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Original email:');
    await dashboard.scripts.playground.verifyOutputContains('Found with uppercase email:');
    await dashboard.scripts.playground.verifyOutputContains('Found with lowercase email:');

    // Should create table with createTableAsync() method
    script = `
// Create a new table with fields
try {
  const newTable = await base.createTableAsync('Orders', [
    {
      name: 'Order ID',
      type: UITypes.SingleLineText
    },
    {
      name: 'Customer',
      type: UITypes.SingleLineText
    },
    {
      name: 'Order Date',
      type: UITypes.Date,
      options: {
        date_format: 'YYYY-MM-DD'
      }
    },
    {
      name: 'Status',
      type: UITypes.SingleSelect,
      options: {
        choices: [
          { title: 'Pending', color: '#FFC107' },
          { title: 'Processing', color: '#007BFF' },
          { title: 'Shipped', color: '#28A745' },
          { title: 'Delivered', color: '#6F42C1' },
          { title: 'Cancelled', color: '#DC3545' }
        ]
      }
    }
  ]);
  
  output.text('Table ' + newTable.name + ' created successfully!');
  output.text('Table ID: ' + newTable.id);
  output.text('Number of fields: ' + newTable.fields.length);
  
  // Verify we can retrieve the newly created table
  const retrievedTable = base.getTable('Orders');
  if (retrievedTable) {
    output.text('Successfully retrieved newly created table');
  }
} catch (error) {
  output.text('Error creating table: ' + error.message);
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Table Orders created successfully!');
    await dashboard.scripts.playground.verifyOutputContains('Table ID:');
    await dashboard.scripts.playground.verifyOutputContains('Number of fields:');
    await dashboard.scripts.playground.verifyOutputContains('Successfully retrieved newly created table');

    // Should create table with empty fields array
    script = `
// Create a table with only system fields
try {
  const newTable = await base.createTableAsync('EmptyFieldsTable', []);
  
  output.text('Table ' + newTable.name + ' created successfully!');
  output.text('Table ID: ' + newTable.id);
  output.text('Number of fields (system fields only): ' + newTable.fields.length);
} catch (error) {
  output.text('Error creating table: ' + error.message);
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Table EmptyFieldsTable created successfully!');
    await dashboard.scripts.playground.verifyOutputContains('Table ID:');
    await dashboard.scripts.playground.verifyOutputContains('Number of fields (system fields only):');

    // Should handle createTableAsync() errors gracefully
    script = `
// Try to create a table that already exists
try {
  const newTable = await base.createTableAsync('Actor', [
    {
      name: 'Test Field',
      type: UITypes.SingleLineText
    }
  ]);
  
  output.text('Table created (unexpected)');
} catch (error) {
  output.text('Error caught (expected): ' + error.message);
}
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    await dashboard.scripts.playground.verifyOutputContains('Error caught (expected):');

    // Should demonstrate complete base object workflow
    script = `
// Complete workflow demonstrating base object usage
output.markdown('# Base Object Workflow Demo');

// 1. Display base information
output.markdown('## Base Information');
output.text('Base ID: ' + base.id);
output.text('Base Name: ' + base.name);
output.text('Total Tables: ' + base.tables.length);

// 2. List all tables
output.markdown('## Tables in this base:');
for (const table of base.tables) {
  output.text('- ' + table.name + ' (ID: ' + table.id + '): ' + table.fields.length + ' fields, ' + table.views.length + ' views');
}

// 3. Get specific table
const actorTable = base.getTable('Actor');
if (actorTable) {
  output.markdown('## Actor Table Details');
  output.text('Table found: ' + actorTable.name);
  output.text('Table ID: ' + actorTable.id);
}

// 4. List collaborators
output.markdown('## Active Collaborators:');
for (const collaborator of base.activeCollaborators) {
  const displayName = collaborator.name || 'Unnamed User';
  output.text('- ' + displayName + ' (' + collaborator.email + ') - ID: ' + collaborator.id);
}

// 5. Get current user
const currentUser = session.currentUser;
const currentUserName = currentUser.name || currentUser.email;
output.markdown('## Current User: ' + currentUserName + ' (' + currentUser.email + ')');

// 6. Check if specific user has access
const currentUserCollaborator = base.getCollaborator(currentUser.email);
if (currentUserCollaborator) {
  const memberName = currentUserCollaborator.name || 'Unnamed User';
  output.text(memberName + ' has access to this base.');
} else {
  output.text('Current user not found in collaborators.');
}

output.markdown('## Workflow Complete!');
    `;

    await dashboard.scripts.setEditorContent(
      script,
      scriptId,
      context.base.fk_workspace_id,
      context.base.id,
      context.api
    );

    await dashboard.scripts.topbar.clickRun();
    await dashboard.scripts.topbar.waitForExecutionComplete();

    // Verify all sections are present
    await dashboard.scripts.playground.verifyOutputContains('Base Object Workflow Demo');
    await dashboard.scripts.playground.verifyOutputContains('Base Information');
    await dashboard.scripts.playground.verifyOutputContains('Base ID:');
    await dashboard.scripts.playground.verifyOutputContains('Base Name:');
    await dashboard.scripts.playground.verifyOutputContains('Total Tables:');
    await dashboard.scripts.playground.verifyOutputContains('Tables in this base:');
    await dashboard.scripts.playground.verifyOutputContains('Active Collaborators:');
    await dashboard.scripts.playground.verifyOutputContains('Current User:');
    await dashboard.scripts.playground.verifyOutputContains('Workflow Complete!');
  });
});
