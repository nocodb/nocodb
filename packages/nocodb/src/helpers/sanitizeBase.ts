// Fields on a Base row that must never reach an API client: `password` is a
// stored credential, source `config` holds connection credentials.
//
// Returns a shallow copy — callers MUST use the return value, the input is not
// mutated.
export function sanitizeBase<T extends Record<string, any>>(base: T): T {
  if (!base) return base;
  const sanitized: any = { ...base };

  delete sanitized.password;

  // copy each source so the caller's nested objects aren't mutated

  if (Array.isArray(sanitized.sources)) {
    sanitized.sources = sanitized.sources.map((s: any) => {
      if (!s || typeof s !== 'object') return s;
      const copy = { ...s };
      delete copy.config;
      return copy;
    });
  }

  return sanitized;
}
