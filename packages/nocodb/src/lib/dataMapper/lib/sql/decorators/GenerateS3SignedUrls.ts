import { getS3Adapter, pluginConfigFn } from '../../../../helpers/S3Helper';

/**
 * Attempts to parse a string as JSON.
 * @param {string} jsonString - the string to parse
 * @returns {any} the parsed JSON object, or null if the string is not valid JSON.
 */
function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

export function generateS3SignedUrls() {
  return function(
    _target: any,
    _key: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value;
    descriptor.value = async function(...args) {
      const result = await original.call(this, ...args);
      this.pluginConfig = await pluginConfigFn.call(this);
      if (typeof result !== 'object' || !this.pluginConfig?.active)
        return result;

      const s3Adapter = await getS3Adapter.call(this);
      return JSON.parse(JSON.stringify(result), function(_k, v) {
        if (typeof v !== 'string') return v;

        const parsed = tryParseJson(v);
        if (!parsed || !Array.isArray(parsed)) return v;

        return JSON.stringify(
          parsed.map(item => {
            if (item?.S3Key) item.url = s3Adapter.getSignedUrl(item.S3Key);
            return item;
          })
        );
      });
    };
    return descriptor;
  };
}
