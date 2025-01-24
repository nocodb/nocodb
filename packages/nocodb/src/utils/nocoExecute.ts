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
  // Handle array of resolvers by executing nocoExecute on each and returning a Promise.all
  if (Array.isArray(resolverObj)) {
    return Promise.all(
      resolverObj.map((resolver, i) =>
        nocoExecuteSingle(
          requestObj,
          resolver,
          (dataTree[i] = dataTree[i] || {}),
          rootArgs,
        ),
      ),
    );
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
  const extractNested = (
    path: string[],
    dataTreeObj: any,
    resolver: ResolverObj = {},
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

  const out: any = {}; // Holds the final output
  const resolPromises = []; // Holds all the promises for asynchronous resolution
  for (const key of extractKeys) {
    // Extract the field for each key
    extractField(key, rootArgs?.nested?.[key]);

    // Handle nested request objects by recursively calling nocoExecute
    if (requestObj[key] && typeof requestObj[key] === 'object') {
      res[key] = res[key].then((res1) => {
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
    // Push resolved promises to resolPromises array
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
