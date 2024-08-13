import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { JobTypes } from '~/interface/Jobs';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';

export const UPDATE_MODEL_STAT = '__nc_update_modal_stat';
export const UPDATE_WORKSPACE_STAT = '__nc_update_workspace_stat';
export const UPDATE_WORKSPACE_COUNTER = '__nc_update_workspace_counter';

@Injectable()
export class UpdateStatsService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void)[];

  constructor(
    @Inject('IEventEmitter') private readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') private jobsService,
  ) {}

  private async updateModelStat(
    context: NcContext,
    {
      fk_workspace_id,
      fk_model_id,
      row_count,
      updated_at,
    }: {
      fk_workspace_id?: string;
      base_id?: string;
      fk_model_id: string;
      row_count?: number;
      updated_at?: string;
    },
  ): Promise<void> {
    await this.jobsService.add(JobTypes.UpdateModelStat, {
      context,
      fk_workspace_id,
      fk_model_id,
      row_count,
      updated_at: updated_at || new Date().toISOString(),
    });
  }

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
      `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}`,
      count,
    );

    if (fk_model_id) {
      await NocoCache.set(
        `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}:models`,
        [fk_model_id],
      );
    }

    // TODO env
    if (+updatedCount > 500) {
      await NocoCache.del(
        `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}`,
      );

      await this.jobsService.add(JobTypes.UpdateWsStat, {
        fk_workspace_id,
      });
    }
  }

  onModuleInit(): any {
    this.unsubscribe = [
      this.eventEmitter.on(UPDATE_MODEL_STAT, (arg) => {
        const { context, ...rest } = arg;
        return this.updateModelStat(context, rest);
      }),
      this.eventEmitter.on(UPDATE_WORKSPACE_STAT, (arg) => {
        return this.updateWorkspaceStat(arg);
      }),
      this.eventEmitter.on(UPDATE_WORKSPACE_COUNTER, (arg) => {
        return this.updateWorkspaceCounter(arg);
      }),
    ];
  }

  onModuleDestroy() {
    this.unsubscribe.forEach((f) => f());
  }
}
