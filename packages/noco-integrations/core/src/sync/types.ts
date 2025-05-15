import { Readable } from 'stream';
import { UITypes, TARGET_TABLES } from 'nocodb-sdk';
import { IntegrationWrapper } from '../integration';
import type { AuthResponse } from '../auth';

export interface DataObject<
  T = Record<string, string | number | boolean | null>,
> {
  targetTable: string;
  recordId: string;
  data: T;
  links?: Record<string, SyncLinkValue>;
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

export abstract class SyncIntegration<T = any> extends IntegrationWrapper<T> {
  getTitle() {
    return 'Sync Integration';
  }
  abstract getDestinationSchema(auth: AuthResponse<any>): Promise<SyncSchema>;
  abstract fetchData(
    auth: AuthResponse<any>,
    args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: Record<TARGET_TABLES, string | number>;
    },
  ): Promise<DataObjectStream<SyncRecord>>;
  abstract formatData(
    targetTable: TARGET_TABLES,
    data: any,
  ): {
    data: SyncRecord;
    links?: Record<string, SyncLinkValue>;
  };
  abstract getIncrementalKey(targetTable: TARGET_TABLES): string;
}

export type AnyRecordType = Record<string, string | number | boolean | null>;
export interface CustomSystemFieldsPayload {
  primaryKey: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SyncColumnDefinition {
  title: string;
  uidt: UITypes;
  column_name?: string;
  colOptions?: {
    options: { title: string }[];
  };
  pv?: boolean;
  meta?: {
    richMode?: boolean;
  };
}

export interface SyncRelation {
  columnTitle: string;
  relatedTable: TARGET_TABLES;
  relatedTableColumnTitle: string;
}

export interface SyncTable {
  title: string;
  columns: SyncColumnDefinition[];
  relations: SyncRelation[];
}

export type SyncSchema = Record<TARGET_TABLES, SyncTable>;

export type SyncValue<T> = T | null;

export type SyncLinkValue = string[] | null;

export interface SyncRecord {
  RemoteCreatedAt?: SyncValue<string>;
  RemoteUpdatedAt?: SyncValue<string>;
  RemoteDeletedAt?: SyncValue<string>;
  RemoteDeleted?: SyncValue<boolean>;
  RemoteRaw: SyncValue<string>;
  RemoteSyncedAt?: SyncValue<string>;
}
