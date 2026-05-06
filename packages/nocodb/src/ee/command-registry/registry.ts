import * as crypto from 'crypto';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';

import type { CommandHandler, OperationContract } from './types';

interface RegistryEntry {
  contract: OperationContract;
  handler: CommandHandler;
}

export interface RegistrySnapshot {
  name: string;
  version: number;
  entity: string;
  id_field?: string;
  schemaHash: string;
  capture_schema_hash?: string;
}

class _OperationRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private frozen = false;

  register<C extends OperationContract<any>>(
    contract: C,
    handler: CommandHandler<C>,
  ): void {
    const v = versionOf(contract);
    if (this.frozen) {
      throw new Error(
        `OperationRegistry frozen; cannot register ${contract.name}@${v}`,
      );
    }
    const k = key(contract.name, v);
    if (this.entries.has(k)) {
      throw new Error(`Duplicate handler registered for ${k}`);
    }
    this.entries.set(k, { contract, handler: handler as CommandHandler });
  }

  freeze(): void {
    this.frozen = true;
  }

  resolve(name: string, version: number = 1): RegistryEntry | undefined {
    return this.entries.get(key(name, version));
  }

  contract(name: string, version: number = 1): OperationContract | undefined {
    return this.resolve(name, version)?.contract;
  }

  describe(): RegistrySnapshot[] {
    return [...this.entries.values()]
      .map((e) => ({
        name: e.contract.name,
        version: versionOf(e.contract),
        entity: String(e.contract.entity),
        id_field: e.contract.sandbox?.id_field,
        schemaHash: hashSchema(e.contract.schema),
        capture_schema_hash: e.contract.sandbox?.capture_schema
          ? hashSchema(e.contract.sandbox.capture_schema)
          : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.version - b.version);
  }
}

function versionOf(contract: OperationContract<any>): number {
  return contract.version ?? 1;
}

function key(name: string, version: number) {
  return `${name}@${version}`;
}

function hashSchema(schema: ZodTypeAny): string {
  const json = zodToJsonSchema(schema, { $refStrategy: 'none' });
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(json))
    .digest('hex')
    .slice(0, 12);
}

export const OperationRegistry = new _OperationRegistry();
