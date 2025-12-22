import { TARGET_TABLES } from '@noco-integrations/core';
import type { SyncLinkValue, SyncRecord } from '@noco-integrations/core';
import type { HubSpotCompany } from './types';

export class HubspotFormatter {
  formatAccounts({ companies }: { companies: HubSpotCompany[] }) {
    const result: Array<{
      recordId: string;
      targetTable: TARGET_TABLES;
      data: SyncRecord;
      links?: Record<string, SyncLinkValue>;
    }> = [];

    for (const company of companies) {
      result.push({
        recordId: company.id,
        targetTable: TARGET_TABLES.CRM_ACCOUNT,
        data: {
          Name: company.properties.name,
          Description: company.properties.description,
          Industry: company.properties.industry,
          Website: company.properties.website,
          'Number Of Employees': company.properties.numberofemployees,
          Address: [
            company.properties.address,
            company.properties.city,
            company.properties.state,
            company.properties.zip,
            company.properties.country,
          ]
            .filter((k) => k)
            .join(', '),
          'Phone Numbers': company.properties.phone,
          RemoteRaw: JSON.stringify(company),
          RemoteCreatedAt: company.properties.hs_createdate,
          RemoteUpdatedAt: company.properties.hs_lastmodifieddate,
        } as SyncRecord,
        links: {},
      });
    }
    return result;
  }
}
