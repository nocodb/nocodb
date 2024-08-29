import debug from 'debug';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import type { Job } from 'bull';
import { JobTypes, MigrationJobTypes } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { AttachmentMigration } from '~/modules/jobs/migration-jobs/nc_job_001_attachment';
import { ThumbnailMigration } from '~/modules/jobs/migration-jobs/nc_job_002_thumbnail';
import {
  getMigrationJobsState,
  instanceUuid,
  setMigrationJobsStallInterval,
  updateMigrationJobsState,
} from '~/helpers/migrationJobs';

@Injectable()
export class InitMigrationJobs {
  migrationJobsList = [
    {
      version: '1',
      job: MigrationJobTypes.Attachment,
      service: this.attachmentMigration,
    },
    {
      version: '2',
      job: MigrationJobTypes.Thumbnail,
      service: this.thumbnailMigration,
    },
  ];

  private readonly debugLog = debug('nc:migration-jobs:init');

  constructor(
    @Inject(forwardRef(() => 'JobsService'))
    private readonly jobsService: IJobsService,
    private readonly attachmentMigration: AttachmentMigration,
    private readonly thumbnailMigration: ThumbnailMigration,
  ) {}

  log = (...msgs: string[]) => {
    console.log('[init-migration-jobs]: ', ...msgs);
  };

  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const migrationJobsState = await getMigrationJobsState();

    // check for stall (no update for 10 mins)
    if (migrationJobsState.locked) {
      if (Date.now() - migrationJobsState.stall_check > 10 * 60 * 1000) {
        migrationJobsState.locked = false;
        migrationJobsState.stall_check = Date.now();

        await updateMigrationJobsState(migrationJobsState);
      }
    }

    // check for lock
    if (migrationJobsState.locked) {
      if (migrationJobsState.instance === instanceUuid) {
        // lock taken by this instance
        return;
      }

      // migration job is running, make sure it's not stalled by checking after 10 mins
      // stall check is updated every 5 mins
      setTimeout(() => {
        this.jobsService.add(JobTypes.InitMigrationJobs, {});
      }, 10 * 60 * 1000);
      return;
    }

    // get migrations need to be applied
    const migrations = this.migrationJobsList.filter(
      (m) => +m.version > +migrationJobsState.version,
    );

    if (!migrations.length) {
      return;
    }

    // lock the migration job
    migrationJobsState.locked = true;
    migrationJobsState.stall_check = Date.now();

    // try to take lock
    await updateMigrationJobsState(migrationJobsState, migrationJobsState);

    // wait for 5 seconds to confirm lock
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const confirmState = await getMigrationJobsState();

    // check if lock is taken by this instance
    if (confirmState.locked && confirmState.instance === instanceUuid) {
      // run first migration in the list
      const migration = migrations[0];
      try {
        // set stall interval
        const stallInterval = setMigrationJobsStallInterval();

        // run migration (pass service as this context)
        const migrated = await migration.service.job();

        // prepare state
        if (migrated) {
          migrationJobsState.version = migration.version;
          migrationJobsState.locked = false;
          migrationJobsState.stall_check = Date.now();
        } else {
          migrationJobsState.locked = false;
          migrationJobsState.stall_check = Date.now();
        }

        // update state
        await updateMigrationJobsState(migrationJobsState);

        // clear stall interval
        clearInterval(stallInterval);

        // run the job again if successful
        if (migrated) {
          await this.jobsService.add(JobTypes.InitMigrationJobs, {});
        } else {
          this.log('A migration job failed!');
        }
      } catch (e) {
        this.log('Error running migration: ', e);
      }
    }

    this.debugLog(`job completed for ${job.id}`);
  }
}
