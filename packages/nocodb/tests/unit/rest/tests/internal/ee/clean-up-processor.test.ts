import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '~test/init';
import { createProject } from '~test/factory/base';
import Base from '~/models/Base';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { CleanUpProcessor } from '~/modules/jobs/jobs/clean-up/clean-up.processor';

type Context = Awaited<ReturnType<typeof init>>;

const basicUser = process.env.NC_HTTP_BASIC_USER ?? 'defaultusername';
const basicPass = process.env.NC_HTTP_BASIC_PASS ?? 'defaultpassword';

const SIXTY_ONE_DAYS_MS = 61 * 24 * 60 * 60 * 1000;

async function projectRowExists(baseId: string): Promise<boolean> {
  const row = await Noco.ncMeta
    .knex(MetaTable.PROJECT)
    .where({ id: baseId })
    .first();
  return !!row;
}

/**
 * Confirms the manual clean-up entry point — POST /internal/clean-up — is
 * wired correctly and that the job it enqueues (CleanUpProcessor) hard-deletes
 * soft-deleted bases only once they pass the 60-day retention window.
 */
export function cleanUpProcessorTests() {
  describe('Internal clean-up API + processor', () => {
    let context: Context;

    beforeEach(async () => {
      context = await init();
    });

    it('route is mounted and guarded by basic auth', async () => {
      // wrong creds → 401 (proves the route exists AND the basic guard runs;
      // a missing route would be 404, an unregistered strategy would be 500)
      await request(context.app)
        .post('/internal/clean-up')
        .auth('wrong-user', 'wrong-pass')
        .expect(401);

      // correct creds → handler runs and enqueues the job (fire-and-forget)
      const res = await request(context.app)
        .post('/internal/clean-up')
        .auth(basicUser, basicPass);
      expect(res.status, `expected 2xx, got ${res.status}`).to.be.within(
        200,
        299,
      );
    });

    it('hard-deletes soft-deleted bases past 60d retention, keeps recent ones', async () => {
      const oldBase = await createProject(context, { title: 'OldDeletedBase' });
      const recentBase = await createProject(context, {
        title: 'RecentDeletedBase',
      });

      const ctxOld = {
        workspace_id: oldBase.fk_workspace_id,
        base_id: oldBase.id,
      };
      const ctxRecent = {
        workspace_id: recentBase.fk_workspace_id,
        base_id: recentBase.id,
      };

      // Soft delete both — the row must survive (deleted: true), not vanish.
      await Base.softDelete(ctxOld, oldBase.id);
      await Base.softDelete(ctxRecent, recentBase.id);

      // Backdate the old base past the retention window. The recent base keeps
      // its fresh updated_at, so it must NOT be collected.
      await Noco.ncMeta
        .knex(MetaTable.PROJECT)
        .where({ id: oldBase.id })
        .update({ updated_at: new Date(Date.now() - SIXTY_ONE_DAYS_MS) });

      expect(await projectRowExists(oldBase.id), 'old base soft-deleted').to.eq(
        true,
      );
      expect(
        await projectRowExists(recentBase.id),
        'recent base soft-deleted',
      ).to.eq(true);

      // Run the exact job the API enqueues.
      await new CleanUpProcessor().job({} as any);

      expect(
        await projectRowExists(oldBase.id),
        'base past retention should be hard-deleted',
      ).to.eq(false);
      expect(
        await projectRowExists(recentBase.id),
        'recently deleted base should be preserved',
      ).to.eq(true);
    });

    it('isolates failures: one base erroring does not block the others', async () => {
      const goodBase = await createProject(context, { title: 'GoodOldBase' });
      const badBase = await createProject(context, { title: 'BadOldBase' });

      await Base.softDelete(
        { workspace_id: goodBase.fk_workspace_id, base_id: goodBase.id },
        goodBase.id,
      );
      await Base.softDelete(
        { workspace_id: badBase.fk_workspace_id, base_id: badBase.id },
        badBase.id,
      );

      // Both past the retention window so both are picked up by the sweep.
      await Noco.ncMeta
        .knex(MetaTable.PROJECT)
        .whereIn('id', [goodBase.id, badBase.id])
        .update({ updated_at: new Date(Date.now() - SIXTY_ONE_DAYS_MS) });

      // Force the bad base to throw mid-delete; every other id delegates to the
      // real implementation. This mutates the same class the processor calls.
      const originalDelete = Base.delete;
      Base.delete = (async (...args: any[]) => {
        if (args[1] === badBase.id) {
          throw new Error('forced failure for isolation test');
        }
        return (originalDelete as any).apply(Base, args);
      }) as typeof Base.delete;

      try {
        await new CleanUpProcessor().job({} as any);
      } finally {
        Base.delete = originalDelete;
      }

      // Good base committed in its own transaction; bad base's transaction
      // rolled back — proving failures are isolated per base.
      expect(
        await projectRowExists(goodBase.id),
        'good base should be deleted despite the other failing',
      ).to.eq(false);
      expect(
        await projectRowExists(badBase.id),
        'failed base should be rolled back and preserved',
      ).to.eq(true);
    });
  });
}
