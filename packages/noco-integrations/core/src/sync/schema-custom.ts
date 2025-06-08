import { SyncRecord, SyncValue } from './types';

export interface CustomRecord extends SyncRecord {
  [key: string]: SyncValue<string | number | boolean | undefined | null>;
}
