import { ClientType } from 'nocodb-sdk';

export const D1_CLIENT = 'd1';

export const D1_BEST_EFFORT_WRITE_WARNING =
  'Cloudflare D1 does not support interactive transactions; NocoDB uses atomic D1 batches where a multi-step write can be precompiled, and otherwise falls back to best-effort writes.';

export const getClientType = (client: any): string | undefined => {
  if (!client) return undefined;
  if (typeof client === 'string') return client;

  return (
    client?.prototype?.driverName ||
    client?.prototype?.dialect ||
    client?.driverName ||
    client?.dialect
  );
};

export const getKnexClientType = (knexOrClient: any): string | undefined => {
  const client = knexOrClient?.client ?? knexOrClient;
  return (
    getClientType(client?.config?.client) ||
    client?.driverName ||
    client?.dialect
  );
};

export const isD1Client = (client: any) => getClientType(client) === D1_CLIENT;

export const isSqliteLikeClient = (client: any) => {
  const clientType = getClientType(client);
  return clientType === ClientType.SQLITE || clientType === D1_CLIENT;
};

export const isLocalSqliteClient = (client: any) =>
  getClientType(client) === ClientType.SQLITE;

export const withD1WarningMarker = <T extends Record<string, any>>(
  config: T,
): T => {
  if (config?.client !== D1_CLIENT) return config;

  return {
    ...config,
    warnings: {
      ...config.warnings,
      d1: {
        atomicBatches: true,
        bestEffortWrites: true,
        message: D1_BEST_EFFORT_WRITE_WARNING,
      },
    },
  };
};
