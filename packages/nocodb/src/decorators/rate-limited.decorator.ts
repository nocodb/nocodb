import type { RateLimitConfig } from '~/utils/rate-limit/abstract-rate-limiter';
import { withRateLimit } from '~/utils/rate-limit';

export type NcRateLimitedDecoratorConfig = RateLimitConfig & {
  key: (param: { args: any[]; thisArgs: any }) => string;
  skipIf?: (param: { args: any[]; thisArgs: any }) => Promise<boolean>;
};

/**
 * NcRateLimited decorator
 */
export function NcRateLimited(
  options: NcRateLimitedDecoratorConfig,
): MethodDecorator {
  return (
    _target: any,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    let shouldSkip = false;
    descriptor.value = async function (...args: any[]) {
      const rateLimitKey = options.key({
        args,
        thisArgs: this,
      });
      if (options.skipIf !== undefined) {
        shouldSkip = await options.skipIf({
          args,
          thisArgs: this,
        });
      }

      // If skipIf condition is true, execute method without caching
      if (shouldSkip) {
        return originalMethod.apply(this, args);
      }

      await withRateLimit(options).validate(rateLimitKey);
      return originalMethod.apply(this, args);
    };
    // check if skipIf
    return descriptor;
  };
}
