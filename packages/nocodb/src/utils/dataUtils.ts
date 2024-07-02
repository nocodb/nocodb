export function getAliasGenerator(prefix = '__nc_') {
  let aliasC = 0;

  return () => `${prefix}${aliasC++}`;
}

export const ROOT_ALIAS = '__nc_root';

/**
 * Calculate a 32 bit FNV-1a hash
 * Found here: https://gist.github.com/vaiorabbit/5657561
 * Ref.: http://isthe.com/chongo/tech/comp/fnv/
 * Taken from: https://stackoverflow.com/a/22429679
 *
 *
 * @param {string} str the input value
 * @param {boolean} [asString=false] set to true to return the hash value as
 *     8-digit hex string instead of an integer
 * @param {integer} [seed] optionally pass the hash of the previous chunk
 * @returns {integer | string}
 */
function hash32(str: string, asString?: boolean, seed?: number) {
  /*jshint bitwise:false */
  let i,
    l,
    hval = seed === undefined ? 0x811c9dc5 : seed;

  for (i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval +=
      (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  if (asString) {
    // Convert to 8 digit hex string
    return ('0000000' + (hval >>> 0).toString(16)).substr(-8);
  }
  return hval >>> 0;
}

export function hash64(str: string) {
  const h1 = hash32(str, true) as string; // returns 32 bit (as 8 byte hex string)
  return h1 + hash32(h1 + str); // 64 bit (as 16 byte hex string)
}

export const getParamsHash = (params: Record<string, string | string[]>) => {
  let paramsStr = '';

  for (const [key, val] of Object.entries(params).sort()) {
    if (['limit', 'offset'].includes(key)) continue;
    paramsStr += `${key}:${val}`;
  }

  return hash64(paramsStr);
};

const isMergeableObject = (val: any) => {
  const nonNullObject = val && typeof val === 'object';
  return (
    nonNullObject &&
    Object.prototype.toString.call(val) !== '[object RegExp]' &&
    Object.prototype.toString.call(val) !== '[object Date]'
  );
};

/**
 * Deep merge two objects
 * @param target target object to merge
 * @param sources source objects to merge
 * @returns
 **/
export const deepMerge = (target: any, ...sources: any[]) => {
  if (!sources.length) return target;
  const source = sources.shift();

  if (source === undefined) return target;

  if (isMergeableObject(target) && isMergeableObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isMergeableObject(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
  }

  return deepMerge(target, ...sources);
};

/**
 * Function to extract object with certain nested path in same structure
 */
export const partialExtract = (obj: any, path: (string[] | string)[]) => {
  if (typeof obj !== 'object' || obj === null) return obj;

  const result: Record<string, any> = {};

  for (const key of path) {
    if (Array.isArray(key)) {
      const [first, ...rest] = key;

      if (rest.length) {
        result[first] = Object.assign(
          result[first] || {},
          partialExtract(obj[first], rest),
        );
      } else {
        result[first] = obj[first];
      }
    } else {
      result[key] = obj[key];
    }
  }

  return result;
};
