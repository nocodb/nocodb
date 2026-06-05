import debug from 'debug';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import Workspace from '~/models/Workspace';
import Base from '~/models/Base';

const DELETE_AFTER_DAYS = 1000 * 60 * 60 * 24 * 60; // 60 days

const logger = new Logger('CleanUpProcessor');

export class CleanUpProcessor {
  private readonly debugLog = debug('nc:jobs:clean-up');

  async job(_job: Job) {
    const ncMeta = Noco.ncMeta;

    const deletedWorkspaces = await ncMeta.metaList2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      {
        condition: {
          deleted: true,
        },
      },
    );

    const cleanUpWorkspaces = deletedWorkspaces.filter((ws) => {
      return (
        new Date().getTime() - new Date(ws.updated_at).getTime() >
        DELETE_AFTER_DAYS
      );
    });

    // Per-entity transaction: each workspace/base is committed independently so
    // one failure can't roll back the whole batch (and a workspace failure no
    // longer skips base cleanup). Satellite cleanups inside the deletes run
    // out-of-transaction best-effort, so a rollback here only reverts meta rows.
    let deletedWorkspaceCount = 0;
    for (const [i, ws] of Object.entries(cleanUpWorkspaces)) {
      logger.log(
        `Deleting workspace ${ws.id} ${+i + 1} of ${cleanUpWorkspaces.length}`,
      );

      const trx = await ncMeta.startTransaction();
      try {
        await Workspace.delete(ws.id, trx);
        await trx.commit();
        deletedWorkspaceCount++;
      } catch (e) {
        await trx.rollback();
        logger.error(
          `Failed to clean up workspace ${ws.id}: ${e.message}`,
          e.stack,
        );
      }
    }

    const deletedBases = await ncMeta.metaList2(
      RootScopes.BASE,
      RootScopes.BASE,
      MetaTable.PROJECT,
      {
        condition: {
          deleted: true,
        },
      },
    );

    const cleanUpBases = deletedBases.filter((base) => {
      return (
        new Date().getTime() - new Date(base.updated_at).getTime() >
        DELETE_AFTER_DAYS
      );
    });

    let deletedBaseCount = 0;
    for (const [i, base] of Object.entries(cleanUpBases)) {
      logger.log(
        `Deleting base ${base.id} ${+i + 1} of ${cleanUpBases.length}`,
      );

      if (!base.fk_workspace_id) {
        logger.log(
          `Base ${base.id} does not have workspace. Skipping deletion.`,
        );
        continue;
      }

      const trx = await ncMeta.startTransaction();
      try {
        await Base.delete(
          {
            workspace_id: base.fk_workspace_id,
            base_id: base.id,
          },
          base.id,
          trx,
        );
        await trx.commit();
        deletedBaseCount++;
      } catch (e) {
        await trx.rollback();
        logger.error(
          `Failed to clean up base ${base.id}: ${e.message}`,
          e.stack,
        );
      }
    }

    logger.log(
      `Clean up completed. Deleted ${deletedWorkspaceCount}/${cleanUpWorkspaces.length} workspaces and ${deletedBaseCount}/${cleanUpBases.length} bases.`,
    );
  }
}
