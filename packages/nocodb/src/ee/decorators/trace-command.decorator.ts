import { Logger } from '@nestjs/common';
import { OperationRegistry } from '~/command-registry/registry';
import { recordCommand } from '~/command-registry/record';
import type { OperationName } from '~/command-registry/op-names';
import type { ResolvedCtx } from '~/command-registry/types';

const logger = new Logger('TraceCommand');

/**
 * `@TraceCommand(OperationName.x)` decorator for service methods that mutate
 * schema. The contract is resolved at invocation time via name+version, so
 * this decorator's call site can sit on a CE service method (CE has a no-op
 * stub at `src/decorators/trace-command.decorator.ts`) without the file
 * importing any EE-only contract definition.
 *
 * Re-entrancy: sets `req.__commandTraced = true` so nested decorated calls
 * skip recording — only the outermost call in the stack records.
 *
 * Strict: throws on schema-validation failure at write time.
 */
export function TraceCommand(name: OperationName, version: number = 1) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const contract = OperationRegistry.contract(name, version);
      // Contract not yet registered — passthrough (e.g. during early
      // module init before `OperationRegistryBootstrap.onApplicationBootstrap`).
      if (!contract) return originalMethod.apply(this, args);

      const ctx = args[0];
      const param = args[1];

      // Re-entrancy guard
      if (param?.req?.__commandTraced) {
        return originalMethod.apply(this, args);
      }
      if (param?.req) {
        (param.req as any).__commandTraced = true;
      }

      let resolvedCtx: ResolvedCtx | undefined;
      if (contract.resolveCtx) {
        try {
          resolvedCtx = await contract.resolveCtx(ctx, param);
        } catch (e: any) {
          logger.warn(`Trace resolveCtx ${name}@${version}: ${e.message}`);
        }
      }

      const result = await originalMethod.apply(this, args);

      if (contract.skipIf) {
        try {
          if (await contract.skipIf(ctx, param, result, resolvedCtx)) {
            return result;
          }
        } catch (e: any) {
          logger.warn(`Trace skipIf ${name}@${version}: ${e.message}`);
        }
      }

      // Awaited — strict ordering of changelog inserts.
      // Throws on schema-validation failure (strict mode).
      await recordCommand(ctx, contract, param, result, resolvedCtx);

      return result;
    };

    return descriptor;
  };
}
