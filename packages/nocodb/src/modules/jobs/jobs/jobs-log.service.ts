import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Job } from 'bull';
import { JobEvents } from '~/interface/Jobs';

@Injectable()
export class JobsLogService {
  constructor(private eventEmitter: EventEmitter2) {}

  sendLog(job: Partial<Job>, data: { message: string }) {
    this.eventEmitter.emit(JobEvents.LOG, {
      id: job.id.toString(),
      data,
    });
  }
}
