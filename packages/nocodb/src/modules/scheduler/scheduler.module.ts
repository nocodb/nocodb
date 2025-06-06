import { forwardRef, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from '~/modules/scheduler/scheduler.service';
import { NocoModule } from '~/modules/noco.module';
import { JobsModule } from '~/modules/jobs/jobs.module';

@Module({
  imports: [ScheduleModule.forRoot(), forwardRef(() => NocoModule), JobsModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {
  constructor(private readonly _schedulerService: SchedulerService) {}
}
