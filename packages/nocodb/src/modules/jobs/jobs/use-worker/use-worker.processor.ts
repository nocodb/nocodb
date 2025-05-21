import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { TablesService } from '~/services/tables.service';
import { AttachmentsService } from '~/services/attachments.service';

@Injectable()
export class UseWorkerProcessor {
  private logger = new Logger(UseWorkerProcessor.name);

  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly tablesService: TablesService,
  ) {}

  serviceMap = {
    [AttachmentsService.name]: this.attachmentsService,
    [TablesService.name]: this.tablesService,
  };

  async job(
    job: Job<{
      service: string;
      method: string;
      args: any[];
    }>,
  ) {
    const { service, method, args } = job.data;
    return this.serviceMap[service][method](...args);
  }
}
