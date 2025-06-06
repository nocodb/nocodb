import { forwardRef, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from '~/modules/scheduler/scheduler.service';
import { WebhookScheduler } from '~/modules/scheduler/cron/webhook-scheduler';
import { NocoModule } from '~/modules/noco.module';
import { JobsModule } from '~/modules/jobs/jobs.module';

@Module({
  imports: [ScheduleModule.forRoot(), forwardRef(() => NocoModule), JobsModule],
  providers: [SchedulerService, WebhookScheduler],
  exports: [SchedulerService],
})
export class SchedulerModule {
  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly webhookScheduler: WebhookScheduler,
  ) {
    this.schedulerService.registerEntityScheduler(this.webhookScheduler);
  }
}
