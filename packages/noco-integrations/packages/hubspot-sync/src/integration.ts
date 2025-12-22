import {
  DataObjectStream,
  SCHEMA_CRM,
  SyncIntegration,
} from '@noco-integrations/core';
import { TARGET_TABLES } from '@noco-integrations/core';
import { HubspotFormatter } from './formatter';
import type { SyncLinkValue, SyncRecord } from '@noco-integrations/core';
import type { HubSpotApiResponse, HubSpotCompany } from './types';
import type { HubspotAuthIntegration } from '@noco-integrations/hubspot-auth';

export interface HubspotSyncPayload {
  title: string;
}

export default class HubspotSyncIntegration extends SyncIntegration<HubspotSyncPayload> {
  formatter = new HubspotFormatter();

  public getTitle() {
    return this.config.title;
  }

  public async getDestinationSchema(_auth: HubspotAuthIntegration) {
    return SCHEMA_CRM;
  }

  public async fetchData(
    auth: HubspotAuthIntegration,
    args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: Record<TARGET_TABLES, string>;
    },
  ): Promise<DataObjectStream<SyncRecord>> {
    const stream = new DataObjectStream<SyncRecord>();

    // Simplified data fetching for Dropbox employees
    void (async () => {
      try {
        const lastModifiedCrmAccount =
          args.targetTableIncrementalValues?.[TARGET_TABLES.CRM_ACCOUNT];

        await this.fetchAccounts(auth, {
          lastModifiedAfter: lastModifiedCrmAccount,
          stream,
        });

        stream.push(null);
      } catch (error) {
        console.error('[Dropbox Sync] Error fetching data:', error);
        stream.destroy(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    })();

    return stream;
  }
  formatData(
    targetTable: TARGET_TABLES | string,
    data: any,
    namespace?: string,
  ): { data: SyncRecord; links?: Record<string, SyncLinkValue> } {
    switch (targetTable) {
      default: {
        return {
          data: {
            RemoteRaw: JSON.stringify(data),
            RemoteNamespace: namespace,
          },
        };
      }
    }
  }

  // fetching

  // Helper function to handle pagination
  async fetchAllRecords<T>(
    auth: HubspotAuthIntegration,
    {
      endpoint,
      body = {},
      method = 'get',
      properties = [],
      onResponse,
    }: {
      endpoint: string;
      body?: any;
      method?: 'get' | 'put' | 'post';
      properties?: string[];
      onResponse: (data: T[]) => Promise<void>;
    },
  ) {
    let after: string | undefined = undefined;

    do {
      const response: { data: HubSpotApiResponse<T> } = await auth.use(
        async (client) => {
          if (method === 'get') {
            const params = {
              limit: 100,
              properties: properties.join(','),
              ...(after && { after }),
            };
            return (await client[method](endpoint, {
              params,
            })) as { data: HubSpotApiResponse<T> };
          } else {
            return (await client[method](endpoint, {
              ...body,
              limit: 100,
              after,
            })) as {
              data: HubSpotApiResponse<T>;
            };
          }
        },
      );
      await onResponse(response.data.results);
      after = response.data.paging?.next?.after;
    } while (after);
  }

  // Fetch Accounts (Companies)
  async fetchAccounts(
    auth: HubspotAuthIntegration,
    {
      lastModifiedAfter,
      stream,
    }: { lastModifiedAfter?: string; stream: DataObjectStream<SyncRecord> },
  ) {
    const properties = [
      'name',
      'description',
      'industry',
      'website',
      'numberofemployees',
      'address',
      'city',
      'state',
      'zip',
      'country',
      'phone',
      'hs_lastmodifieddate',
      'hubspot_owner_id',
    ];

    try {
      console.log('Fetching accounts (companies)...');
      await this.fetchAllRecords<HubSpotCompany>(auth, {
        endpoint: '/crm/v3/objects/companies/search',
        method: 'post',
        body: {
          filterGroups: lastModifiedAfter
            ? [
                {
                  filters: [
                    {
                      propertyName: 'hs_lastmodifieddate',
                      operator: 'GTE',
                      value: lastModifiedAfter,
                    },
                  ],
                },
              ]
            : undefined,
          properties,
          sorts: ['hs_lastmodifieddate'],
        },
        onResponse: async (data: HubSpotCompany[]) => {
          for (const formattedAccount of this.formatter.formatAccounts({
            companies: data,
          })) {
            stream.push(formattedAccount);
          }
          console.log(`Retrieved ${data.length} accounts`);
        },
      });
    } catch (error: any) {
      console.error(
        'Error fetching accounts:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  public getIncrementalKey(targetTable: TARGET_TABLES) {
    switch (targetTable) {
      default:
        return 'RemoteUpdatedAt';
    }
  }
}
