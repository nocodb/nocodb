import { UITypes, SyncCategory, TARGET_TABLES } from 'nocodb-sdk';
import { SyncAbstractType, SyncColumnDefinition } from './types';

export { SyncCategory, TARGET_TABLES };

// Canonical definition of the system metadata columns added to every synced
// table. The titles here are mirrored by `SYNC_SYSTEM_COLUMN_TITLES` in
// `nocodb-sdk` (lib/sync), which `isHiddenCol` uses to hide these columns in
// the UI — keep the two lists in sync when adding or removing a field.
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
    column_name: 'remote_namespace',
    title: 'RemoteNamespace',
    uidt: UITypes.SingleLineText,
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
  {
    column_name: 'sync_provider',
    title: 'SyncProvider',
    uidt: UITypes.SingleLineText,
  },
];

export const syncSystemFieldsMap = syncSystemFields.reduce((acc, field) => {
  acc[field.title] = field;
  return acc;
}, {} as Record<string, SyncColumnDefinition>);

/**
 * Column names commonly used as a row's last-modified timestamp, checked in
 * order. Used to default `systemFields.updatedAt` for custom DB syncs so
 * incremental sync has a cursor without the user manually designating one.
 */
const UPDATED_AT_COLUMN_CANDIDATES = [
  'updated_at',
  'updatedat',
  'last_update',
  'last_updated',
  'last_updated_at',
  'last_modified',
  'last_modified_at',
  'modified_at',
  'updated_on',
  'modified_on',
];

/**
 * Pick the column to use as the incremental-sync cursor (`systemFields.updatedAt`)
 * from a table's columns: the first date/datetime column whose name matches a
 * well-known last-modified pattern. Returns `undefined` when there is no obvious
 * candidate — the user can still designate one manually in the schema mapping.
 */
export function detectUpdatedAtColumn(
  columns: { title: string; abstractType?: SyncAbstractType }[],
): string | undefined {
  for (const candidate of UPDATED_AT_COLUMN_CANDIDATES) {
    const match = columns.find(
      (column) =>
        column.title.toLowerCase() === candidate &&
        (column.abstractType === 'datetime' || column.abstractType === 'date'),
    );

    if (match) {
      return match.title;
    }
  }

  return undefined;
}
