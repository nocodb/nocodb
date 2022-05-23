import Migrator from '../../../migrator/SqlMigrator/lib/KnexMigratorv2';
import Project from '../../../noco-models/Project';

export default async function syncMigration(project: Project): Promise<void> {
  for (const base of await project.getBases()) {
    try {
      /* create migrator */
      const migrator = new Migrator(project);

      await migrator.init(base);

      /* migrator : sync & up */
      await migrator.sync(base);

      await migrator.migrationsUp({ base });
    } catch (e) {
      console.log(e);
      // throw e;
    }
  }
}
