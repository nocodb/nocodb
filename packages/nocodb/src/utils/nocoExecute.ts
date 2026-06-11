/** AST node: keys map to nested AST nodes (object) or leaf markers (1 / true) */
interface FieldRequest {
  [key: string]: FieldRequest | 1 | true;
}

/** Recursively flatten nested arrays into a single-level array */
const deepFlatten = (value) => {
  return Array.isArray(value)
    ? value.flatMap((item) => deepFlatten(item))
    : value;
};

export type ResolverObj =
  | {
      __proto__?: { __columnAliases?: { [key: string]: any } };
    } & {
      [key: string]: null | ((args: any) => any) | any;
    };

/**
 * Recursive resolver that walks a request AST against a proto-decorated
 * data record and resolves all requested fields/relations.
 *
 * Key design: all field resolutions fire synchronously in the same microtick
 * before any `await`. This lets DataLoader collect every `.load()` call into a
 * single batch per relation, reducing N×R queries to R queries.
 * Actual DB execution is serialized via PQueue (see BaseModelSqlv2._queryQueue).
 *
 * @param requestAST   AST describing which fields/nested relations to resolve
 * @param resolverObj  proto-decorated data record (or array of records)
 * @param cache        memoization tree — caches resolved values across lookups
 * @param rootArgs     pagination/filter args passed down for nested resolution
 */
const nocoExecute = async (
  requestAST: FieldRequest,
  resolverObj?: ResolverObj | ResolverObj[],
  cache = {},
  rootArgs = null,
): Promise<any> => {
  // Array of records: resolve all in parallel so every record's DataLoader
  // .load() calls land in the same microtick → optimal batching
  if (Array.isArray(resolverObj)) {
    return Promise.all(
      resolverObj.map((record, i) =>
        nocoExecute(requestAST, record, (cache[i] = cache[i] || {}), rootArgs),
      ),
    );
  }

  // After the array early-return above, resolverObj is always a single record
  const record = resolverObj as ResolverObj;
  const columnAliases = record?.__proto__?.__columnAliases;

  /**
   * Walk a path (e.g. ['Country', 'CountryName']) through the cache,
   * resolving each segment via proto functions or column aliases.
   * Returns a .then() chain (not async) so the promise is created synchronously —
   * this is critical for DataLoader batching.
   */
  const resolvePath = (
    path: string[],
    cacheNode: any,
    sourceObj: any = {},
    args: any = {},
  ): any => {
    if (!path.length) {
      return Promise.resolve(cacheNode);
    }

    const key = path[0];
    const remainingPath = path.slice(1);

    // Resolve the current key if not already cached
    if (cacheNode[key] === undefined || cacheNode[key] === null) {
      if (typeof sourceObj[key] === 'function') {
        cacheNode[key] = sourceObj[key](args);
      } else if (typeof sourceObj[key] === 'object') {
        cacheNode[key] = Promise.resolve(sourceObj[key]);
      } else if (cacheNode?.__proto__?.__columnAliases?.[key]) {
        // Redirect through column alias (e.g. Lookup → relation path)
        cacheNode[key] = resolvePath(
          cacheNode.__proto__.__columnAliases[key].path,
          cacheNode,
          {},
          args,
        );
      } else if (typeof cacheNode === 'object') {
        cacheNode[key] = Promise.resolve(sourceObj[key]);
      }
    } else if (typeof cacheNode[key] === 'function') {
      // Move function result to proto to avoid re-invocation
      cacheNode.__proto__ = {
        ...cacheNode.__proto__,
        [key]: cacheNode[key](args),
      };
    }

    // Await the current segment, then recurse into remaining path
    return Promise.resolve(cacheNode[key]).then((resolved) => {
      if (Array.isArray(resolved)) {
        return Promise.all(
          resolved.map((item) => resolvePath(remainingPath, item, {}, args)),
        );
      }
      return resolved != null
        ? resolvePath(remainingPath, resolved, {}, args)
        : Promise.resolve(null);
    });
  };

  /**
   * Fire a single field's resolver (or column-alias lookup) and store the
   * resulting promise in fieldPromises[key]. Must be synchronous (no await)
   * so that all DataLoader .load() calls happen in the same microtick.
   */
  const fieldPromises: Record<string, any> = {};

  function resolveField(key: string, args: any) {
    if (!columnAliases?.[key]) {
      // Direct field: invoke proto function or wrap static value
      if (record) {
        if (typeof record[key] === 'function') {
          fieldPromises[key] = record[key](args);
        } else if (typeof record[key] === 'object') {
          fieldPromises[key] = Promise.resolve(record[key]);
        } else {
          fieldPromises[key] = Promise.resolve(record[key]);
        }
      }
      cache[key] = fieldPromises[key];
    } else {
      // Column alias (e.g. Lookup): walk the alias path through cache so
      // previously resolved relations (e.g. BT 'Country') are reused
      fieldPromises[key] = resolvePath(
        columnAliases[key].path,
        cache,
        record,
        args?.nested?.[key],
      ).then((resolved) =>
        Array.isArray(resolved) ? deepFlatten(resolved) : resolved,
      );
    }
  }

  // Build nested args for recursive nocoExecute calls
  function buildNestedArgs(key: string) {
    return Object.assign(
      {
        nestedPage: rootArgs?.nestedPage,
        limit: rootArgs?.nestedLimit,
      },
      rootArgs?.nested?.[key] || {},
    );
  }

  // Determine which keys to resolve
  const requestedKeys =
    requestAST && typeof requestAST === 'object'
      ? Object.keys(requestAST).filter((k) => requestAST[k])
      : Object.keys(record);

  const output: any = {};
  const pendingPromises = [];

  // Phase 1: Fire all resolveField() calls synchronously. This is where
  // DataLoader .load() calls are enqueued — doing them all before any await
  // ensures they land in a single batch per relation type.
  for (const key of requestedKeys) {
    resolveField(key, rootArgs?.nested?.[key]);

    // Phase 2 (chained): For nested AST nodes, chain recursive nocoExecute
    // onto the resolved value. Promise.resolve() safely wraps non-Promise values.
    if (
      requestAST[key] &&
      typeof requestAST[key] === 'object' &&
      fieldPromises[key]
    ) {
      fieldPromises[key] = Promise.resolve(fieldPromises[key]).then(
        (resolved) => {
          if (Array.isArray(resolved)) {
            return (cache[key] = Promise.all(
              resolved.map((item, i) =>
                nocoExecute(
                  requestAST[key] as FieldRequest,
                  item,
                  cache?.[key]?.[i],
                  buildNestedArgs(key),
                ),
              ),
            ));
          } else if (resolved) {
            return (cache[key] = nocoExecute(
              requestAST[key] as FieldRequest,
              resolved,
              cache[key],
              buildNestedArgs(key),
            ));
          }
          return resolved;
        },
      );
    }

    // Collect all promises — awaited together at the end via Promise.all
    if (fieldPromises[key]) {
      pendingPromises.push(
        (async () => {
          output[key] = await fieldPromises[key];
        })(),
      );
    }
  }

  await Promise.all(pendingPromises);

  return output;
};

export { nocoExecute };
