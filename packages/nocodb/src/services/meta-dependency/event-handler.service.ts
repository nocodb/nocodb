import { Inject, Injectable } from '@nestjs/common';
import {
  META_DEPENDENCY_MODULE_PROVIDER_KEY,
  type MetaDependencyEventRequest,
  type MetaEventHandler,
} from './types';
import type { MetaEventType, NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import Noco from '~/Noco';

@Injectable()
export class MetaDependencyEventHandler {
  constructor(
    @Inject(META_DEPENDENCY_MODULE_PROVIDER_KEY)
    protected readonly metaEventHandlers: MetaEventHandler[],
  ) {
    this.registerEvents(metaEventHandlers);
  }

  metaEventHandlerMap: Record<MetaEventType, MetaEventHandler[]> = {
    COLUMN_ADDED: [],
    COLUMN_DELETED: [],
    COLUMN_UPDATED: [],
  };

  registerEvents(metaEventHandler: MetaEventHandler[]) {
    for (const each of metaEventHandler) {
      for (const eachType of each.triggerMetaEvents) {
        this.metaEventHandlerMap[eachType] =
          this.metaEventHandlerMap[eachType] ?? [];
        this.metaEventHandlerMap[eachType].push(each);
      }
    }
  }

  async handleEvent(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ) {
    // if suppressed, do not make further evaluation
    if (context.suppressDependencyEvaluation) {
      return;
    }
    // next context will have suppressDependencyEvaluation as true by default unless modules override it.
    const nextContext = {
      ...context,
      suppressDependencyEvaluation: true,
    } as NcContext;
    let trxNcMeta: MetaService;
    try {
      for (const handler of this.metaEventHandlerMap[param.eventType] ?? []) {
        const affectedDependencies = await handler.getAffectedDependency(
          nextContext,
          param,
          trxNcMeta ?? ncMeta,
        );
        if (affectedDependencies) {
          trxNcMeta = trxNcMeta ?? (await ncMeta.startTransaction());
          await handler.handle(
            nextContext,
            {
              ...param,
              affectedDependencyResult: affectedDependencies,
            },
            trxNcMeta,
          );
        }
      }
      await trxNcMeta?.commit();
    } catch (ex) {
      await trxNcMeta?.rollback();
      throw ex;
    }
  }
}
