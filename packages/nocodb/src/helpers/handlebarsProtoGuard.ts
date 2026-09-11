// Handlebars' own `protoAccessControl` denies prototype-chain access that the
// template AST performs, which closes classic SSTI. But handlebars-helpers-v2
// resolves a caller-supplied dotted path through `get-value` / `array-sort`,
// neither of which filters prototype keys — so `constructor.constructor` hands a
// template the Function constructor. Combined with `map` (invokes a
// caller-built function) and `#with` (invokes a function context), that is
// arbitrary code execution.
//
// These are the only four helpers in the collection that accept such a path, so
// wrap them instead of dropping helpers that user templates depend on.
const PROTO_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

export function isUnsafeHelperPath(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.split('.').some((segment) => PROTO_PATH_SEGMENTS.has(segment.trim()))
  );
}

/** Call AFTER registering handlebars-helpers-v2 on the instance. */
export function hardenHandlebarsPathHelpers(handlebars: {
  helpers: Record<string, any>;
  registerHelper: (name: string, fn: any) => void;
}) {
  // `pluck`/`sortBy`/`withSort` take the path positionally — the last argument
  // is always Handlebars' options object, the first is the array.
  for (const name of ['pluck', 'sortBy', 'withSort']) {
    const original = handlebars.helpers[name];
    if (typeof original !== 'function') continue;

    handlebars.registerHelper(name, function (this: any, ...args: any[]) {
      if (args.slice(1, -1).some(isUnsafeHelperPath)) return '';
      return original.apply(this, args);
    });
  }

  // `filter` takes it via the block hash instead; its positional 2nd argument is
  // a data value and must not be rejected.
  const originalFilter = handlebars.helpers.filter;
  if (typeof originalFilter === 'function') {
    handlebars.registerHelper('filter', function (this: any, ...args: any[]) {
      const hash = args[args.length - 1]?.hash;
      if (isUnsafeHelperPath(hash?.property ?? hash?.prop)) return '';
      return originalFilter.apply(this, args);
    });
  }
}
