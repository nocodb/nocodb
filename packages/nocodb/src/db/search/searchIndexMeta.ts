import type { MetaType, TableReqType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { Model } from '~/models';
import { NcError } from '~/helpers/catchError';

// Search indexes are EE; EE shadows this file.

export type GlobalSearchMode = 'off' | 'index' | 'on';

export interface GlobalSearchModeStatus {
  env: GlobalSearchMode;
  override: GlobalSearchMode | null;
  mode: GlobalSearchMode;
}

export function isGlobalSearchEnabled() {
  return false;
}

/** Write a client's `meta` for the table; `extra` is written with it. */
export async function replaceClientModelMeta(
  context: NcContext,
  modelId: string,
  clientMeta: MetaType,
  extra?: Pick<TableReqType, 'description'>,
) {
  if (typeof clientMeta === 'string') {
    try {
      JSON.parse(clientMeta);
    } catch {
      NcError.get(context).invalidRequestBody('Invalid table meta');
    }
  }
  await Model.updateMeta(context, modelId, { ...extra, meta: clientMeta });
}
