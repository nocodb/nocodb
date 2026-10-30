import { Logger } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import User from '~/models/User';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable } from '~/utils/globals';
import { isReplay } from '~/helpers/replayScope';
import { decryptPropIfRequired, encryptPropIfRequired } from '~/utils';
import { sha256Hex } from '~/helpers/sha256';

const logger = new Logger('SyncSource');

// Rows written before encryption hold plain JSON, so anything that parses is
// read as-is and the rest is ciphertext.
const parseDetails = (details: unknown) => {
  if (!details || typeof details !== 'string') return details;

  try {
    return JSON.parse(details);
  } catch {}

  try {
    return decryptPropIfRequired({ data: { details }, prop: 'details' });
  } catch {
    logger.warn('Failed to decrypt sync source details');
    return null;
  }
};

// Stands in for the Airtable token in every copy that leaves the row; saved back, it keeps the token.
export const SYNC_SECRET_MASK = '********';

// Recorded sandbox edits carry the mask plus this short hash of the token they typed.
export const SYNC_TOKEN_FINGERPRINT = '__nc_recorded_token_fp';

export const syncTokenFingerprint = (token: string) =>
  sha256Hex(token).slice(0, 12);

const serializeDetails = (details: unknown) => {
  if (details && typeof details === 'object') {
    const { [SYNC_TOKEN_FINGERPRINT]: _fp, ...rest } = details as Record<
      string,
      unknown
    >;
    details = rest;
  }
  return encryptPropIfRequired({ data: { details }, prop: 'details' });
};

export const maskSyncDetails = <T extends { apiKey?: unknown } | undefined>(
  details: T,
): T => (details?.apiKey ? { ...details, apiKey: SYNC_SECRET_MASK } : details);

export const omitSyncToken = (details?: Record<string, unknown>) => {
  const { apiKey: _apiKey, ...rest } = details ?? {};
  return rest;
};

export default class SyncSource {
  id?: string;
  title?: string;
  type?: string;
  details?: any;
  deleted?: boolean;
  order?: number;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  fk_user_id?: string;

  constructor(syncSource: Partial<SyncSource>) {
    Object.assign(this, syncSource);
  }

  public getUser(ncMeta = Noco.ncMeta) {
    return User.get(this.fk_user_id, ncMeta);
  }

  public static async get(
    context: NcContext,
    syncSourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const syncSource = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      syncSourceId,
    );
    if (!syncSource) return null;
    syncSource.details = parseDetails(syncSource.details);
    return new SyncSource(syncSource);
  }

  static async list(
    context: NcContext,
    baseId: string,
    sourceId?: string,
    ncMeta = Noco.ncMeta,
  ) {
    const condition = sourceId
      ? { base_id: baseId, source_id: sourceId }
      : { base_id: baseId };
    const syncSources = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      {
        condition,
        orderBy: {
          created_at: 'asc',
        },
      },
    );

    for (const syncSource of syncSources) {
      syncSource.details = parseDetails(syncSource.details);
    }
    return syncSources?.map((h) => new SyncSource(h));
  }

  public static async insert(
    context: NcContext,
    syncSource: Partial<SyncSource>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(syncSource, [
      'title',
      'type',
      'details',
      'base_id',
      'source_id',
      'fk_user_id',
    ]);

    // Replay-only: preserve sandbox / undo-redo entity ID for idempotent merge.
    if (isReplay() && syncSource.id) {
      insertObj.id = syncSource.id;
    }

    if (insertObj.details) {
      insertObj.details = serializeDetails(insertObj.details);
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      insertObj,
    );

    return this.get(context, id, ncMeta);
  }

  public static async update(
    context: NcContext,
    syncSourceId: string,
    syncSource: Partial<SyncSource>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(syncSource, [
      'id',
      'title',
      'type',
      'details',
      'deleted',
      'order',
      'base_id',
      'source_id',
    ]);

    if (updateObj.details) {
      updateObj.details = serializeDetails(updateObj.details);
    }

    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      updateObj,
      syncSourceId,
    );

    return this.get(context, syncSourceId, ncMeta);
  }

  static async delete(
    context: NcContext,
    syncSourceId: any,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      syncSourceId,
    );
  }

  static async deleteByUserId(userId: string, ncMeta = Noco.ncMeta) {
    if (!userId) NcError.badRequest('User Id is required');

    return await ncMeta
      .knex(MetaTable.SYNC_SOURCE)
      .where({
        fk_user_id: userId,
      })
      .del();
  }
}
