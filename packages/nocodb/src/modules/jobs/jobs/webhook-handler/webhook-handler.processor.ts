import { Process, Processor } from '@nestjs/bull';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  type HandleWebhookJobData,
  JOBS_QUEUE,
  JobTypes,
} from '~/interface/Jobs';
import { HookHandlerService } from '~/services/hook-handler.service';

@Processor(JOBS_QUEUE)
export class WebhookHandlerProcessor {
  private logger = new Logger(WebhookHandlerProcessor.name);

  constructor(
    @Inject(forwardRef(() => HookHandlerService))
    private readonly hookHandlerService: HookHandlerService,
  ) {}

  @Process(JobTypes.HandleWebhook)
  async job(job: Job<HandleWebhookJobData>) {
    await this.hookHandlerService.handleHooks(job.data);
  }
}
