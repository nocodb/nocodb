import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { forwardRef, Inject } from '@nestjs/common';
import { JOBS_QUEUE, MigrationJobTypes } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import {
  getMigrationJobsState,
  updateMigrationJobsState,
} from '~/helpers/migrationJobs';

const migrationJobsList = [{ version: '1', job: MigrationJobTypes.Attachment }];

@Processor(JOBS_QUEUE)
export class InitMigrationJobs {
  private readonly debugLog = debug('nc:migration-jobs:init');

  constructor(
    @Inject(forwardRef(() => 'JobsService'))
    private readonly jobsService: IJobsService,
  ) {}

  log = (...msgs: string[]) => {
    console.log('[init-migration-jobs]: ', ...msgs);
  };

  @Process(MigrationJobTypes.InitMigrationJobs)
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
      // migration job is running, make sure it's not stalled by checking after 10 mins
      // stall check is updated every 5 mins
      setTimeout(() => {
        this.jobsService.add(MigrationJobTypes.InitMigrationJobs, {});
      }, 10 * 60 * 1000);
      return;
    }

    // get migrations need to be applied
    const migrations = migrationJobsList.filter(
      (m) => +m.version > +migrationJobsState.version,
    );

    if (!migrations.length) {
      return;
    }

    // lock the migration job
    migrationJobsState.locked = true;
    migrationJobsState.stall_check = Date.now();

    await updateMigrationJobsState(migrationJobsState);

    // run first migration job
    await this.jobsService.add(migrations[0].job, {});

    this.debugLog(`job completed for ${job.id}`);
  }
}
