import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';

export type SharedBaseAccessRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected';

export default class SharedBaseAccessRequest {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_user_id?: string;
  requested_role?: string;
  status?: SharedBaseAccessRequestStatus;
  message?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | Date | null;
  created_at?: string | Date;
  updated_at?: string | Date;

  constructor(data: Partial<SharedBaseAccessRequest>) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const row = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.SHARED_BASE_ACCESS_REQUESTS,
      id,
    );
    return row && new SharedBaseAccessRequest(row);
  }

  public static async getByBaseAndUser(
    context: NcContext,
    baseId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const row = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.SHARED_BASE_ACCESS_REQUESTS,
      {
        base_id: baseId,
        fk_user_id: userId,
      },
    );
    return row && new SharedBaseAccessRequest(row);
  }

  public static async listByBase(
    context: NcContext,
    baseId: string,
    status?: SharedBaseAccessRequestStatus,
    ncMeta = Noco.ncMeta,
  ): Promise<SharedBaseAccessRequest[]> {
    const condition: Record<string, any> = { base_id: baseId };
    if (status) condition.status = status;

    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SHARED_BASE_ACCESS_REQUESTS,
      {
        condition,
        orderBy: { created_at: 'desc' },
      },
    );

    return rows.map((row) => new SharedBaseAccessRequest(row));
  }

  public static async insert(
    context: NcContext,
    data: Partial<SharedBaseAccessRequest>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(data, [
      'fk_workspace_id',
      'base_id',
      'fk_user_id',
      'requested_role',
      'status',
      'message',
    ]);

    insertObj.requested_role = insertObj.requested_role || 'editor';
    insertObj.status = insertObj.status || 'pending';

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SHARED_BASE_ACCESS_REQUESTS,
      insertObj,
    );

    return this.get(context, id, ncMeta);
  }

  public static async update(
    context: NcContext,
    id: string,
    data: Partial<SharedBaseAccessRequest>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(data, [
      'requested_role',
      'status',
      'message',
      'reviewed_by',
      'reviewed_at',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SHARED_BASE_ACCESS_REQUESTS,
      updateObj,
      id,
    );

    return this.get(context, id, ncMeta);
  }

  public static async bulkDeleteByBase(
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return ncMeta.metaDelete(
      RootScopes.FULL_BYPASS,
      RootScopes.FULL_BYPASS,
      MetaTable.SHARED_BASE_ACCESS_REQUESTS,
      { base_id: baseId },
    );
  }
}
