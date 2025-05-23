import * as init_01 from './migrations/01.init'

export default class MigrationSource {
  public getMigrations(): Promise<any> {
    return Promise.resolve(['01.init'])
  }

  public getMigrationName(migration: string): string {
    return migration
  }

  public getMigration(migration: string): any {
    switch (migration) {
      case '01.init':
        return init_01
    }
  }
}
