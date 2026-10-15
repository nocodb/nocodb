import type { MetaEntityType, MetaEventType, NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';

export const META_DEPENDENCY_MODULE_PROVIDER_KEY = 'META_DEPENDENCY';

export interface AffectedDependencyResult {
  bases?: any[];
  models?: any[];
  filters?: any[];
  columns?: any[];
  views?: any[];
  sorts?: any[];
}

export interface MarkedDependent {
  id: string;
  type: 'lookup' | 'rollup' | 'qrcode' | 'barcode';
  base_id: string;
}

export interface MetaDependencyEventRequest {
  eventType: MetaEventType;
  oldEntity?: any;
  newEntity?: any;
  // Filled by handlers with every column they error-mark, so callers (trash)
  // can clear the exact same set later.
  markedDependents?: MarkedDependent[];
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
