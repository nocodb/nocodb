import type { CommandHandler, OperationContract } from './_types';

/**
 * CE no-op OperationRegistry stub. EE overrides this with the real
 * Map-backed singleton. CE never registers anything; resolve() always
 * returns undefined.
 */
class _OperationRegistryNoop {
  register<C extends OperationContract>(_c: C, _h: CommandHandler<C>) {}
  freeze() {}
  resolve(_name: string, _version: number) {
    return undefined;
  }
  describe(): Array<{
    name: string;
    version: number;
    entity: string;
    idField?: string;
    schemaHash: string;
    extraSchemaHash?: string;
  }> {
    return [];
  }
  contract(_name: string, _version: number) {
    return undefined;
  }
}

export const OperationRegistry = new _OperationRegistryNoop();
