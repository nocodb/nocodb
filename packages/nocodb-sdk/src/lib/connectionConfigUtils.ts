import { SSLUsage } from '~/lib/enums';

export const validateAndExtractSSLProp = (
  connectionConfig: any,
  sslUse: SSLUsage,
  client: string
) => {
  if ('ssl' in connectionConfig && connectionConfig.ssl) {
    if (
      sslUse === SSLUsage.No ||
      (typeof connectionConfig.ssl === 'object' &&
        Object.values(connectionConfig.ssl).every(
          (v) => v === null || v === undefined
        ))
    ) {
      return undefined;
    }
    // if postgres then only allow boolean or object
    else if (
      client === 'pg' &&
      ['true', 'false'].includes(connectionConfig.ssl)
    ) {
      return connectionConfig.ssl === 'true';
    } else if (
      client === 'pg' &&
      !['boolean', 'object'].includes(typeof connectionConfig.ssl)
    ) {
      return undefined;
    }

    return connectionConfig.ssl;
  }
};
