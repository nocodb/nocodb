# HubSpot Sync Integration

Sync HubSpot CRM data into NocoDB's CRM schema. This package extends the `SyncIntegration` base class and streams normalized records through `DataObjectStream`.

## Features

- **CRM schema coverage**: Syncs HubSpot companies into the `CRM_ACCOUNT` table.
- **Incremental sync**: Uses `hs_lastmodifieddate` to only fetch updated records.
- **Comprehensive field mapping**: Maps common HubSpot company fields to standardized CRM fields.
- **Batch processing**: Efficiently processes records in batches to manage API rate limits.
- **Raw data preservation**: Maintains original HubSpot data in the `RemoteRaw` field.

## How It Works

1. Requires a HubSpot Auth integration (`@noco-integrations/hubspot-auth`) that provides an authenticated API client.
2. `fetchData()` initiates a sync of HubSpot companies.
3. The integration fetches companies from HubSpot's API with pagination support.
4. The formatter processes each company record, mapping HubSpot fields to the CRM schema.
5. Records are emitted through `DataObjectStream` until all data is processed.

## Configuration

### Prerequisites

- NocoDB instance with the integrations framework enabled.
- HubSpot Auth integration configured with OAuth token.

### Sync Form Fields

| Field | Description |
| --- | --- |
| `title` | Display name for this sync instance. |
| `config.authIntegrationId` | Reference to an existing HubSpot auth connection. |

### Required HubSpot Permissions

Ensure your HubSpot OAuth token has the following scopes:

- `crm.objects.companies.read` – Read company data
- `crm.schemas.companies.read` – Read company schema (for field metadata)

## Target Tables & Data Mapping

All data is written to the CRM schema exported by `@noco-integrations/core`.

### `CRM_ACCOUNT`

Fields populated by `HubspotFormatter.formatAccounts()`:

- `Name` – Company name from HubSpot
- `Description` – Company description
- `Industry` – Industry classification
- `Website` – Company website URL
- `Number Of Employees` – Company size
- `Address` – Combined address fields (street, city, state, zip, country)
- `Phone Numbers` – Primary phone number
- `RemoteRaw` – Full company JSON from HubSpot API
- `RemoteCreatedAt` – Company creation date (`hs_createdate`)
- `RemoteUpdatedAt` – Last modification date (`hs_lastmodifieddate`)

## API Endpoints Used

- `GET /crm/v3/objects/companies` – Fetch company data
- `GET /crm/v3/properties/companies` – Get company property definitions

## Incremental Sync

- Uses `hs_lastmodifieddate` to track changes.
- Only fetches records modified since the last successful sync.
- Automatically handles pagination through the HubSpot API.

## Error Handling & Limits

- Any error during fetching destroys the stream and surfaces the original exception.
- Respects HubSpot API rate limits with automatic retry logic.
- Processes records in batches to manage memory usage.
- Preserves original HubSpot data in `RemoteRaw` for reference.

## Usage Example

```typescript
import { Integration, TARGET_TABLES } from '@noco-integrations/core';
import HubspotSyncIntegration from '@noco-integrations/hubspot-sync';

const syncIntegration = await Integration.get(context, syncIntegrationId);
const authIntegration = await Integration.get(
  context,
  syncIntegration.getConfig().authIntegrationId,
);

const authWrapper = await authIntegration.getIntegrationWrapper();
const dropboxAuth = await authWrapper.authenticate(); // DropboxAuthIntegration

const syncWrapper = await syncIntegration.getIntegrationWrapper();

const stream = await syncWrapper.fetchData(dropboxAuth, {
  targetTables: [
    TARGET_TABLES.FILE_STORAGE_FILE,
    TARGET_TABLES.FILE_STORAGE_FOLDER,
  ],
});

for await (const record of stream) {
  console.log(record.targetTable, record.data);
}
```

## Next Steps

- Use this integration to sync HubSpot company data into your NocoDB CRM schema.
- Monitor HubSpot API usage to stay within rate limits.
- Extend `HubspotFormatter` to include additional company fields or custom properties as needed.
