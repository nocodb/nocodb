import type { Knex } from 'knex' // Adjust path as needed
import type MigrationSource from './MigrationSource'

export class CustomMigrator {
  private knex: Knex
  private migrationSource: MigrationSource
  private tableName: string

  constructor(knex: Knex, migrationSource: MigrationSource, tableName = 'xc_migrations') {
    this.knex = knex
    this.migrationSource = migrationSource
    this.tableName = tableName
  }

  async initMigrationTable() {
    const exists = await this.knex.schema.hasTable(this.tableName)
    if (!exists) {
      await this.knex.schema.createTable(this.tableName, (table) => {
        table.string('name').primary()
        table.timestamp('run_at').defaultTo(this.knex.fn.now())
      })
    }
  }

  async getAppliedMigrations(): Promise<string[]> {
    const rows = await this.knex(this.tableName).select('name')
    return rows.map((row) => row.name)
  }

  async latest() {
    try {
      // Initialize migration table
      await this.initMigrationTable()

      // Get available migrations
      const migrationNames = await this.migrationSource.getMigrations()
      const appliedMigrations = await this.getAppliedMigrations()

      // Filter unapplied migrations
      const pendingMigrations = migrationNames.filter((name: string) => !appliedMigrations.includes(name))

      // Run pending migrations in order
      for (const name of pendingMigrations) {
        const migration = this.migrationSource.getMigration(name)
        if (migration && typeof migration.up === 'function') {
          console.log(`Applying migration: ${name}`)
          await migration.up(this.knex)
          await this.knex(this.tableName).insert({ name })
          console.log(`Migration applied: ${name}`)
        }
      }

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations')
      }
    } catch (err) {
      console.error('Migration failed:', err)
      throw err
    }
  }
}
