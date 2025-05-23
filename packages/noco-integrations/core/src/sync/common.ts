import { UITypes } from 'nocodb-sdk';
import { SyncColumnDefinition } from './types';

export const syncSystemFields: SyncColumnDefinition[] = [
  // Generic System Fields
  {
    column_name: 'remote_id',
    title: 'RemoteId',
    uidt: UITypes.SingleLineText,
  },
  {
    column_name: 'remote_created_at',
    title: 'RemoteCreatedAt',
    uidt: UITypes.DateTime,
  },
  {
    column_name: 'remote_updated_at',
    title: 'RemoteUpdatedAt',
    uidt: UITypes.DateTime,
  },
  {
    column_name: 'remote_deleted_at',
    title: 'RemoteDeletedTime',
    uidt: UITypes.DateTime,
  },
  {
    column_name: 'remote_deleted',
    title: 'RemoteDeleted',
    uidt: UITypes.Checkbox,
  },
  {
    column_name: 'remote_raw',
    title: 'RemoteRaw',
    uidt: UITypes.LongText,
  },
  {
    column_name: 'remote_synced_at',
    title: 'RemoteSyncedAt',
    uidt: UITypes.DateTime,
  },
  {
    column_name: 'sync_config_id',
    title: 'SyncConfigId',
    uidt: UITypes.SingleLineText,
  },
  {
    column_name: 'sync_run_id',
    title: 'SyncRunId',
    uidt: UITypes.SingleLineText,
  },
];

export const syncSystemFieldsMap = syncSystemFields.reduce((acc, field) => {
  acc[field.title] = field;
  return acc;
}, {} as Record<string, SyncColumnDefinition>);

export enum TARGET_TABLES {
  TICKETING_TICKET = 'ticketing_ticket',
  TICKETING_USER = 'ticketing_user',
  TICKETING_COMMENT = 'ticketing_comment',
}
