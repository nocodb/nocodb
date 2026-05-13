import type { OperationName } from '~/command-registry/op-names';

export type OperationNameResolver = (
  ctx: any,
  param: any,
) => OperationName | undefined | null;

// CE no-op stub. EE overrides with the real implementation.
export function TraceCommand(
  _name: OperationName | OperationNameResolver,
  _version: number = 1,
) {
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

/**
 * Snapshot of the active trace scope's capture bag. No-op in CE — there
 * is no scope, so always returns an empty object.
 */
export function getTraceCaptureSnapshot(): Record<string, unknown> {
  return {};
}

/** True when a trace scope is active. CE has no scope → always false. */
export function isTraceActive(): boolean {
  return false;
}

/**
 * CE stub. EE wraps `fn` in a trace scope so nested `@TraceCommand`
 * decorators take the silent re-entrant skip branch — used by
 * system-driven fan-out paths (snapshot, duplicate-base, import) that
 * call into traced services but are not themselves user-initiated.
 */
export async function runUntraced<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

// CE no-op stub for `@Untraced`. EE overrides with the real impl.
export function Untraced() {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    return descriptor;
  };
}
