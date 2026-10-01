import { Inject, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  META_DEPENDENCY_MODULE_PROVIDER_KEY,
  type MetaDependencyEventRequest,
  type MetaEventHandler,
} from './types';
import type { OnModuleInit, Type } from '@nestjs/common';
import type { MetaEventType, NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import Noco from '~/Noco';

@Injectable()
export class MetaDependencyEventHandler implements OnModuleInit {
  constructor(
    @Inject(META_DEPENDENCY_MODULE_PROVIDER_KEY)
    protected readonly metaEventHandlerClasses: Type<MetaEventHandler>[],
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    this.registerEvents(
      this.metaEventHandlerClasses.map((cls) =>
        this.moduleRef.get(cls, { strict: false }),
      ),
    );
  }

  metaEventHandlerMap: Record<MetaEventType, MetaEventHandler[]> = {
    COLUMN_ADDED: [],
    COLUMN_DELETED: [],
    COLUMN_UPDATED: [],
    HOOK_DELETED: [],
    FILTER_CREATED: [],
    FILTER_UPDATED: [],
    FILTER_DELETED: [],
    VIEW_UPDATED: [],
    VIEW_DELETED: [],
    TABLE_DELETED: [],
  };

  registerEvents(metaEventHandler: MetaEventHandler[]) {
    for (const each of metaEventHandler) {
      if (!each || !Array.isArray(each.triggerMetaEvents)) {
        new Logger(MetaDependencyEventHandler.name).error(
          `Skipping meta-dependency handler with invalid triggerMetaEvents: ${
            (each as any)?.constructor?.name ?? String(each)
          }`,
        );
        continue;
      }
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
    const handlers = this.metaEventHandlerMap[param.eventType] ?? [];
    for (let i = 0; i < handlers.length; i++) {
      const affectedDependencies = await handlers[i].getAffectedDependency(
        nextContext,
        param,
        ncMeta,
      );
      if (!affectedDependencies) continue;

      // The first affected handler opens the transaction; the rest run in it.
      await ncMeta.runInTransaction(async (trxNcMeta: MetaService) => {
        await handlers[i].handle(
          nextContext,
          {
            ...param,
            affectedDependencyResult: affectedDependencies,
          },
          trxNcMeta,
        );
        for (const handler of handlers.slice(i + 1)) {
          const affected = await handler.getAffectedDependency(
            nextContext,
            param,
            trxNcMeta,
          );
          if (!affected) continue;
          await handler.handle(
            nextContext,
            {
              ...param,
              affectedDependencyResult: affected,
            },
            trxNcMeta,
          );
        }
      });
      return;
    }
  }
}
