import type { MetaEntityType, MetaEventType, NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';

export interface AffectedDependencyResult {
  bases?: any[];
  models?: any[];
  filters?: any[];
  columns?: any[];
  views?: any[];
  sorts?: any[];
}

export interface MetaDependencyEventRequest {
  eventType: MetaEventType;
  oldEntity?: any;
  newEntity?: any;
}

export interface MetaEventHandler {
  triggerMetaEvents: MetaEventType[];
  getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta?: MetaService,
  ): Promise<undefined | AffectedDependencyResult>;
  handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta?: MetaService,
  ): Promise<void>;
}

export interface MetaEvent<T> {
  eventType: MetaEventType;
  entityType: MetaEntityType;
  entity: T;
}
