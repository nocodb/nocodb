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

    const deleteWsTransaction = await ncMeta.startTransaction();

    try {
      for (const [i, ws] of Object.entries(cleanUpWorkspaces)) {
        logger.log(
          `Deleting workspace ${ws.id} ${+i + 1} of ${
            cleanUpWorkspaces.length
          }`,
        );
        await Workspace.delete(ws.id, deleteWsTransaction);
      }
      await deleteWsTransaction.commit();
    } catch (e) {
      await deleteWsTransaction.rollback();
      return logger.error(e);
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

    const deleteBaseTransaction = await ncMeta.startTransaction();

    try {
      for (const [i, base] of Object.entries(cleanUpBases)) {
        logger.log(
          `Deleting base ${base.id} ${+i + 1} of ${cleanUpBases.length}`,
        );
        await Base.delete(
          {
            workspace_id: base.fk_workspace_id,
            base_id: base.id,
          },
          base.id,
          deleteBaseTransaction,
        );
      }
      await deleteBaseTransaction.commit();
    } catch (e) {
      await deleteBaseTransaction.rollback();
      return logger.error(e);
    }

    logger.log(
      `Clean up completed. Deleted ${cleanUpWorkspaces.length} workspaces and ${cleanUpBases.length} bases.`,
    );
  }
}
