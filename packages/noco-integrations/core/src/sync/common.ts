import { UITypes } from 'nocodb-sdk';

export const syncSystemFields = [
  // Generic System Fields
  {
    column_name: 'remote_id',
    title: 'RemoteId',
    uidt: UITypes.SingleLineText,
    system: true,
  },
  {
    column_name: 'remote_created_at',
    title: 'RemoteCreatedAt',
    uidt: UITypes.DateTime,
    system: true,
  },
  {
    column_name: 'remote_updated_at',
    title: 'RemoteUpdatedAt',
    uidt: UITypes.DateTime,
    system: true,
  },
  {
    column_name: 'remote_deleted_at',
    title: 'RemoteDeletedTime',
    uidt: UITypes.DateTime,
    system: true,
  },
  {
    column_name: 'remote_was_deleted',
    title: 'RemoteWasDeleted',
    uidt: UITypes.Checkbox,
    system: true,
  },
  {
    column_name: 'remote_raw',
    title: 'RemoteRaw',
    uidt: UITypes.LongText,
    system: true,
  },
  {
    column_name: 'remote_synced_at',
    title: 'RemoteSyncedAt',
    uidt: UITypes.DateTime,
    system: true,
  },
  {
    column_name: 'sync_config_id',
    title: 'SyncConfigId',
    uidt: UITypes.SingleLineText,
    system: true,
  },
];

export enum TARGET_TABLES {
  TICKETING_TICKET = 'ticketing_ticket',
  TICKETING_USER = 'ticketing_user',
}
