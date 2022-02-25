import * as _ from 'lodash';
import S3 from '../../../../../plugins/s3/S3';

/**
 * Decorate function to Replace private S3 URLs with signed URLs.
 * @returns {Function} Decorator function.
 */
export function generateS3SignedUrls() {
  return function(_target, _key, fn: PropertyDescriptor) {
    const originalFn = fn.value;

    fn.value = async function(...args) {
      const result = await originalFn.call(this, ...args);
      if (typeof result !== 'object' || !isS3PluginActive.call(this))
        return result;

      return reparseResult.call(this, result);
    };
    return fn;
  };
}

function isS3PluginActive() {
  return this.storageAdapter instanceof S3;
}

/**
 * Reparses the result with S3 URLs replaced with signed URL.
 * @param {any} result - the result of a filter function.
 * @returns Object with S3 URLs replaced with signed URLs.
 */
function reparseResult(result) {
  const stringifiedResult = JSON.stringify(result);
  if (!hasS3Url(stringifiedResult)) return result;

  return JSON.parse(stringifiedResult, replaceUrlWithSignedUrlFn.call(this));
}

function hasS3Url(result: string) {
  return result.search('S3Key') !== -1;
}

/**
 * Returns a function which replaces the S3 URL with a signed URL.
 * Can be used as a JSON.parse replacer.
 * @returns {Function} the signed URL replacer function
 */
// eslint-disable-next-line @typescript-eslint/ban-types
function replaceUrlWithSignedUrlFn(): Function {
  return (_k, v) => {
    const parsed = tryParseJson(v);
    if (!parsed || !Array.isArray(parsed)) return v;

    return JSON.stringify(
      parsed.map(item => {
        if (item?.S3Key)
          item.url = this.storageAdapter.getSignedUrl(item.S3Key);

        return item;
      })
    );
  };
}

/**
 * Attempts to parse a string as JSON.
 * @param {any} jsonString - the string to parse
 * @returns {any} the parsed JSON object, or null if the string is not valid JSON.
 */
function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}
