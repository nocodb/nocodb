import { CapabilityInputError } from './types';
import type { Capability } from './types';

export function capabilityFail(
  path: string,
  code: string,
  message: string,
): never {
  throw new CapabilityInputError([{ path, code, message }]);
}

/** Values arrive as parsed JSON, so a param named `toString` or `constructor`
 *  would otherwise resolve to an inherited function. */
export function ownValue(
  source: Record<string, unknown>,
  name: string,
): unknown {
  return Object.prototype.hasOwnProperty.call(source, name)
    ? source[name]
    : undefined;
}

/**
 * The authored/input guard, shared by every capability delegate regardless of what
 * client it drives. Undeclared caller keys are refused and every non-optional
 * declared param must be present, so the merged record holds nothing the manifest
 * did not declare.
 *
 * The record has a **null prototype**, and that is load-bearing: providers read it
 * with plain dot access, so on an ordinary object an omitted optional param named
 * `constructor` or `toString` would read back as the inherited function and travel
 * to the provider as a value. It also makes `__proto__` an own property rather than
 * a write through the setter.
 */
export function resolveCapabilityValues(
  capability: Capability,
  authored: Record<string, unknown>,
  input: Record<string, unknown>,
): Record<string, unknown> {
  // Input first: a caller's bad key is more actionable to them than the
  // author's missing binding, and only one error can be reported.
  const declared = capability.input ?? [];
  const names = new Set(declared.map((param) => param.name));

  // The capability owns what it dispatches, so an undeclared key can only be an
  // attempt to reach something it does not offer: refuse it, never drop it.
  for (const key of Object.keys(input)) {
    if (!names.has(key)) {
      capabilityFail(key, 'unknown', `unknown input "${key}"`);
    }
  }

  const fromInput: Record<string, unknown> = Object.create(null);
  for (const param of declared) {
    const value = ownValue(input, param.name);
    if (value === undefined || value === null) {
      if (!param.optional) {
        capabilityFail(
          param.name,
          'required',
          `input "${param.name}" is required`,
        );
      }
      continue;
    }
    fromInput[param.name] = value;
  }

  const out: Record<string, unknown> = Object.create(null);
  for (const param of capability.authored ?? []) {
    const value = ownValue(authored, param.name);
    if (value === undefined || value === null) {
      if (!param.optional) {
        capabilityFail(
          param.name,
          'required',
          `authored "${param.name}" is required`,
        );
      }
      continue;
    }
    out[param.name] = value;
  }

  // Both null-prototype, so this neither invokes a setter nor reintroduces one.
  return Object.assign(out, fromInput);
}

/**
 * Binds a value to exactly one URL path segment. Shared by every provider that
 * addresses a resource by id — an axios path, a Graph `api()` path, a CalDAV
 * collection member — because a separator or a traversal in any of them points
 * the request at a resource the capability never declared.
 */
export function capabilitySegment(name: string, value: unknown): string {
  // Only an authored segment can be missing here — a caller's is caught by the
  // required check before dispatch runs.
  if (value === undefined || value === null) {
    capabilityFail(name, 'required', `path param "${name}" is required`);
  }
  if (typeof value === 'object') {
    capabilityFail(
      name,
      'invalid',
      `invalid path param "${name}": expected a scalar`,
    );
  }
  const raw = String(value);
  // Holds the no-`//` guarantee jointly with any build-time path guard: an empty
  // first segment turns `/{a}/{b}` into a protocol-relative `//b`, which axios
  // resolves as a host.
  if (!raw) {
    capabilityFail(
      name,
      'invalid',
      `invalid path param "${name}": must not be empty`,
    );
  }
  if (raw.includes('/') || raw.includes('..')) {
    capabilityFail(
      name,
      'invalid',
      `invalid path param "${name}": must not contain "/" or ".."`,
    );
  }
  return encodeURIComponent(raw);
}

/** Coerces a declared `integer`/`number` param for a client that takes a real
 *  number. Nothing validates a value against its declared `type`, so a provider
 *  whose SDK signature is typed must do it at the boundary. */
export function capabilityNumber(name: string, value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    capabilityFail(name, 'invalid', `invalid "${name}": expected a number`);
  }
  return num;
}
