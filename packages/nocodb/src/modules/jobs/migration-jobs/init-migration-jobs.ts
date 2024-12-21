import debug from 'debug';
import { v4 as uuidv4 } from 'uuid';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import type { Job } from 'bull';
import { JobTypes, MigrationJobTypes } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { AttachmentMigration } from '~/modules/jobs/migration-jobs/nc_job_001_attachment';
import { ThumbnailMigration } from '~/modules/jobs/migration-jobs/nc_job_002_thumbnail';
import {
  getMigrationJobsState,
  setMigrationJobsStallInterval,
  updateMigrationJobsState,
} from '~/helpers/migrationJobs';
import { RecoverLinksMigration } from '~/modules/jobs/migration-jobs/nc_job_003_recover_links';
import { CleanupDuplicateColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_004_cleanup_duplicate_column';
import { OrderColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_005_order_column';
import { RecoverOrderColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_007_recover_order_column';
import { NoOpMigration } from '~/modules/jobs/migration-jobs/nc_job_no_op';
import { isEE } from '~/utils';

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
    {
      version: '3',
      job: MigrationJobTypes.RecoverLinks,
      service: this.recoverLinksMigration,
    },
    {
      version: '4',
      job: MigrationJobTypes.CleanupDuplicateColumns,
      service: this.cleanupDuplicateColumnMigration,
    },
    {
      version: '5',
      job: MigrationJobTypes.NoOpMigration,
      service: isEE ? this.orderColumnMigration : this.noOpMigration,
    },
    {
      version: '6',
      job: MigrationJobTypes.OrderColumnCreation,
      service: isEE ? this.noOpMigration : this.orderColumnMigration,
    },
    {
      version: '7',
      job: MigrationJobTypes.RecoverOrderColumnMigration,
      service: isEE ? this.noOpMigration : this.recoverOrderColumnMigration,
    },
  ];

  private readonly debugLog = debug('nc:migration-jobs:init');

  constructor(
    @Inject(forwardRef(() => 'JobsService'))
    private readonly jobsService: IJobsService,
    private readonly attachmentMigration: AttachmentMigration,
    private readonly thumbnailMigration: ThumbnailMigration,
    private readonly recoverLinksMigration: RecoverLinksMigration,
    private readonly cleanupDuplicateColumnMigration: CleanupDuplicateColumnMigration,
    private readonly orderColumnMigration: OrderColumnMigration,
    private readonly recoverOrderColumnMigration: RecoverOrderColumnMigration,
    private readonly noOpMigration: NoOpMigration,
  ) {}

  log = (...msgs: string[]) => {
    console.log('[init-migration-jobs]: ', ...msgs);
  };

  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    // create a unique id for this run
    const runUuid = uuidv4();

    const migrationJobsState = await getMigrationJobsState();

    // check for stall (no update for 10 mins)
    if (migrationJobsState.locked) {
      if (Date.now() - migrationJobsState.stall_check > 10 * 60 * 1000) {
        migrationJobsState.locked = false;
        migrationJobsState.stall_check = Date.now();

        await updateMigrationJobsState(migrationJobsState);

        return this.job(job);
      }
    }

    // check for lock
    if (migrationJobsState.locked) {
      if (migrationJobsState.instance === runUuid) {
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
    migrationJobsState.instance = runUuid;

    // try to take lock
    await updateMigrationJobsState(migrationJobsState, migrationJobsState);

    // wait for 5 seconds to confirm lock
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const confirmState = await getMigrationJobsState();

    // check if lock is taken by this instance
    if (confirmState.locked && confirmState.instance === runUuid) {
      // run first migration in the list
      const migration = migrations[0];
      try {
        // set stall interval
        const stallInterval = setMigrationJobsStallInterval();

        let migrated = false;

        try {
          // run migration (pass service as this context)
          migrated = await migration.service.job();
          // prepare state
          if (migrated) {
            migrationJobsState.version = migration.version;
            migrationJobsState.locked = false;
            migrationJobsState.stall_check = Date.now();
          } else {
            migrationJobsState.locked = false;
            migrationJobsState.stall_check = Date.now();
          }
        } catch (e) {
          this.log('Error running migration: ', e);
          migrationJobsState.locked = false;
          migrationJobsState.stall_check = Date.now();
        } finally {
          clearInterval(stallInterval);

          // update state
          await updateMigrationJobsState(migrationJobsState);

          if (migrated) {
            // run next job
            this.jobsService.add(JobTypes.InitMigrationJobs, {});
          }
        }
      } catch (e) {
        this.log('Error running migration: ', e);
      }
    }

    this.debugLog(`job completed for ${job.id}`);
  }
}
