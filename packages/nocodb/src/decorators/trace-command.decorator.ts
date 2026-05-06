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

/**
 * Deposit a side-effect value into the active trace scope so a contract's
 * `extraCommandMeta` / `buildInverse` can read it without param mutation.
 * No-op in CE; EE override stores into the trace's per-call Map.
 */
export function captureForTrace(_key: string, _value: unknown): void {
  // no-op in CE
}

/**
 * Read a previously-captured trace value. Returns `undefined` outside a
 * trace scope (e.g. during CE builds, untraced calls, or jobs).
 */
export function getTraceCapture<T = unknown>(_key: string): T | undefined {
  return undefined;
}
