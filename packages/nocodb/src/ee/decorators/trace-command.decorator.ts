import { AsyncLocalStorage } from 'node:async_hooks';
import { Logger } from '@nestjs/common';
import type { OperationName } from '~/command-registry/op-names';
import type {
  CaptureBag,
  CaptureKey,
  ResolvedCtx,
} from '~/command-registry/types';
import { OperationRegistry } from '~/command-registry/registry';
import { recordCommand } from '~/command-registry/record';

const logger = new Logger('TraceCommand');

const traceScope = new AsyncLocalStorage<{
  active: boolean;
  capture: Map<CaptureKey, CaptureBag[CaptureKey]>;
}>();

export function captureForTrace<K extends CaptureKey>(
  key: K,
  value: CaptureBag[K],
): void {
  traceScope.getStore()?.capture.set(key, value);
}

export function getTraceCapture<K extends CaptureKey>(
  key: K,
): CaptureBag[K] | undefined {
  return traceScope.getStore()?.capture.get(key) as CaptureBag[K] | undefined;
}

/**
 * Decorator for state-mutating service methods.
 *
 * Only the outermost decorated call in an async tree records — nested
 * calls auto-skip, sequential siblings each open their own scope.
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
      // Early module init before OperationRegistryBootstrap finishes.
      if (!contract) return originalMethod.apply(this, args);

      if (traceScope.getStore()) return originalMethod.apply(this, args);

      const ctx = args[0];
      const param = args[1];

      return traceScope.run(
        {
          active: true,
          capture: new Map<CaptureKey, CaptureBag[CaptureKey]>(),
        },
        async () => {
          let resolvedCtx: ResolvedCtx | undefined;
          const beforeFn = contract.entry?.before;
          if (beforeFn) {
            try {
              resolvedCtx = await beforeFn(ctx, param);
            } catch (e: any) {
              logger.warn(
                `Trace entry.before ${name}@${version}: ${e.message}`,
              );
            }
          }

          const result = await originalMethod.apply(this, args);

          const skipFn = contract.entry?.skip_if;
          if (skipFn) {
            try {
              if (await skipFn(ctx, param, result, resolvedCtx)) {
                return result;
              }
            } catch (e: any) {
              logger.warn(
                `Trace entry.skip_if ${name}@${version}: ${e.message}`,
              );
            }
          }

          // Recording failures must not propagate — user-facing op already succeeded.
          try {
            await recordCommand(ctx, contract, param, result, resolvedCtx);
          } catch (e: any) {
            logger.error(
              `recordCommand ${name}@${version} failed: ${e?.message}`,
              e?.stack,
            );
          }

          return result;
        },
      );
    };

    return descriptor;
  };
}
