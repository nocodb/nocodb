import type { Base, Source } from '~/models';
import KnexMigratorv2 from '~/db/sql-migrator/lib/KnexMigratorv2';

export default async function syncMigration(base: Base): Promise<void> {
  for (const source of await base.getSources()) {
    try {
      /* create sql-migrator */
      const migrator = new KnexMigratorv2(
        { workspace_id: base.fk_workspace_id, base_id: base.id },
        base,
      );

      await migrator.init(source);

      /* sql-migrator : sync & up */
      await migrator.sync(source);

      await migrator.migrationsUp({ source });
    } catch (e) {
      console.log(e);
      // throw e;
    }
  }
}

export async function syncBaseMigration(
  base: Base,
  source: Source,
): Promise<void> {
  try {
    /* create sql-migrator */
    const migrator = new KnexMigratorv2(
      { workspace_id: base.fk_workspace_id, base_id: base.id },
      base,
    );

    await migrator.init(source);

    /* sql-migrator : sync & up */
    await migrator.sync(source);

    await migrator.migrationsUp({ source });
  } catch (e) {
    throw e;
  }
}
