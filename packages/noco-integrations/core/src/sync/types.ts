import { Readable } from 'stream';
import { UITypes } from 'nocodb-sdk';
import { IntegrationWrapper } from '../integration';
import type { AuthResponse } from '../auth';
import { TARGET_TABLES } from './common';
export interface DataObject<
  T = Record<string, string | number | boolean | null>,
> {
  targetTable: string;
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

export abstract class SyncIntegration<T = any> extends IntegrationWrapper<T> {
  abstract getDestinationSchema(
    auth: AuthResponse<any>,
    payload: T,
  ): Promise<SyncSchema>;
  abstract fetchData(
    auth: AuthResponse<any>,
    args: {
      payload: any;
      targetTables?: string[];
      lastRecord?: AnyRecordType;
    },
  ): Promise<DataObjectStream>;
  abstract getIncrementalKey(): string;
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
}

export interface SyncRelation {
  type: 'hm' | 'oo' | 'mm';
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
