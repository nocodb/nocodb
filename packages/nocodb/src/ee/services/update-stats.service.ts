import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { JobTypes } from '~/interface/Jobs';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';

export const UPDATE_WORKSPACE_STAT = '__nc_update_workspace_stat';
export const UPDATE_WORKSPACE_COUNTER = '__nc_update_workspace_counter';

@Injectable()
export class UpdateStatsService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(UpdateStatsService.name);
  private unsubscribe: (() => void)[];

  constructor(
    @Inject('IEventEmitter') private readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') private jobsService,
  ) {}

  private async updateWorkspaceStat({
    fk_workspace_id,
  }: {
    fk_workspace_id?: string;
  }): Promise<void> {
    await this.jobsService.add(JobTypes.UpdateWsStat, {
      fk_workspace_id,
      force: true,
    });
  }

  private async updateWorkspaceCounter({
    fk_workspace_id,
    fk_model_id,
    count,
  }: {
    fk_workspace_id?: string;
    base_id?: string;
    fk_model_id?: string;
    count?: number;
  }): Promise<void> {
    const updatedCount = await NocoCache.incrby(
      'root',
      `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}`,
      count,
    );

    if (fk_model_id) {
      await NocoCache.set(
        'root',
        `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}:models`,
        [fk_model_id],
      );
    }

    // TODO env
    if (+updatedCount > 100) {
      await NocoCache.del(
        'root',
        `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}`,
      );

      await this.jobsService.add(JobTypes.UpdateWsStat, {
        fk_workspace_id,
      });
    }
  }

  onModuleInit(): any {
    this.unsubscribe = [
      this.eventEmitter.on(UPDATE_WORKSPACE_STAT, (arg) => {
        return this.updateWorkspaceStat(arg).catch((e) => {
          this.logger.error('Error in UPDATE_WORKSPACE_STAT');
          this.logger.error(e);
        });
      }),
      this.eventEmitter.on(UPDATE_WORKSPACE_COUNTER, (arg) => {
        return this.updateWorkspaceCounter(arg).catch((e) => {
          this.logger.error('Error in UPDATE_WORKSPACE_COUNTER');
          this.logger.error(e);
        });
      }),
    ];
  }

  onModuleDestroy() {
    this.unsubscribe.forEach((f) => f());
  }
}
