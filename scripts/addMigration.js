/**
 * Migration file generator
 *
 * Usage:
 *   pnpm migration:add add my feature
 *   node scripts/addMigration.js add my feature
 *
 * Output:
 *   Creates: packages/nocodb/src/meta/migrations/v0/nc_YYYYMMDDHHmm_add_my_feature.ts
 */

const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '../packages/nocodb/src/meta/migrations/v0');

const toSnakeCase = (str) => {
  return str
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
};

const generateTimestamp = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  return (
    now.getUTCFullYear() +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes())
  );
};

const getMigrationTemplate = () => {
  return `import type { Knex } from 'knex';
import { MetaTable } from '~/meta/meta.service';

const up = async (knex: Knex) => {
  // Add your migration logic here
};

const down = async (knex: Knex) => {
  // Add your rollback logic here
};

export { up, down };
`;
};

const createMigration = (title) => {
  const timestamp = generateTimestamp();
  const snakeTitle = toSnakeCase(title);
  const filename = `nc_${timestamp}_${snakeTitle}.ts`;
  const filepath = path.join(migrationPath, filename);

  // Create the migration file
  fs.writeFileSync(filepath, getMigrationTemplate(), 'utf8');

  console.log(`✅ Created migration: ${filename}`);
  console.log(`📂 Location: ${filepath}`);

  return filepath;
};

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: Migration title is required\n');
  console.log('Usage: node addMigration <Title>');
  console.log('Example: node addMigration Add My Feature');
  console.log('  → generates nc_YYYYMMDDHHmm_add_my_feature.ts\n');
  process.exit(1);
}

const title = args.join(' ');

try {
  createMigration(title);
} catch (error) {
  console.error('❌ Error creating migration:', error.message);
  process.exit(1);
}