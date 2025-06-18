export const defaultScript = `// Welcome to NocoDB Scripts!
// This is a simple example to get you started.

// Get your table
const table = await input.tableAsync("Select a table");

// Get all records from the table
const query = await table.selectRecordsAsync();

// Display how many records you have
output.text(\`You have $\{query.records.length} records in this table.\`);

// Show the first record as an example
if (query.records.length > 0) {
    let firstRecord = query.records[0];
    output.text(\`First record: $\{firstRecord.name || firstRecord.id}\`);
}

// That's it! You've just read data from your table.
// Try changing the table name above and run the script again.`;
