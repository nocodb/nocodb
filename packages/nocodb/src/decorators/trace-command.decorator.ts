import type { OperationContract } from '~/command-registry/_types';

/**
 * CE no-op @TraceCommand decorator. EE overrides this with the real wrapper
 * (re-entrancy guard + sandbox changelog write). Lets services place the
 * decorator regardless of build target.
 */
export function TraceCommand<C extends OperationContract>(_contract: C) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    return descriptor;
  };
}
