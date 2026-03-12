// Define the interface for the request object with possible nested structure
import { Logger } from '@nestjs/common';

interface XcRequest {
  [key: string]: XcRequest | 1 | true;
}

const logger = new Logger('nocoExecute');

// Helper function to flatten a nested array recursively
const flattenArray = (res) => {
  return Array.isArray(res) ? res.flatMap((r) => flattenArray(r)) : res;
};

export type ResolverObj =
  | {
      __proto__?: { __columnAliases?: { [key: string]: any } };
    } & {
      [key: string]: null | ((args: any) => any) | any;
    };

/**
 * Recursive resolver that walks a request object (requestObj) against a proto-decorated
 * data record (resolverObj) and resolves all requested fields/relations.
 *
 * Key design: all field extractions fire synchronously in the same microtick
 * before any `await`. This lets DataLoader collect every `.load()` call into a
 * single batch per relation, reducing N×R queries to R queries.
 * Actual DB execution is serialized via PQueue (see BaseModelSqlv2._queryQueue).
 *
 * @param requestObj  AST describing which fields/nested relations to resolve
 * @param resolverObj proto-decorated data record (or array of records)
 * @param dataTree    memoization tree — caches resolved values across lookups
 * @param rootArgs    pagination/filter args passed down for nested resolution
 */
const nocoExecute = async (
  requestObj: XcRequest,
  resolverObj?: ResolverObj | ResolverObj[],
  dataTree = {},
  rootArgs = null,
): Promise<any> => {
  // Array of records: resolve all in parallel so every record's DataLoader
  // .load() calls land in the same microtick → optimal batching
  if (Array.isArray(resolverObj)) {
    return Promise.all(
      resolverObj.map((resolver, i) =>
        nocoExecute(
          requestObj,
          resolver,
          (dataTree[i] = dataTree[i] || {}),
          rootArgs,
        ),
      ),
    );
  }

  const res = {};

  /**
   * Walk a dotted path (e.g. ['Country', 'CountryName']) through the dataTree,
   * resolving each segment via the resolver's proto functions or column aliases.
   * Returns a .then() chain (not async) so the promise is created synchronously —
   * this is critical for DataLoader batching.
   */
  const extractNested = (
    path,
    dataTreeObj: any,
    resolver = {},
    args = {},
  ): any => {
    if (path.length) {
      const key = path[0];
      // If key doesn't exist in dataTree, resolve using resolver or create a placeholder
      if (dataTreeObj[key] === undefined || dataTreeObj[key] === null) {
        if (typeof resolver[key] === 'function') {
          dataTreeObj[path[0]] = resolver[key](args); // Call resolver function
        } else if (typeof resolver[key] === 'object') {
          dataTreeObj[path[0]] = Promise.resolve(resolver[key]); // Resolve object directly
        } else if (dataTreeObj?.__proto__?.__columnAliases?.[path[0]]) {
          // Handle column alias lookup
          dataTreeObj[path[0]] = extractNested(
            dataTreeObj?.__proto__?.__columnAliases?.[path[0]]?.path,
            dataTreeObj,
            {},
            args,
          );
        } else {
          if (typeof dataTreeObj === 'object') {
            dataTreeObj[path[0]] = Promise.resolve(resolver[key]);
          }
        }
      } else if (typeof dataTreeObj[key] === 'function') {
        // If the key is a function, invoke it with args
        dataTreeObj.__proto__ = {
          ...dataTreeObj.__proto__,
          [key]: dataTreeObj[key](args),
        };
      }

      // Recursively handle nested arrays or resolve promises
      return (
        dataTreeObj[path[0]] instanceof Promise
          ? dataTreeObj[path[0]]
          : Promise.resolve(dataTreeObj[path[0]])
      ).then((res1) => {
        if (Array.isArray(res1)) {
          return Promise.all(
            res1.map((r) => extractNested(path.slice(1), r, {}, args)),
          );
        } else {
          return res1 !== null && res1 !== undefined
            ? extractNested(path.slice(1), res1, {}, args)
            : Promise.resolve(null);
        }
      });
    } else {
      return Promise.resolve(dataTreeObj); // If path is exhausted, return data tree object
    }
  };

  /**
   * Fire a single field's resolver (or column-alias lookup) and store the
   * resulting promise in res[key]. Must be synchronous (no await) so that
   * all fields' DataLoader .load() calls happen in the same microtick.
   */
  function extractField(key, args) {
    if (!resolverObj?.__proto__?.__columnAliases?.[key]) {
      if (resolverObj) {
        // Resolve if it's a function, object, or value
        if (typeof resolverObj[key] === 'function') {
          res[key] = resolverObj[key](args); // Call function
        } else if (typeof resolverObj[key] === 'object') {
          res[key] = Promise.resolve(resolverObj[key]); // Resolve object
        } else {
          try {
            res[key] = Promise.resolve(resolverObj[key]); // Resolve value
          } catch (e) {
            logger.error(e);
          }
        }
      }

      dataTree[key] = res[key]; // Store result in dataTree
    } else {
      // Column alias (e.g. Lookup): walk the alias path through dataTree so
      // previously resolved relations (e.g. BT 'Country') are reused, not re-fetched
      res[key] = extractNested(
        resolverObj?.__proto__?.__columnAliases?.[key]?.path,
        dataTree,
        resolverObj,
        args?.nested?.[key],
      ).then((res1) => {
        return Promise.resolve(
          // Flatten the array if it's nested
          Array.isArray(res1) ? flattenArray(res1) : res1,
        );
      });
    }
  }

  // Determine which keys to extract from the request object or resolver object
  const extractKeys =
    requestObj && typeof requestObj === 'object'
      ? Object.keys(requestObj).filter((k) => requestObj[k])
      : Object.keys(resolverObj);

  const out: any = {};
  const resolPromises = [];

  // Phase 1: Fire all extractField() calls synchronously. This is where
  // DataLoader .load() calls are enqueued — doing them all before any await
  // ensures they land in a single batch per relation type.
  for (const key of extractKeys) {
    extractField(key, rootArgs?.nested?.[key]);

    // Phase 2 (chained): For nested AST nodes, chain recursive nocoExecute
    // onto the resolved value. Promise.resolve() safely wraps non-Promise values.
    if (requestObj[key] && typeof requestObj[key] === 'object' && res[key]) {
      res[key] = Promise.resolve(res[key]).then((res1) => {
        if (Array.isArray(res1)) {
          // Handle arrays of results by executing nocoExecute on each element
          return (dataTree[key] = Promise.all(
            res1.map((r, i) =>
              nocoExecute(
                requestObj[key] as XcRequest,
                r,
                dataTree?.[key]?.[i],
                Object.assign(
                  {
                    nestedPage: rootArgs?.nestedPage,
                    limit: rootArgs?.nestedLimit,
                  },
                  rootArgs?.nested?.[key] || {},
                ),
              ),
            ),
          ));
        } else if (res1) {
          // Handle single objects
          return (dataTree[key] = nocoExecute(
            requestObj[key] as XcRequest,
            res1,
            dataTree[key],
            Object.assign(
              {
                nestedPage: rootArgs?.nestedPage,
                limit: rootArgs?.nestedLimit,
              },
              rootArgs?.nested?.[key] || {},
            ),
          ));
        }
        return res1; // Return result if no further nesting
      });
    }
    // Collect all promises — awaited together at the end via Promise.all
    if (res[key]) {
      resolPromises.push(
        (async () => {
          out[key] = await res[key];
        })(),
      );
    }
  }

  // Wait for all promises to resolve before returning the final output
  await Promise.all(resolPromises);

  return out; // Return the final resolved output
};

export { nocoExecute };
