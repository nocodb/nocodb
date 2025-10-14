import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EMIT_EVENT } from '~/constants';
import { JobTypes } from '~/interface/Jobs';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

@Injectable()
export class AttachmentUrlUploadHandler
  implements OnModuleInit, OnModuleDestroy
{
  private logger = new Logger(AttachmentUrlUploadHandler.name);
  private unsubscribe: () => void;

  constructor(
    @Inject('IEventEmitter') private readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  onModuleInit(): any {
    this.unsubscribe = this.eventEmitter.on(
      EMIT_EVENT.HANDLE_ATTACHMENT_URL_UPLOAD,
      async (arg) => {
        try {
          await this.jobsService.add(JobTypes.AttachmentUrlUpload, arg);
        } catch (e) {
          this.logger.error({
            error: e,
          });
        }
      },
    );
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }
}
