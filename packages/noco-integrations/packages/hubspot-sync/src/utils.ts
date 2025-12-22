import { type HubSpotApiResponse } from './types';
import type { HubSpotCompany, HubSpotContact } from './types';

const axios = require('axios');

// Configuration
const HUBSPOT_API_KEY = 'your-api-key-here'; // Or use Private App token
const BASE_URL = 'https://api.hubapi.com';

// Helper function to handle pagination
async function getAllRecords<T>(endpoint: string, properties: string[]) {
  let allRecords: T[] = [];
  let after = undefined;

  do {
    const params = {
      limit: 100,
      properties: properties.join(','),
      ...(after && { after }),
    };

    const response = (await axios.get(endpoint, {
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      params,
    })) as { data: HubSpotApiResponse<T> };

    allRecords = allRecords.concat(response.data.results);
    after = response.data.paging?.next?.after;
  } while (after);

  return allRecords;
}

// Get Accounts (Companies)
export async function getAccounts() {
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
    const accounts = await getAllRecords<HubSpotCompany>(
      `${BASE_URL}/crm/v3/objects/companies/search`,
      properties,
    );

    console.log(`Retrieved ${accounts.length} accounts`);
    return accounts.map((account) => ({
      id: account.id,
      name: account.properties.name,
      description: account.properties.description,
      industry: account.properties.industry,
      website: account.properties.website,
      numberOfEmployees: account.properties.numberofemployees,
      address: {
        street: account.properties.address,
        city: account.properties.city,
        state: account.properties.state,
        zip: account.properties.zip,
        country: account.properties.country,
      },
      phone: account.properties.phone,
      lastActivityAt: account.properties.hs_lastmodifieddate,
      ownerId: account.properties.hubspot_owner_id,
      rawData: account,
    }));
  } catch (error) {
    console.error(
      'Error fetching accounts:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// Get Contacts
export async function getContacts() {
  const properties = [
    'firstname',
    'lastname',
    'email',
    'phone',
    'mobilephone',
    'address',
    'city',
    'state',
    'zip',
    'country',
    'hs_object_id',
    'associatedcompanyid',
    'hubspot_owner_id',
    'lastmodifieddate',
    'notes_last_updated',
  ];

  try {
    console.log('Fetching contacts...');
    const contacts = await getAllRecords<HubSpotContact>(
      `${BASE_URL}/crm/v3/objects/contacts`,
      properties,
    );

    console.log(`Retrieved ${contacts.length} contacts`);
    return contacts.map((contact) => ({
      id: contact.id,
      firstName: contact.properties.firstname,
      lastName: contact.properties.lastname,
      email: contact.properties.email,
      phone: contact.properties.phone,
      mobilePhone: contact.properties.mobilephone,
      address: {
        street: contact.properties.address,
        city: contact.properties.city,
        state: contact.properties.state,
        zip: contact.properties.zip,
        country: contact.properties.country,
      },
      accountId: contact.properties.associatedcompanyid,
      ownerId: contact.properties.hubspot_owner_id,
      lastActivityAt:
        contact.properties.lastmodifieddate ||
        contact.properties.notes_last_updated,
      rawData: contact,
    }));
  } catch (error) {
    console.error(
      'Error fetching contacts:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// Get Contacts with their associated Companies
export async function getContactsWithAccounts() {
  try {
    console.log('Fetching contacts with account associations...');

    const contacts = await getContacts();

    // Get associations in batches
    const contactsWithAccounts = await Promise.all(
      contacts.map(async (contact) => {
        try {
          const associations = await axios.get(
            `${BASE_URL}/crm/v3/objects/contacts/${contact.id}/associations/companies`,
            {
              headers: {
                Authorization: `Bearer ${HUBSPOT_API_KEY}`,
                'Content-Type': 'application/json',
              },
            },
          );

          return {
            ...contact,
            associatedAccountIds: associations.data.results.map((r) => r.id),
          };
        } catch (error) {
          // Contact may not have associated companies
          return {
            ...contact,
            associatedAccountIds: [],
          };
        }
      }),
    );

    return contactsWithAccounts;
  } catch (error) {
    console.error(
      'Error fetching contacts with accounts:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// Main execution function
export async function pullHubSpotData() {
  try {
    console.log('Starting HubSpot data pull...\n');

    // Pull accounts and contacts in parallel
    const [accounts, contacts] = await Promise.all([
      getAccounts(),
      getContactsWithAccounts(),
    ]);

    console.log('\n=== Summary ===');
    console.log(`Total Accounts: ${accounts.length}`);
    console.log(`Total Contacts: ${contacts.length}`);

    return {
      accounts,
      contacts,
      pulledAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error in data pull:', error.message);
    throw error;
  }
}
