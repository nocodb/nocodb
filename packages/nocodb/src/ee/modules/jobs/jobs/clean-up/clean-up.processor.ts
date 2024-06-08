import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import Workspace from '~/models/Workspace';
import Base from '~/models/Base';

const DELETE_AFTER_DAYS = 1000 * 60 * 60 * 24 * 60; // 60 days

const logger = new Logger('CleanUpProcessor');

@Processor(JOBS_QUEUE)
export class CleanUpProcessor {
  private readonly debugLog = debug('nc:jobs:clean-up');

  constructor() {}

  @Process(JobTypes.CleanUp)
  async cleanUp(_job: Job) {
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
      for (const ws of cleanUpWorkspaces) {
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
      for (const base of cleanUpBases) {
        await Base.delete(base.id, deleteBaseTransaction);
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
