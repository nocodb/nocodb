import {
  DataObjectStream,
  SCHEMA_CRM,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import { HubspotFormatter } from './formatter';
import type { SyncLinkValue, SyncRecord } from '@noco-integrations/core';
import type { HubspotAuthIntegration } from '@noco-integrations/hubspot-auth';
import type {
  HubSpotApiResponse,
  HubSpotCompany,
  HubSpotContact,
  HubSpotOwner,
} from './types';

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

    // Simplified data fetching for Hubspot employees
    void (async () => {
      try {
        const lastModifiedCrmAccount =
          args.targetTableIncrementalValues?.[TARGET_TABLES.CRM_ACCOUNT];

        await this.fetchUser(auth, {
          lastModifiedAfter: lastModifiedCrmAccount,
          stream,
        });

        let updatedAccountIds: string[] = [];
        await this.fetchAccounts(auth, {
          lastModifiedAfter: lastModifiedCrmAccount,
          stream,
          onResponse: async (accounts) => {
            for (const account of accounts) {
              // Collect account IDs for later use
              updatedAccountIds.push(account.id);
            }
          },
        });

        await this.fetchContacts(auth, {
          lastModifiedAfter: lastModifiedCrmAccount,
          stream,
        });
        for (const accountId of updatedAccountIds) {
          console.log(`Processing company ID: ${accountId}`);
          await this.fetchCompanyContacts(auth, {
            companyId: accountId,
            stream,
          });
        }

        stream.push(null);
      } catch (error) {
        console.error('[Hubspot Sync] Error fetching data:', error);
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
      onResponse,
    }: {
      lastModifiedAfter?: string;
      stream: DataObjectStream<SyncRecord>;
      onResponse?: (data: HubSpotCompany[]) => Promise<void>;
    },
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
                      operator: 'GT',
                      // +1000 is somehow required even with GT, otherwise the latest synced account will be fetched again
                      // +1 will still keep fetching the latest synced account
                      value: new Date(lastModifiedAfter).getTime() + 1000,
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
          if (onResponse) {
            await onResponse(data);
          }
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

  async fetchUser(
    auth: HubspotAuthIntegration,
    {
      lastModifiedAfter: _lastModifiedAfter, // Prefix with _ to indicate it's intentionally unused
      stream,
      onResponse,
    }: {
      lastModifiedAfter?: string;
      stream: DataObjectStream<SyncRecord>;
      onResponse?: (data: HubSpotOwner[]) => Promise<void>;
    },
  ) {
    try {
      console.log('Fetching users...');
      await this.fetchAllRecords<HubSpotOwner>(auth, {
        endpoint: '/crm/v3/owners',
        method: 'get',
        body: {
          limit: 100,
        },
        onResponse: async (data: HubSpotOwner[]) => {
          for (const formattedUser of this.formatter.formatUsers({
            users: data,
          })) {
            stream.push(formattedUser);
          }
          if (onResponse) {
            await onResponse(data);
          }
        },
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async fetchContacts(
    auth: HubspotAuthIntegration,
    {
      lastModifiedAfter,
      stream,
      onResponse,
    }: {
      lastModifiedAfter?: string;
      stream: DataObjectStream<SyncRecord>;
      onResponse?: (data: HubSpotContact[]) => Promise<void>;
    },
  ) {
    const properties = [
      'firstname',
      'lastname',
      'email',
      'phone',
      'mobilephone',
      'jobtitle',
      'company',
      'address',
      'city',
      'state',
      'zip',
      'country',
      'hs_lastmodifieddate',
      'hubspot_owner_id',
    ];

    try {
      console.log('Fetching contacts...');
      await this.fetchAllRecords<HubSpotContact>(auth, {
        endpoint: '/crm/v3/objects/contacts/search',
        method: 'post',
        body: {
          filterGroups: lastModifiedAfter
            ? [
                {
                  filters: [
                    {
                      propertyName: 'lastmodifieddate',
                      operator: 'GT',
                      // +1000 is required to avoid fetching the same contact again
                      value: new Date(lastModifiedAfter).getTime() + 1000,
                    },
                  ],
                },
              ]
            : undefined,
          properties,
          sorts: ['lastmodifieddate'],
        },
        onResponse: async (data: HubSpotContact[]) => {
          for (const formattedContact of this.formatter.formatContacts({
            contacts: data,
          })) {
            stream.push(formattedContact);
          }
          console.log(`Retrieved ${data.length} contacts`);
          if (onResponse) {
            await onResponse(data);
          }
        },
      });
    } catch (error: any) {
      console.error(
        'Error fetching contacts:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Fetches contacts associated with a specific company
   * @param auth Hubspot auth integration
   * @param companyId The ID of the company to fetch contacts for
   */
  async fetchCompanyContacts(
    auth: HubspotAuthIntegration,
    {
      companyId,
      stream,
    }: { companyId: string; stream: DataObjectStream<SyncRecord> },
  ) {
    try {
      console.log(`Fetching contacts for company ${companyId}...`);
      let contactIds: string[] = [];
      let after: string | undefined;

      do {
        const response = await auth.use(async (client) => {
          const params: any = {
            limit: 100,
            // Use the associations API to get contacts linked to this company
            after,
          };

          return await client.get(
            `/crm/v4/objects/companies/${companyId}/associations/contacts`,
            { params },
          );
        });

        // Extract contact IDs from the response
        const results = response.data?.results || [];
        contactIds = [
          ...contactIds,
          ...results
            .map((r: { toObjectId: string }) => r.toObjectId)
            .filter((k: string) => k),
        ];

        // Handle pagination
        after = response.data?.paging?.next?.after;
      } while (after);

      console.log(
        `Found ${contactIds.length} contacts for company ${companyId}`,
      );
      if (contactIds.length) {
        stream.push({
          recordId: companyId,
          targetTable: TARGET_TABLES.CRM_ACCOUNT,
          links: {
            Contacts: contactIds,
          },
        });
      }
    } catch (error: any) {
      console.error(
        `Error fetching contacts for company ${companyId}:`,
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
