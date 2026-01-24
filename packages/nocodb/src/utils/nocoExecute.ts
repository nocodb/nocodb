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
 * Execute the request object
 * @param requestObj request object
 * @param resolverObj resolver object which may contain resolver functions or data
 * @param dataTree data tree that holds the state of the resolved data
 * @param rootArgs root arguments passed for nested processing
 * @returns Promise<any> returns the resolved data
 **/
const nocoExecute = async (
  requestObj: XcRequest,
  resolverObj?: ResolverObj | ResolverObj[],
  dataTree = {},
  rootArgs = null,
): Promise<any> => {
  // Handle array of resolvers by executing nocoExecute on each sequentially
  if (Array.isArray(resolverObj)) {
    const results = [];
    for (let i = 0; i < resolverObj.length; i++) {
      const resolver = resolverObj[i];
      dataTree[i] = dataTree[i] || {};
      results.push(
        await nocoExecuteSingle(requestObj, resolver, dataTree[i], rootArgs),
      );
    }
    return results;
  } else {
    return nocoExecuteSingle(requestObj, resolverObj, dataTree, rootArgs);
  }
};

const nocoExecuteSingle = async (
  requestObj: XcRequest,
  resolverObj?: ResolverObj,
  dataTree = {},
  rootArgs = null,
): Promise<any> => {
  const res = {};

  /**
   * Recursively extract nested data from the dataTree and resolve it.
   * @param path the path of keys to traverse in the data tree
   * @param dataTreeObj the current data tree object
   * @param resolver the resolver object to call functions or return values
   * @param args arguments passed to resolver functions
   * @returns Promise resolving the nested value
   */
  const extractNested = async (
    path: string[],
    dataTreeObj: any,
    resolver: ResolverObj = {},
    args = {},
  ): Promise<any> => {
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
      const res1 = await (dataTreeObj[path[0]] instanceof Promise
        ? dataTreeObj[path[0]]
        : Promise.resolve(dataTreeObj[path[0]]));

      if (Array.isArray(res1)) {
        const results = [];
        for (const r of res1) {
          results.push(await extractNested(path.slice(1), r, {}, args));
        }
        return results;
      } else {
        return res1 !== null && res1 !== undefined
          ? await extractNested(path.slice(1), res1, {}, args)
          : null;
      }
    } else {
      return dataTreeObj; // If path is exhausted, return data tree object
    }
  };

  /**
   * Extract the value for the given key from the resolver object or data tree.
   * If the key is a function, call it with args, otherwise resolve the value.
   * @param key the key to extract
   * @param args the arguments for nested extractions
   */
  function extractField(key, args) {
    // Check if the key is a column alias or needs to be resolved
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
      // If nested, extract the nested value using extractNested function
      res[key] = (async () => {
        const res1 = await extractNested(
          resolverObj?.__proto__?.__columnAliases?.[key]?.path,
          dataTree,
          resolverObj,
          args?.nested?.[key],
        );
        // Flatten the array if it's nested
        return Array.isArray(res1) ? flattenArray(res1) : res1;
      })();
    }
  }

  // Determine which keys to extract from the request object or resolver object
  const extractKeys =
    requestObj && typeof requestObj === 'object'
      ? Object.keys(requestObj).filter((k) => requestObj[k])
      : Object.keys(resolverObj);

  const out: any = {}; // Holds the final output
  for (const key of extractKeys) {
    // Extract the field for each key
    extractField(key, rootArgs?.nested?.[key]);

    // Handle nested request objects by recursively calling nocoExecute
    if (requestObj[key] && typeof requestObj[key] === 'object') {
      if (res[key]) {
        const res1 = await res[key];
        if (Array.isArray(res1)) {
          // Handle arrays of results by executing nocoExecute on each element sequentially
          dataTree[key] = [];
          for (let i = 0; i < res1.length; i++) {
            const r = res1[i];
            dataTree[key][i] = dataTree[key][i] || {};
            dataTree[key][i] = await nocoExecute(
              requestObj[key] as XcRequest,
              r,
              dataTree[key][i],
              Object.assign(
                {
                  nestedPage: rootArgs?.nestedPage,
                  limit: rootArgs?.nestedLimit,
                },
                rootArgs?.nested?.[key] || {},
              ),
            );
          }
          res[key] = dataTree[key];
        } else if (res1) {
          // Handle single objects
          res[key] = await nocoExecute(
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
          );
          dataTree[key] = res[key];
        } else {
          res[key] = res1;
        }
      }
    }

    if (res[key]) {
      out[key] = await res[key];
    }
  }

  return out; // Return the final resolved output
};

export { nocoExecute };
