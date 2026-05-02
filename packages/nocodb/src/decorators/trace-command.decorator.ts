import type { OperationName } from '~/command-registry/op-names';

// CE no-op stub. EE overrides with the real implementation.
export function TraceCommand(_name: OperationName, _version: number = 1) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    return descriptor;
  };
}
