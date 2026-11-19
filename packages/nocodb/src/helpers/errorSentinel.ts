import { NC_ERROR_SENTINEL } from 'nocodb-sdk';

/**
 * Replace the backend's error sentinel in record payloads with null and name
 * the affected fields under `field_errors` on that record. A broken lookup or
 * rollup then reads as an empty value with a marker, not as the sentinel text.
 */
export function markErrorSentinels<T>(payload: T): T {
  return clean(payload) as T;
}

function clean(value: unknown): unknown {
  // a lookup of an errored field carries the sentinel inside its array
  if (Array.isArray(value)) {
    return value.map((v) => (v === NC_ERROR_SENTINEL ? null : clean(v)));
  }
  if (!value || typeof value !== 'object') return value;

  const obj = value as Record<string, unknown>;
  const fields = obj.fields;

  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    const source = fields as Record<string, unknown>;
    const broken: string[] = [];
    const cleaned: Record<string, unknown> = {};

    for (const [key, v] of Object.entries(source)) {
      if (v === NC_ERROR_SENTINEL) {
        broken.push(key);
        cleaned[key] = null;
      } else {
        cleaned[key] = clean(v);
      }
    }

    return {
      ...obj,
      fields: cleaned,
      ...(broken.length ? { field_errors: broken } : {}),
    };
  }

  // a Date (mssql/oracle driver value) has no own keys and would become {}
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;

  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, clean(v)]));
}

/**
 * v2 records are flat rows, so an errored lookup or rollup just reads as null
 * there. Recurses into arrays and plain objects (nested link records) only.
 */
export function nullErrorSentinels<T>(value: T): T {
  return nullDeep(value) as T;
}

function nullDeep(value: unknown): unknown {
  if (value === NC_ERROR_SENTINEL) return null;
  if (Array.isArray(value)) return value.map(nullDeep);
  if (!value || typeof value !== 'object') return value;

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, nullDeep(v)]),
  );
}
