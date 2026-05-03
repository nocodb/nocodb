import type {
  NcContext,
  OperationLogStatus,
  OperationLogType,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

export default class OperationLog implements OperationLogType {
  id?: string;
  seq?: number;
  fk_workspace_id?: string;
  base_id?: string;
  fk_user_id?: string;
  tab_id?: string;
  forward_op?: string;
  forward_op_version?: number;
  forward_params?: string;
  inverse_op?: string;
  inverse_op_version?: number;
  inverse_params?: string;
  entity_type?: string;
  entity_id?: string;
  entity_title?: string;
  description?: string;
  status?: OperationLogStatus;
  error?: string;
  undone_at?: string | null;
  created_at?: string;
  updated_at?: string;

  constructor(data: Partial<OperationLog>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    input,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<OperationLog> {
    let insertData = extractProps(input, [
      'fk_user_id',
      'tab_id',
      'forward_op',
      'forward_op_version',
      'inverse_op',
      'inverse_op_version',
      'entity_type',
      'entity_id',
      'entity_title',
      'description',
      'forward_params',
      'inverse_params',
    ]);

    insertData = {
      ...insertData,
      seq: Date.now(),
      forward_op_version: input.forward_op_version ?? 1,
      inverse_op_version: input.inverse_op_version ?? 1,
      status: 'active',
    };

    insertData = prepareForDb(insertData, ['forward_params', 'inverse_params']);

    const row = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.OPERATION_LOGS,
      insertData,
    );

    return this.castType(row);
  }

  public static async getLatestActive(
    context: NcContext,
    key: { fk_user_id: string; tab_id: string },
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<OperationLog | null> {
    return this.getLatestByStatus(context, key, 'active', ncMeta);
  }

  public static async getLatestUndone(
    context: NcContext,
    key: { fk_user_id: string; tab_id: string },
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<OperationLog | null> {
    return this.getLatestByStatus(context, key, 'undone', ncMeta);
  }

  public static async countByStatus(
    context: NcContext,
    key: { fk_user_id: string; tab_id: string },
    status: OperationLogStatus,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<number> {
    return ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.OPERATION_LOGS,
      {
        condition: {
          fk_user_id: key.fk_user_id,
          base_id: context.base_id,
          tab_id: key.tab_id,
          status,
        },
      },
    );
  }

  public static async markStatus(
    context: NcContext,
    id: string,
    status: OperationLogStatus,
    extra: { error?: string; undone_at?: Date | string | null } = {},
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<void> {
    const updateObj = extractProps({ status, ...extra }, [
      'status',
      'error',
      'undone_at',
    ]);
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.OPERATION_LOGS,
      updateObj,
      id,
    );
  }

  private static async getLatestByStatus(
    context: NcContext,
    key: { fk_user_id: string; tab_id: string },
    status: OperationLogStatus,
    ncMeta: MetaService,
  ): Promise<OperationLog | null> {
    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.OPERATION_LOGS,
      {
        condition: {
          fk_user_id: key.fk_user_id,
          base_id: context.base_id,
          tab_id: key.tab_id,
          status,
        },
        orderBy: { seq: 'desc' },
        limit: 1,
      },
    );
    return rows[0] ? this.castType(rows[0]) : null;
  }

  public static castType(row: any): OperationLog {
    if (!row) return null as any;
    const prepared = prepareForResponse(row, [
      'forward_params',
      'inverse_params',
    ]);
    return new OperationLog(prepared);
  }
}
