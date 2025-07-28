export const defaultScript = `// Welcome to NocoDB Scripts!
// This is a simple default script to demonstrate basic functionality

// Step 1: Initialize
script.step({
  title: 'Getting Started',
  description: 'Initializing the script and selecting data source',
  icon: 'play',
  color: 'blue'
});

// Get user input for table selection
const table = await input.tableAsync("Choose a table to work with");
output.text(\`Selected table: \${table.name}\`);

// Step 2: Fetch Data
script.step({
  title: 'Fetching Data',
  description: 'Retrieving records from the selected table',
  icon: 'database',
  color: 'purple'
});

// Fetch all records
const query = await table.selectRecordsAsync();
const recordCount = query.records.length;

output.text(\`Found \${recordCount} records in the table.\`);

await new Promise(resolve => setTimeout(resolve, 1000));

// Step 3: Complete
script.step({
  title: 'Complete',
  description: 'Script execution finished successfully',
  icon: 'checkCircle',
  color: 'green'
});

output.text("✅ Script completed successfully!");
output.text("You can now modify this script to add your own custom logic.");`;
