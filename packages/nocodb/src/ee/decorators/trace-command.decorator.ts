import { Logger } from '@nestjs/common';
import type { OperationContract, ResolvedCtx } from '~/command-registry/_types';
import { recordCommand } from '~/ee/command-registry/_record';

const logger = new Logger('TraceCommand');

/**
 * @TraceCommand(contract) decorator for service methods that mutate schema.
 *
 * When a schema mutation runs on a sandbox base, records the command to the
 * sandbox changelog for replay during merge.
 *
 * Sets `req.__commandTraced = true` so nested @TraceCommand calls (inner
 * service methods called by the decorated method) skip recording — only the
 * outermost decorated call in the call stack records.
 *
 * Strict mode: throws on schema-validation failure at write time. The
 * registered handler is responsible for replaying the command at merge time.
 */
export function TraceCommand<C extends OperationContract>(contract: C) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
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
          logger.warn(
            `Trace resolveCtx ${contract.name}@${contract.version}: ${e.message}`,
          );
        }
      }

      const result = await originalMethod.apply(this, args);

      if (contract.skipIf) {
        try {
          if (await contract.skipIf(ctx, param, result, resolvedCtx)) {
            return result;
          }
        } catch (e: any) {
          logger.warn(
            `Trace skipIf ${contract.name}@${contract.version}: ${e.message}`,
          );
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

// Re-export types so existing imports resolve.
export type {
  OperationContract,
  ResolvedCtx,
  TraceCommandDep,
} from '~/command-registry/_types';
