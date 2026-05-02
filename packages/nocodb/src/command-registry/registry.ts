import type { CommandHandler, OperationContract } from './types';

// CE no-op stub. EE overrides with the real Map-backed singleton.
// `OperationContract<any>` (not the default `OperationContract<ZodTypeAny>`)
// avoids a variance error: zod schema fields propagate `S` into function-type
// positions (`EntityRefFn<S>`), and a specific `OperationContract<typeof
// mySchema>` would otherwise be rejected as not assignable to the parameter.
class _OperationRegistryNoop {
  register<C extends OperationContract<any>>(_c: C, _h: CommandHandler<C>) {}
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
