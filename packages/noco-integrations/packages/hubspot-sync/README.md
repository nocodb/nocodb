# HubSpot Sync Integration for NocoDB

[![npm version](https://img.shields.io/npm/v/@noco-integrations/hubspot-sync)](https://www.npmjs.com/package/@noco-integrations/hubspot-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A robust integration that synchronizes HubSpot CRM data into NocoDB's CRM schema. This package extends the `SyncIntegration` base class and efficiently streams normalized records through `DataObjectStream`.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Data Mapping](#data-mapping)
- [API Usage](#api-usage)
- [Incremental Sync](#incremental-sync)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Comprehensive CRM Coverage**: Syncs HubSpot companies into NocoDB's `CRM_ACCOUNT` table
- **Intelligent Sync**: Implements incremental sync using `hs_lastmodifieddate` to only fetch updated records
- **Complete Field Mapping**: Comprehensive mapping of HubSpot company fields to standardized CRM fields
- **Efficient Processing**: Batch processing of records to optimize API usage and performance
- **Data Integrity**: Maintains original HubSpot data in the `RemoteRaw` field for reference
- **Automatic Pagination**: Handles large datasets through built-in pagination support
- **Rate Limit Handling**: Implements automatic retry logic for HubSpot API rate limits

## Quick Start

### Prerequisites

- Node.js 16.x or later
- NocoDB instance with integrations framework enabled
- HubSpot developer account with API access
- Existing HubSpot Auth integration (`@noco-integrations/hubspot-auth`)

### Installation

```bash
# Using npm
npm install @noco-integrations/hubspot-sync @noco-integrations/hubspot-auth

# Or using yarn
yarn add @noco-integrations/hubspot-sync @noco-integrations/hubspot-auth
```

## How It Works

1. **Authentication**: Uses `@noco-integrations/hubspot-auth` for OAuth2 authentication
2. **Initialization**: `fetchData()` initiates the synchronization process
3. **Data Fetching**: Retrieves companies from HubSpot's API with pagination support
4. **Data Processing**: Processes each record through the formatter for schema mapping
5. **Streaming**: Emits normalized records through `DataObjectStream`
6. **Completion**: Finalizes the sync and updates the sync status

## Configuration

### Sync Form Fields

| Field | Type | Required | Description |
|----------------------|----------|----------|-----------------------------------|
| `title` | String | Yes | Display name for this sync instance |
| `config.authIntegrationId` | String | Yes | Reference to HubSpot auth connection |
| `config.syncFrequency` | Number | No | Sync frequency in minutes (default: 60) |
| `config.batchSize` | Number | No | Number of records per batch (default: 100) |

### Environment Variables

| Variable | Required | Default | Description |
|-----------------------------|----------|---------|-----------------------------------|
| `HUBSPOT_API_VERSION` | No | v3 | HubSpot API version |
| `HUBSPOT_RATE_LIMIT` | No | 100 | Maximum requests per 10 seconds |
| `HUBSPOT_RETRY_ATTEMPTS` | No | 3 | Number of retry attempts on failure |

### Required HubSpot Permissions

Ensure your HubSpot OAuth token has the following scopes:

- `crm.objects.companies.read` – Read company data
- `crm.schemas.companies.read` – Read company schema (for field metadata)

## Data Mapping

### Standard Field Mappings

| HubSpot Field | NocoDB Field | Type | Description |
|----------------------|----------------------|----------|-----------------------------------|
| `properties.name` | `Name` | String | Company name |
| `properties.description` | `Description` | Text | Company description |
| `properties.industry` | `Industry` | String | Industry classification |
| `properties.website` | `Website` | URL | Company website |
| `properties.numberofemployees` | `Number Of Employees` | Number | Company size |
| `properties.address` | `Address` | Object | Combined address information |
| `properties.phone` | `Phone Numbers` | String | Primary contact number |
| `hs_createdate` | `RemoteCreatedAt` | DateTime | Record creation timestamp |
| `hs_lastmodifieddate` | `RemoteUpdatedAt` | DateTime | Last update timestamp |
| - | `RemoteRaw` | JSON | Complete raw data from HubSpot |

### Custom Properties

All custom properties from HubSpot are included in the `RemoteRaw` field. To map custom properties to standard fields, extend the `HubspotFormatter` class:

```typescript
import { HubspotFormatter } from '@noco-integrations/hubspot-sync';

class CustomHubspotFormatter extends HubspotFormatter {
  formatAccount(company) {
    const account = super.formatAccount(company);
    // Map custom property to standard field
    account.customField = company.properties.custom_property;
    return account;
  }
}
```

## API Usage

### Authentication

This integration uses OAuth2 authentication through the HubSpot Auth integration. Ensure you have:

1. Created a HubSpot Developer App
2. Configured the required OAuth scopes
3. Set up the auth integration in NocoDB

### API Endpoints

| Endpoint | Method | Description |
|-----------------------------------|--------|-----------------------------------|
| `/crm/v3/objects/companies` | GET | Fetch company data |
| `/crm/v3/properties/companies` | GET | Get company property definitions |
| `/crm/v3/imports` | POST | Batch import companies (future) |

### Rate Limits

The integration respects HubSpot's rate limits (100 requests per 10 seconds by default) and includes automatic retry logic with exponential backoff.

## Incremental Sync

The integration implements efficient incremental synchronization to minimize API calls and processing time:

- **Change Tracking**: Uses `hs_lastmodifieddate` to identify updated records
- **Bookmarking**: Maintains sync state between runs
- **Resumable**: Automatically resumes from the last successful sync point
- **Pagination**: Handles large result sets through cursor-based pagination

### Sync Behavior

- **Initial Sync**: Fetches all companies
- **Incremental Sync**: Only fetches records modified since last sync
- **Error Recovery**: Implements checkpoints to prevent data loss on failure

### Monitoring

Sync status and metrics are available through the NocoDB integrations dashboard:

- Last successful sync time
- Number of records processed
- Sync duration
- Error count

## Error Handling

The integration includes robust error handling to ensure data consistency and reliability:

- **Rate Limiting**: Implements exponential backoff for rate limit errors
- **Retry Logic**: Automatically retries failed requests (configurable)
- **Error Logging**: Detailed error messages and stack traces
- **State Management**: Maintains sync state to prevent data loss

### Common Issues

#### API Rate Limits

If you encounter rate limit errors, try:
1. Increasing the `HUBSPOT_RATE_LIMIT` environment variable
2. Reducing the sync frequency
3. Contacting HubSpot support for higher limits

#### Authentication Errors

1. Verify OAuth token is valid and not expired
2. Check that all required scopes are granted
3. Ensure the HubSpot app is properly configured

### Logging

Enable debug logging for troubleshooting:

```bash
export DEBUG=hubspot-sync:*
```

## Usage Example

### Basic Usage

```typescript
import { Integration, TARGET_TABLES } from '@noco-integrations/core';
import HubspotSyncIntegration from '@noco-integrations/hubspot-sync';

async function syncHubSpotData() {
  // Initialize the integration
  const syncIntegration = await Integration.get(context, syncIntegrationId);
  const authIntegration = await Integration.get(
    context,
    syncIntegration.getConfig().authIntegrationId
  );

  // Authenticate with HubSpot
  const authWrapper = await authIntegration.getIntegrationWrapper();
  const hubspotAuth = await authWrapper.authenticate();

  // Get sync wrapper
  const syncWrapper = await syncIntegration.getIntegrationWrapper();

  // Start sync
  try {
    const stream = await syncWrapper.fetchData(hubspotAuth, {
      targetTables: [TARGET_TABLES.CRM_ACCOUNT],
      // Optional: Only sync records updated in the last 24 hours
      // updatedAfter: new Date(Date.now() - 24 * 60 * 60 * 1000)
    });

    // Process the stream
    for await (const record of stream) {
      console.log(`Processed ${record.targetTable}:`, record.data.id);
    }
    
    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}
```

### Advanced Usage: Custom Formatter

```typescript
import { HubspotFormatter } from '@noco-integrations/hubspot-sync';

class CustomHubspotFormatter extends HubspotFormatter {
  async formatAccount(company) {
    const account = await super.formatAccount(company);
    
    // Add custom fields
    account.customFields = {
      annualRevenue: company.properties.annualrevenue,
      lastContactDate: company.properties.last_contact_date
    };
    
    return account;
  }
}

// Use the custom formatter
syncWrapper.setFormatter(new CustomHubspotFormatter());
```

## Development

### Prerequisites

- Node.js 16+
- Yarn or npm
- Docker (for local testing)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   yarn install
   ```
3. Copy `.env.example` to `.env` and configure your environment variables

### Testing

Run the test suite:

```bash
yarn test
# or for watch mode
yarn test:watch
```

### Building

```bash
yarn build
```

### Linting

```bash
yarn lint
```

## Contributing

We welcome contributions! Please read our [contributing guidelines](CONTRIBUTING.md) before submitting pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Versioning

We use [SemVer](https://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/nocodb/noco-integrations/tags).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the [GitHub repository](https://github.com/nocodb/noco-integrations/issues) or join our [community Slack](https://community.nocodb.com/).
