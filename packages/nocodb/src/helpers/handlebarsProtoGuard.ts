// Handlebars' own `protoAccessControl` denies prototype-chain access that the
// template AST performs, which closes classic SSTI. But handlebars-helpers-v2
// resolves a caller-supplied dotted path through `get-value` / `array-sort` /
// `has-value`, none of which filter prototype keys — so `constructor.constructor`
// hands a template the Function constructor. Combined with helpers that invoke a
// value they are given (`map`, `some`, `itemAt`, a `sortBy` comparator, `#with`),
// that is arbitrary code execution.
//
// Webhook data is JSON, so no helper ever legitimately receives or returns a
// function: every helper refuses those, and the path-taking ones also refuse
// prototype segments.
const PROTO_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

function hasUnsafeSegment(path: string): boolean {
  return path
    .split('.')
    .some((segment) => PROTO_PATH_SEGMENTS.has(segment.trim()));
}

export function isUnsafeHelperPath(
  value: unknown,
  seen: Set<unknown> = new Set(),
): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    if (seen.has(value)) return false;
    seen.add(value);
    // get-value joins an array path with '.'; array-sort flattens one level and
    // uses each element as a path of its own.
    return (
      hasUnsafeSegment(value.join('.')) ||
      value.some((item) => isUnsafeHelperPath(item, seen))
    );
  }
  try {
    return hasUnsafeSegment(String(value));
  } catch {
    return true;
  }
}

function containsFunction(
  value: unknown,
  seen: Set<unknown> = new Set(),
): boolean {
  if (typeof value === 'function') return true;
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  if (Array.isArray(value)) {
    seen.add(value);
    return value.some((item) => containsFunction(item, seen));
  }
  // Plain objects only; class instances (Date, SafeString) are left alone.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  seen.add(value);
  return Object.values(value).some((item) => containsFunction(item, seen));
}

// Positional arguments (options object excluded) that each helper resolves as a path.
const PATH_ARGS: Record<string, (args: unknown[], hash: any) => unknown[]> = {
  pluck: (args) => args.slice(1, 2),
  withSort: (args) => args.slice(1, 2),
  sortBy: (args) => args.slice(1),
  // `{{has path}}` checks the path on the current context; the 2-arg form is data.
  has: (args) => (args.length === 1 ? args : []),
  filter: (_args, hash) => [hash?.property, hash?.prop],
  // Not in 2.2.0; listed so an upgrade that adds the object group stays covered.
  get: (args) => args.slice(0, 1),
  getObject: (args) => args.slice(0, 1),
};

/** Call AFTER registering every helper on the instance. */
export function hardenHandlebarsPathHelpers(handlebars: {
  helpers: Record<string, any>;
  registerHelper: (name: string, fn: any) => void;
}) {
  for (const name of Object.keys(handlebars.helpers)) {
    const original = handlebars.helpers[name];
    if (typeof original !== 'function') continue;
    const pathArgs = PATH_ARGS[name];

    handlebars.registerHelper(name, function (this: any, ...args: any[]) {
      // The last argument is always Handlebars' options object.
      const positional = args.slice(0, -1);
      const hash = args[args.length - 1]?.hash ?? {};

      if (
        positional.some((arg) => containsFunction(arg)) ||
        Object.values(hash).some((arg) => containsFunction(arg))
      ) {
        return '';
      }
      if (pathArgs?.(positional, hash).some((arg) => isUnsafeHelperPath(arg))) {
        return '';
      }

      const result = original.apply(this, args);
      return containsFunction(result) ? '' : result;
    });
  }
}
