import v8 from 'v8';
import path from 'path';
import TestDbMngr from '../TestDbMngr';
import { Base, Model } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import NocoCache from '~/cache/NocoCache';
import { QueueService } from '~/modules/jobs/fallback/fallback-queue.service';
import { MetaTable, orderedMetaTables, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';

// Heap-snapshot trigger for OOM investigation. Opt-in via NC_TEST_HEAP_SNAPSHOT.
// Set to a comma-separated list of MB thresholds (e.g. "525,650,800") to write
// one .heapsnapshot file per threshold per process, or set to "1"/"true" to use
// the default thresholds. Compare in VS Code (Open Heap Snapshot) to see what
// is being retained as the heap grows.
const DEFAULT_SNAPSHOT_THRESHOLDS_MB = [525, 650, 800];

const SNAPSHOT_THRESHOLDS_MB: number[] = (() => {
  const raw = process.env.NC_TEST_HEAP_SNAPSHOT;
  if (!raw) return [];
  if (raw === '1' || raw.toLowerCase() === 'true') {
    return DEFAULT_SNAPSHOT_THRESHOLDS_MB;
  }
  const parsed = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length ? parsed : DEFAULT_SNAPSHOT_THRESHOLDS_MB;
})();

const snapshotTaken = new Set<number>();

function maybeWriteHeapSnapshot(heapUsedMb: number) {
  if (!SNAPSHOT_THRESHOLDS_MB.length) return;
  for (const threshold of SNAPSHOT_THRESHOLDS_MB) {
    if (heapUsedMb >= threshold && !snapshotTaken.has(threshold)) {
      snapshotTaken.add(threshold);
      const file = path.join(
        '/tmp',
        `nocodb-heap-${threshold}mb-${Date.now()}.heapsnapshot`,
      );
      v8.writeHeapSnapshot(file);
      console.log(`[cleanupMeta] wrote heap snapshot ${file}`);
    }
  }
}

const dropTablesAllNonExternalProjects = async () => {
  const rawBases = await Noco.ncMeta.metaList2(
    RootScopes.BASE,
    RootScopes.BASE,
    MetaTable.PROJECT,
  );

  const bases = rawBases.map((b) => Base.castType(b));

  const userCreatedTableNames: string[] = [];
  await Promise.all(
    bases
      .filter((base) => base.is_meta)
      .map(async (base) => {
        await base.getSources();
        const source = base.sources && base.sources[0];
        if (!source) return;

        const models = await Model.list(
          {
            workspace_id: base.fk_workspace_id,
            base_id: base.id,
          },
          {
            base_id: base.id,
            source_id: source.id!,
          },
        );
        models.forEach((model) => {
          userCreatedTableNames.push(model.table_name);
        });
      }),
  );

  await TestDbMngr.disableForeignKeyChecks(TestDbMngr.metaKnex);

  for (const tableName of userCreatedTableNames) {
    try {
      if (TestDbMngr.isPg()) {
        await TestDbMngr.metaKnex.raw(
          `DROP TABLE IF EXISTS "${tableName}" CASCADE`,
        );
      } else {
        await TestDbMngr.metaKnex.raw(`DROP TABLE ${tableName}`);
      }
    } catch(ex) {}
  }

  await TestDbMngr.enableForeignKeyChecks(TestDbMngr.metaKnex);
};

const cleanupMetaTables = async () => {
  await TestDbMngr.disableForeignKeyChecks(TestDbMngr.metaKnex);
  for (const tableName of orderedMetaTables) {
    try {
      await TestDbMngr.metaKnex.raw(`DELETE FROM ${tableName}`);
    } catch (e) {}
  }
  await TestDbMngr.enableForeignKeyChecks(TestDbMngr.metaKnex);

  // Reset cached workspace ID so verifyDefaultWorkspace recreates it
  Noco.ncDefaultWorkspaceId = undefined;

  await NocoCache.destroy();
};

export default async function () {
  try {
    await NcConnectionMgrv2.destroyAll();

    // Reset fallback job queue to prevent memory accumulation from delayed jobs
    QueueService.reset();

    await dropTablesAllNonExternalProjects();
    await cleanupMetaTables();

    // Force garbage collection between test suites to prevent OOM
    // on CI runners with limited memory (8GB)
    if (global.gc) {
      global.gc();
    }

    const mem = process.memoryUsage();
    const mb = (n: number) => Math.round(n / 1024 / 1024);
    // Heap line is opt-in: set NC_TEST_MEM_LOG=1 when investigating OOM/leaks.
    // Snapshot writer below has its own NC_TEST_HEAP_SNAPSHOT gate.
    if (process.env.NC_TEST_MEM_LOG) {
      const ts = new Date().toISOString();
      console.log(
        `[cleanupMeta ${ts}] heap=${mb(mem.heapUsed)}/${mb(mem.heapTotal)} MB ` +
          `rss=${mb(mem.rss)} MB external=${mb(mem.external)} MB ` +
          `arrayBuffers=${mb(mem.arrayBuffers)} MB`,
      );
    }
    maybeWriteHeapSnapshot(mb(mem.heapUsed));
  } catch (e) {
    console.error('cleanupMeta', e);
  }
}
