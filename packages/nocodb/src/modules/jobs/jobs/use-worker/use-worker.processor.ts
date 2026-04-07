import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { TablesService } from '~/services/tables.service';
import { AttachmentsService } from '~/services/attachments.service';

@Injectable()
export class UseWorkerProcessor {
  private logger = new Logger(UseWorkerProcessor.name);

  constructor(
    protected readonly attachmentsService: AttachmentsService,
    protected readonly tablesService: TablesService,
  ) {}

  protected get serviceMap(): Record<string, any> {
    return {
      [AttachmentsService.name]: this.attachmentsService,
      [TablesService.name]: this.tablesService,
    };
  }

  async job(
    job: Job<{
      service: string;
      method: string;
      args: any[];
    }>,
  ) {
    const { service, method, args } = job.data;
    const processor = this.serviceMap[service];
    // Use __original to bypass @Pollable decorator and call the real method
    const fn = processor[method].__original || processor[method];
    return fn.apply(processor, args);
  }
}
