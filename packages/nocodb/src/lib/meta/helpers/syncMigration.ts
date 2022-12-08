import Migrator from '../../db/sql-migrator/lib/KnexMigratorv2';
import Project from '../../models/Project';
import Base from '../../models/Base';

export default async function syncMigration(project: Project): Promise<void> {
  for (const base of await project.getBases()) {
    try {
      /* create sql-migrator */
      const migrator = new Migrator(project);

      await migrator.init(base);

      /* sql-migrator : sync & up */
      await migrator.sync(base);

      await migrator.migrationsUp({ base });
    } catch (e) {
      console.log(e);
      // throw e;
    }
  }
}

export async function syncBaseMigration(project: Project, base: Base): Promise<void> {
  try {
    /* create sql-migrator */
    const migrator = new Migrator(project);

    await migrator.init(base);

    /* sql-migrator : sync & up */
    await migrator.sync(base);

    await migrator.migrationsUp({ base });
  } catch (e) {
    console.log(e);
    // throw e;
  }
}
