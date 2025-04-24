import { Readable } from 'stream';

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

export function extractPrimaryKey(
  data: Record<string, unknown>,
  keys: string[],
  customExtractor?: (data: Record<string, unknown>, key: string) => string,
) {
  const vals = [];

  // sort keys
  keys.sort((a, b) => a.localeCompare(b));

  // generate combined primary key
  for (const key of keys) {
    const value = customExtractor ? customExtractor(data, key) : data[key];

    if (value !== undefined && value !== null) {
      vals.push(value);
    }
  }

  if (vals.length === 0) {
    return null;
  }

  // return combined primary key
  return vals.join('__nc__');
}
