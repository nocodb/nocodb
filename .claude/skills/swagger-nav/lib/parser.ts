import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA_DIR = path.resolve(__dirname, '../../../../packages/nocodb/src/schema');
const EE_SCHEMA_DIR = path.resolve(__dirname, '../../../../packages/nocodb/src/ee/schema');

const FILE_ALIASES: Record<string, string> = {
  v3: path.join(SCHEMA_DIR, 'swagger-v3.json'),
  ce: path.join(SCHEMA_DIR, 'swagger.json'),
  legacy: path.join(SCHEMA_DIR, 'swagger.json'),
  v2: path.join(SCHEMA_DIR, 'swagger-v2.json'),
  ee: path.join(EE_SCHEMA_DIR, 'swagger.json'),
  v3Patch: path.join(SCHEMA_DIR, 'swagger-v3-validation-patch.json'),
};

// Maps aliases to their CE/original counterpart for --include-original
const ORIGINAL_MAP: Record<string, string> = {
  ee: 'ce',
  v3Patch: 'v3',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpenAPISpec {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
    [key: string]: any;
  };
  'x-tagGroups'?: Array<{ name: string; tags: string[] }>;
  servers?: Array<{ url: string }>;
}

export interface PathEntry {
  path: string;
  methods: Array<{
    method: string;
    operationId?: string;
    summary?: string;
    tags?: string[];
  }>;
}

export interface SchemaEntry {
  name: string;
  type?: string;
  propertyCount: number;
}

export interface SearchHit {
  jsonPath: string;
  value: string;
}

export interface RefEntry {
  location: string;
  refValue: string;
}

// ---------------------------------------------------------------------------
// File resolution & loading
// ---------------------------------------------------------------------------

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

export function resolveFile(aliasOrPath: string): string {
  if (FILE_ALIASES[aliasOrPath]) return FILE_ALIASES[aliasOrPath];
  if (path.isAbsolute(aliasOrPath)) return aliasOrPath;
  return path.join(SCHEMA_DIR, aliasOrPath);
}

function loadSingleSpec(filePath: string): OpenAPISpec {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Swagger file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as OpenAPISpec;
}

function mergeSpecs(base: OpenAPISpec, overlay: OpenAPISpec): OpenAPISpec {
  return {
    ...base,
    ...overlay,
    paths: { ...base.paths, ...overlay.paths },
    components: {
      ...base.components,
      ...overlay.components,
      schemas: { ...base.components?.schemas, ...overlay.components?.schemas },
    },
  };
}

export function loadSpec(fileOrAlias: string, includeOriginal = false): OpenAPISpec {
  const spec = loadSingleSpec(resolveFile(fileOrAlias));

  if (includeOriginal) {
    const originalAlias = ORIGINAL_MAP[fileOrAlias];
    if (!originalAlias) {
      throw new Error(`--include-original not supported for "${fileOrAlias}" (no original mapping). Supported: ${Object.keys(ORIGINAL_MAP).join(', ')}`);
    }
    const originalSpec = loadSingleSpec(resolveFile(originalAlias));
    // original is the base, queried spec is the overlay (its entries win on conflict)
    return mergeSpecs(originalSpec, spec);
  }

  return spec;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getSummary(spec: OpenAPISpec) {
  const paths = spec.paths ?? {};
  const schemas = spec.components?.schemas ?? {};

  const methodCounts: Record<string, number> = {};
  let operationCount = 0;
  const tagSet = new Set<string>();

  for (const pathItem of Object.values(paths)) {
    for (const [method, op] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      methodCounts[method] = (methodCounts[method] ?? 0) + 1;
      operationCount++;
      if (op?.tags) {
        for (const tag of op.tags) tagSet.add(tag);
      }
    }
  }

  return {
    openapi: spec.openapi ?? 'unknown',
    title: spec.info?.title ?? 'unknown',
    pathCount: Object.keys(paths).length,
    schemaCount: Object.keys(schemas).length,
    operationCount,
    tags: [...tagSet].sort(),
    tagGroups: spec['x-tagGroups'] ?? [],
    methodCounts,
  };
}

export function listPaths(spec: OpenAPISpec, opts?: { tag?: string; filter?: string }): PathEntry[] {
  const paths = spec.paths ?? {};
  const results: PathEntry[] = [];

  for (const [pathStr, pathItem] of Object.entries(paths)) {
    const methods: PathEntry['methods'] = [];

    for (const [method, op] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      methods.push({
        method,
        operationId: op?.operationId,
        summary: op?.summary,
        tags: op?.tags,
      });
    }

    if (methods.length === 0) continue;

    // Filter by tag
    if (opts?.tag) {
      const tagLower = opts.tag.toLowerCase();
      const hasTag = methods.some((m) => m.tags?.some((t) => t.toLowerCase() === tagLower));
      if (!hasTag) continue;
    }

    // Filter by keyword (in path, operationId, summary)
    if (opts?.filter) {
      const kw = opts.filter.toLowerCase();
      const matchPath = pathStr.toLowerCase().includes(kw);
      const matchOp = methods.some(
        (m) =>
          m.operationId?.toLowerCase().includes(kw) ||
          m.summary?.toLowerCase().includes(kw) ||
          m.tags?.some((t) => t.toLowerCase().includes(kw)),
      );
      if (!matchPath && !matchOp) continue;
    }

    results.push({ path: pathStr, methods });
  }

  return results;
}

export function listSchemas(spec: OpenAPISpec, opts?: { filter?: string }): SchemaEntry[] {
  const schemas = spec.components?.schemas ?? {};
  const results: SchemaEntry[] = [];

  for (const [name, schema] of Object.entries(schemas)) {
    if (opts?.filter && !name.toLowerCase().includes(opts.filter.toLowerCase())) continue;

    results.push({
      name,
      type: schema?.type ?? (schema?.allOf ? 'allOf' : schema?.oneOf ? 'oneOf' : undefined),
      propertyCount: schema?.properties ? Object.keys(schema.properties).length : 0,
    });
  }

  return results;
}

export function getPath(spec: OpenAPISpec, pathStr: string, method?: string): { path: string; definition: any }[] {
  const paths = spec.paths ?? {};

  function buildDef(pathItem: Record<string, any>) {
    if (method) {
      const op = pathItem[method];
      return op ? { [method]: op } : null;
    }
    return pathItem;
  }

  // Exact match
  if (paths[pathStr]) {
    const def = buildDef(paths[pathStr]);
    if (!def) return [];
    return [{ path: pathStr, definition: def }];
  }

  // Fuzzy match: find paths containing the substring
  const kw = pathStr.toLowerCase();
  const matches: { path: string; definition: any }[] = [];

  for (const [p, pathItem] of Object.entries(paths)) {
    if (p.toLowerCase().includes(kw)) {
      const def = buildDef(pathItem);
      if (def) matches.push({ path: p, definition: def });
    }
  }

  return matches;
}

export function getSchema(
  spec: OpenAPISpec,
  name: string,
  resolveRefs = false,
  maxDepth = 1,
): { name: string; schema: any } | null {
  const schemas = spec.components?.schemas ?? {};
  const schema = schemas[name];
  if (!schema) return null;

  if (!resolveRefs) return { name, schema };

  const resolved = resolveRefsRecursive(schema, schemas, new Set(), 0, maxDepth);
  return { name, schema: resolved };
}

function resolveRefsRecursive(
  obj: any,
  schemas: Record<string, any>,
  visited: Set<string>,
  depth: number,
  maxDepth: number,
): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;

  if (typeof obj.$ref === 'string' && obj.$ref.startsWith('#/components/schemas/')) {
    const refName = obj.$ref.replace('#/components/schemas/', '');
    if (visited.has(refName) || depth >= maxDepth) {
      return { $ref: obj.$ref, _circular: visited.has(refName) || undefined };
    }
    const refSchema = schemas[refName];
    if (!refSchema) return obj;
    visited.add(refName);
    const resolved = resolveRefsRecursive(refSchema, schemas, visited, depth + 1, maxDepth);
    visited.delete(refName);
    return { _resolvedFrom: refName, ...resolved };
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveRefsRecursive(item, schemas, visited, depth, maxDepth));
  }

  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = resolveRefsRecursive(val, schemas, visited, depth, maxDepth);
  }
  return result;
}

export function search(spec: OpenAPISpec, query: string, limit = 50): SearchHit[] {
  const hits: SearchHit[] = [];
  const queryLower = query.toLowerCase();

  function walk(obj: any, path: string) {
    if (hits.length >= limit) return;
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'string') {
      if (obj.toLowerCase().includes(queryLower)) {
        hits.push({ jsonPath: path, value: obj });
      }
      return;
    }

    if (typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length && hits.length < limit; i++) {
        walk(obj[i], `${path}[${i}]`);
      }
      return;
    }

    for (const [key, val] of Object.entries(obj)) {
      if (hits.length >= limit) break;
      // Also check if key matches
      if (key.toLowerCase().includes(queryLower)) {
        hits.push({ jsonPath: `${path}.${key}`, value: `[key: ${key}]` });
        if (hits.length >= limit) break;
      }
      walk(val, `${path}.${key}`);
    }
  }

  walk(spec, '$');
  return hits;
}

export function getRefs(spec: OpenAPISpec, schemaName: string): RefEntry[] {
  const refTarget = `#/components/schemas/${schemaName}`;
  const entries: RefEntry[] = [];

  function walk(obj: any, path: string) {
    if (obj === null || obj === undefined || typeof obj !== 'object') return;

    if (typeof obj.$ref === 'string' && obj.$ref === refTarget) {
      entries.push({ location: path, refValue: obj.$ref });
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        walk(obj[i], `${path}[${i}]`);
      }
      return;
    }

    for (const [key, val] of Object.entries(obj)) {
      if (key === '$ref') continue; // already checked
      walk(val, `${path}.${key}`);
    }
  }

  // Walk paths
  if (spec.paths) {
    for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
      walk(pathItem, `paths.${pathStr}`);
    }
  }

  // Walk schemas
  if (spec.components?.schemas) {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      if (name === schemaName) continue; // skip self
      walk(schema, `components.schemas.${name}`);
    }
  }

  return entries;
}

export function validateRefs(spec: OpenAPISpec): { broken: RefEntry[]; count: number } {
  const schemas = spec.components?.schemas ?? {};
  const schemaNames = new Set(Object.keys(schemas));
  const broken: RefEntry[] = [];

  function walk(obj: any, path: string) {
    if (obj === null || obj === undefined || typeof obj !== 'object') return;

    if (typeof obj.$ref === 'string' && obj.$ref.startsWith('#/components/schemas/')) {
      const refName = obj.$ref.replace('#/components/schemas/', '');
      if (!schemaNames.has(refName)) {
        broken.push({ location: path, refValue: obj.$ref });
      }
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        walk(obj[i], `${path}[${i}]`);
      }
      return;
    }

    for (const [key, val] of Object.entries(obj)) {
      walk(val, `${path}.${key}`);
    }
  }

  walk(spec, '$');
  return { broken, count: broken.length };
}
