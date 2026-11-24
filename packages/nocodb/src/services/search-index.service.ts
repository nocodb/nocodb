import { Injectable } from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import type { SearchIndexMode, SearchIndexStatus } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type {
  GlobalSearchMode,
  GlobalSearchModeStatus,
} from '~/db/search/searchIndexMeta';
import { NcError } from '~/helpers/catchError';

/** Search indexes are EE; EE shadows this file. */
@Injectable()
export class SearchIndexService {
  async globalModeGet(): Promise<GlobalSearchModeStatus> {
    return { env: 'off', override: null, mode: 'off' };
  }

  async globalModeSet(_param: {
    mode?: GlobalSearchMode | null;
  }): Promise<GlobalSearchModeStatus> {
    return this.notSupported();
  }

  async build(
    context: NcContext,
    _param: { tableId: string },
  ): Promise<SearchIndexStatus> {
    return this.notSupported(context);
  }

  async drop(
    context: NcContext,
    _param: { tableId: string },
  ): Promise<SearchIndexStatus> {
    return this.notSupported(context);
  }

  async setMode(
    context: NcContext,
    _param: { tableId: string; mode: SearchIndexMode },
  ): Promise<SearchIndexStatus> {
    return this.notSupported(context);
  }

  async status(
    context: NcContext,
    _param: { tableId: string },
  ): Promise<SearchIndexStatus> {
    return this.notSupported(context);
  }

  /** Always throws. */
  private notSupported(context?: NcContext) {
    NcError.get(context).featureNotSupported({
      feature: PlanFeatureTypes.FEATURE_GLOBAL_SEARCH,
    });
    return undefined;
  }
}
