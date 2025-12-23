import { TARGET_TABLES } from '@noco-integrations/core';
import type { SyncLinkValue, SyncRecord } from '@noco-integrations/core';
import type { HubSpotCompany, HubSpotContact } from './types';

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
          Addresses: [
            company.properties.address,
            company.properties.city,
            company.properties.state,
            company.properties.zip,
            company.properties.country,
          ]
            .filter((k) => k)
            .join(', '),
          'Phone Numbers':
            company.properties.phone || company.properties.mobilephone,
          RemoteRaw: JSON.stringify(company),
          RemoteCreatedAt: company.properties.hs_createdate,
          RemoteUpdatedAt: company.properties.hs_lastmodifieddate,
        } as SyncRecord,
        links: {},
      });
    }
    return result;
  }

  formatContacts({ contacts }: { contacts: HubSpotContact[] }) {
    const result: Array<{
      recordId: string;
      targetTable: TARGET_TABLES;
      data: SyncRecord;
      links?: Record<string, SyncLinkValue>;
    }> = [];

    for (const contact of contacts) {
      result.push({
        recordId: contact.id,
        targetTable: TARGET_TABLES.CRM_CONTACT,
        data: {
          'First Name': contact.properties.firstname,
          'Last Name': contact.properties.lastname,
          'Email Address': contact.properties.email,
          'Phone Numbers':
            contact.properties.phone || contact.properties.mobilephone,
          'Remote Fields': {
            'Job Title': contact.properties.jobtitle,
            Company: contact.properties.company,
          },
          Addresses: [
            contact.properties.address,
            contact.properties.city,
            contact.properties.state,
            contact.properties.zip,
            contact.properties.country,
          ]
            .filter((k) => k)
            .join(', '),
          RemoteRaw: JSON.stringify(contact),
          RemoteCreatedAt: contact.properties.createdate,
          RemoteUpdatedAt: contact.properties.hs_lastmodifieddate,
        } as SyncRecord,
        links: {},
      });
    }
    return result;
  }
}
