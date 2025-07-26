import { Injectable } from '@nestjs/common';
import type { Job } from 'bull';
import type { AttachmentUrlUploadJobData } from '~/interface/Jobs';
import { DataAttachmentV3Service } from '~/services/v3/data-attachment-v3.service';

@Injectable()
export class AttachmentUrlUploadProcessor {
  constructor(
    private readonly dataAttachmentV3Service: DataAttachmentV3Service,
  ) {}

  async job(job: Job<AttachmentUrlUploadJobData>) {
    await this.dataAttachmentV3Service.handleUrlUploadCellUpdate(job.data);
  }
}
