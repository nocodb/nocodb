import { AsyncLocalStorage } from 'node:async_hooks';
import { Logger } from '@nestjs/common';
import type { OperationName } from '~/command-registry/op-names';
import type { ResolvedCtx } from '~/command-registry/types';
import { OperationRegistry } from '~/command-registry/registry';
import { recordCommand } from '~/command-registry/record';

const logger = new Logger('TraceCommand');

// Per-async-tree flag marking that we're already inside a recording traced
// call. Propagates through `await`/`Promise.all` (so nested decorated calls
// see it) but is naturally bounded by `scope.run(...)` — no manual reset, no
// shared mutation on `req`, and works for callers without a `req` (jobs,
// internal calls). Mirrors the pattern in `src/cache/cacheBypassScope.ts`.
const traceScope = new AsyncLocalStorage<true>();

/**
 * `@TraceCommand(OperationName.x)` decorator for service methods that mutate
 * schema. The contract is resolved at invocation time via name+version, so
 * this decorator's call site can sit on a CE service method (CE has a no-op
 * stub at `src/decorators/trace-command.decorator.ts`) without the file
 * importing any EE-only contract definition.
 *
 * Re-entrancy: only the outermost decorated call in an async tree records.
 * Truly nested calls (e.g. `tableDelete` → `columnDelete` per column) see an
 * active `traceScope` and skip recording. Sequential sibling calls — even
 * when they share the same `req` (e.g. `importService.importModels` calling
 * `tableCreate` repeatedly inside a job processor) — each open their own
 * scope and each record.
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

      // Nested decorated call — run the body but skip recording.
      if (traceScope.getStore()) return originalMethod.apply(this, args);

      const ctx = args[0];
      const param = args[1];

      return traceScope.run(true, async () => {
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

        // Swallow recording failures — the user-facing operation already
        // succeeded; a changelog write error must not propagate or roll back.
        try {
          await recordCommand(ctx, contract, param, result, resolvedCtx);
        } catch (e: any) {
          logger.error(
            `recordCommand ${name}@${version} failed: ${e?.message}`,
            e?.stack,
          );
        }

        return result;
      });
    };

    return descriptor;
  };
}
