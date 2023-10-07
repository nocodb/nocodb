import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JobTypes } from '~/interface/Jobs';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';

export const HANDLE_STATS = '__nc_handleStats';

@Injectable()
export class UpdateStatsService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: () => void;

  constructor(
    @Inject('IEventEmitter') private readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') private jobsService,
  ) {}

  private async handleStats({
    fk_workspace_id,
    fk_model_id,
    row_count,
  }: {
    fk_workspace_id?: string;
    fk_model_id: string;
    row_count?: number;
  }): Promise<void> {
    await this.jobsService.add(JobTypes.UpdateStats, {
      fk_workspace_id,
      fk_model_id,
      row_count,
    });
  }

  onModuleInit(): any {
    this.unsubscribe = this.eventEmitter.on(
      HANDLE_STATS,
      this.handleStats.bind(this),
    );
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }
}
