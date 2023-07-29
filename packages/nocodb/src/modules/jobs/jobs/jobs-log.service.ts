import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JobEvents } from '../../../interface/Jobs';
import type { Job } from 'bull';

@Injectable()
export class JobsLogService {
  constructor(private eventEmitter: EventEmitter2) {}

  sendLog(job: Job, data: { message: string }) {
    this.eventEmitter.emit(JobEvents.LOG, {
      id: job.id.toString(),
      data,
    });
  }
}
