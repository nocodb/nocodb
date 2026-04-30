import * as crypto from 'crypto';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';

import type { CommandHandler, OperationContract } from './_types';

interface RegistryEntry {
  contract: OperationContract;
  handler: CommandHandler;
}

export interface RegistrySnapshot {
  name: string;
  version: number;
  entity: string;
  idField?: string;
  schemaHash: string;
  extraSchemaHash?: string;
}

class _OperationRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private frozen = false;

  register<C extends OperationContract>(
    contract: C,
    handler: CommandHandler<C>,
  ): void {
    if (this.frozen) {
      throw new Error(
        `OperationRegistry frozen; cannot register ${contract.name}@${contract.version}`,
      );
    }
    const k = key(contract.name, contract.version);
    if (this.entries.has(k)) {
      throw new Error(`Duplicate handler registered for ${k}`);
    }
    this.entries.set(k, { contract, handler: handler as CommandHandler });
  }

  freeze(): void {
    this.frozen = true;
  }

  resolve(name: string, version: number): RegistryEntry | undefined {
    return this.entries.get(key(name, version));
  }

  contract(name: string, version: number): OperationContract | undefined {
    return this.resolve(name, version)?.contract;
  }

  describe(): RegistrySnapshot[] {
    return [...this.entries.values()]
      .map((e) => ({
        name: e.contract.name,
        version: e.contract.version,
        entity: String(e.contract.entity),
        idField: e.contract.idField,
        schemaHash: hashSchema(e.contract.schema),
        extraSchemaHash: e.contract.extraSchema
          ? hashSchema(e.contract.extraSchema)
          : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.version - b.version);
  }
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
