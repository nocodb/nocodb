import KnexMigratorv2 from '../db/sql-migrator/lib/KnexMigratorv2';
import type { Base, Project } from '../models';

export default async function syncMigration(project: Project): Promise<void> {
  for (const base of await project.getBases()) {
    try {
      /* create sql-migrator */
      const migrator = new KnexMigratorv2(project);

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

export async function syncBaseMigration(
  project: Project,
  base: Base,
): Promise<void> {
  try {
    /* create sql-migrator */
    const migrator = new KnexMigratorv2(project);

    await migrator.init(base);

    /* sql-migrator : sync & up */
    await migrator.sync(base);

    await migrator.migrationsUp({ base });
  } catch (e) {
    console.log(e);
    // throw e;
  }
}
