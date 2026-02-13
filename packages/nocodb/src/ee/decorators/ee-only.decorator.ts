import NocoLicense from '~/NocoLicense';

/**
 * @EEOnly() decorator for EE service methods that override CE methods.
 *
 * When a valid license is present (isEE = true), the decorated EE method
 * runs normally. When no license is present (isEE = false), the decorator
 * automatically calls the CE parent class's version of the method with
 * the same arguments — effectively skipping the EE logic.
 *
 * This avoids manual `if (!isEE) return super.method()` checks in every
 * EE service override.
 *
 * @example
 * ```ts
 * // src/ee/services/sorts.service.ts
 * @Injectable()
 * export class SortsService extends SortsServiceCE {
 *   @EEOnly()
 *   async sortCreate(context, param, ncMeta?) {
 *     // EE-specific validation (plan limits, etc.)
 *     return super.sortCreate(context, param, ncMeta);
 *   }
 * }
 * ```
 *
 * When unlicensed, `sortCreate` will call `SortsServiceCE.prototype.sortCreate`
 * directly, bypassing the EE validation.
 */
export function EEOnly() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    // Capture the parent class prototype at decoration time
    const parentProto = Object.getPrototypeOf(target);

    descriptor.value = function (...args: any[]) {
      if (!NocoLicense.isEE) {
        // Fall back to CE parent implementation
        if (parentProto && typeof parentProto[propertyKey] === 'function') {
          return parentProto[propertyKey].apply(this, args);
        }
        // No CE parent method — return undefined (method is EE-only)
        return undefined;
      }
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
