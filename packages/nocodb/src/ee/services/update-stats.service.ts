import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CacheGetType, CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { JobTypes } from '~/interface/Jobs';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';

export const UPDATE_MODEL_STAT = '__nc_update_modal_stat';
export const UPDATE_WORKSPACE_COUNTER = '__nc_update_workspace_counter';

@Injectable()
export class UpdateStatsService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void)[];

  constructor(
    @Inject('IEventEmitter') private readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') private jobsService,
  ) {}

  private async updateModelStat({
    fk_workspace_id,
    base_id,
    fk_model_id,
    row_count,
  }: {
    fk_workspace_id?: string;
    base_id?: string;
    fk_model_id: string;
    row_count?: number;
  }): Promise<void> {
    if (!fk_workspace_id && base_id) {
      fk_workspace_id = await getWorkspaceForBase(base_id);
    }

    await this.jobsService.add(JobTypes.UpdateModelStat, {
      fk_workspace_id,
      fk_model_id,
      row_count,
      updated_at: new Date().toISOString(),
    });
  }

  private async updateWorkspaceCounter({
    fk_workspace_id,
    base_id,
    fk_model_id,
    count,
  }: {
    fk_workspace_id?: string;
    base_id?: string;
    fk_model_id?: string;
    count?: number;
  }): Promise<void> {
    if (!fk_workspace_id && base_id) {
      fk_workspace_id = await getWorkspaceForBase(base_id);
    }

    await NocoCache.incrby(
      `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}`,
      count,
    );

    const updatedCount = await NocoCache.get(
      `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}`,
      CacheGetType.TYPE_STRING,
    );

    const updatedModels = await NocoCache.get(
      `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}:models`,
      CacheGetType.TYPE_ARRAY,
    );

    if (!updatedModels.includes(fk_model_id)) {
      updatedModels.push(fk_model_id);
      await NocoCache.set(
        `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}:models`,
        updatedModels,
      );
    }

    // TODO env
    if (+updatedCount > 2000) {
      await NocoCache.del(
        `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}`,
      );

      await NocoCache.del(
        `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}:models`,
      );

      await this.jobsService.add(JobTypes.UpdateWsStat, {
        fk_workspace_id,
        updatedModels,
      });
    }
  }

  onModuleInit(): any {
    this.unsubscribe = [
      this.eventEmitter.on(UPDATE_MODEL_STAT, this.updateModelStat.bind(this)),
      this.eventEmitter.on(
        UPDATE_WORKSPACE_COUNTER,
        this.updateWorkspaceCounter.bind(this),
      ),
    ];
  }

  onModuleDestroy() {
    this.unsubscribe.forEach((f) => f());
  }
}
