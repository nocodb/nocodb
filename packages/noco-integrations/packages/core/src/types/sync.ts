import { Readable } from 'stream';
import { UITypes } from 'nocodb-sdk';
import { IntegrationWrapper } from '../integration';
import { AuthResponse } from './auth';
export interface DataObject<
  T = Record<string, string | number | boolean | null>,
> {
  recordId: string;
  data: T;
}

export class DataObjectStream<
  T = Record<string, string | number | boolean | null>,
> extends Readable {
  constructor() {
    super({ objectMode: true });
  }

  _read(_size: number): void {
    return;
  }

  on(event: 'close', listener: () => void): this;
  on(event: 'data', listener: (chunk: DataObject<T>) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'pause', listener: () => void): this;
  on(event: 'readable', listener: () => void): this;
  on(event: 'resume', listener: () => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  push(data: DataObject<T> | null): boolean {
    return super.push(data);
  }
}

export abstract class SyncIntegration extends IntegrationWrapper {
  abstract getDestinationSchema(
    auth: AuthResponse<any>,
    payload: any,
  ): Promise<readonly SyncColumnDefinition[]>;
  abstract fetchData(
    auth: AuthResponse<any>,
    payload: any,
    options: any,
  ): Promise<DataObjectStream>;
  abstract getIncrementalKey(): string;
}

export interface SyncColumnDefinition {
  title: string;
  uidt: UITypes;
  column_name?: string;
  colOptions?: {
    options: { title: string }[];
  };
  pv?: boolean;
}

export type SyncSchema = SyncColumnDefinition[];

export type SyncSchemaWithSystemFields = (SyncColumnDefinition & {
  system: boolean;
  column_name: string;
})[];

type UITypeToTS<U> = U extends UITypes.SingleSelect
  ? string | null
  : U extends UITypes.MultiSelect
    ? string | null
    : U extends UITypes.Checkbox
      ? boolean | null
      : U extends UITypes.Number
        ? number | null
        : U extends UITypes.Currency
          ? number | null
          : U extends UITypes.URL
            ? string | null
            : U extends UITypes.Date
              ? string | null
              : U extends UITypes.DateTime
                ? string | null
                : U extends UITypes.SingleLineText
                  ? string | null
                  : U extends UITypes.Email
                    ? string | null
                    : U extends UITypes.PhoneNumber
                      ? string | null
                      : U extends UITypes.LongText
                        ? string | null
                        : any;

export type RecordTypeFromSchema<
  T extends readonly { title: string; uidt: UITypes }[],
> = {
  [K in T[number] as K['title']]: UITypeToTS<K['uidt']>;
  // add system fields
} & {
  RemoteCreatedAt: string | null;
  RemoteUpdatedAt: string | null;
  RemoteRaw: string | null;
};

export type AnyRecordType = Record<string, string | number | boolean | null>;

export const syncSystemFields: SyncSchemaWithSystemFields = [
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

export const ticketingSchema = [
  {
    title: 'Name',
    uidt: UITypes.SingleLineText,
    pv: true,
  },
  {
    title: 'Assignees',
    uidt: UITypes.SingleLineText,
  },
  {
    title: 'Creator',
    uidt: UITypes.SingleLineText,
  },
  {
    title: 'Due Date',
    uidt: UITypes.SingleLineText,
  },
  {
    title: 'Status',
    uidt: UITypes.SingleLineText,
  },
  {
    title: 'Description',
    uidt: UITypes.LongText,
  },
  {
    title: 'Collections',
    uidt: UITypes.SingleLineText,
  },
  {
    title: 'Ticket Type',
    uidt: UITypes.SingleLineText,
  },
  {
    title: 'Account',
    uidt: UITypes.SingleLineText,
  },
  {
    title: 'Contact',
    uidt: UITypes.SingleLineText,
  },
  {
    title: 'Parent Ticket',
    uidt: UITypes.SingleLineText,
  },
  {
    title: 'Attachments',
    uidt: UITypes.SingleLineText,
  },
  {
    title: 'Tags',
    uidt: UITypes.SingleLineText,
  },
  {
    title: 'Completed At',
    uidt: UITypes.DateTime,
  },
  {
    title: 'Ticket URL',
    uidt: UITypes.URL,
  },
  {
    title: 'Priority',
    uidt: UITypes.SingleLineText,
  },
] as const;

export interface SystemFieldsPayload {
  primaryKey: string[];
  createdAt?: string;
  updatedAt?: string;
}
