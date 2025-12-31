# HubSpot Sync Integration for NocoDB

A robust integration that synchronizes HubSpot CRM data into NocoDB's CRM schema. This package extends the `SyncIntegration` base class and efficiently streams normalized records through `DataObjectStream`.

## Features

- **Comprehensive CRM Coverage**: Syncs HubSpot companies into NocoDB's `CRM_ACCOUNT` table
- **Intelligent Sync**: Implements incremental sync using `hs_lastmodifieddate` to only fetch updated records
- **Complete Field Mapping**: Comprehensive mapping of HubSpot company fields to standardized CRM fields
- **Efficient Processing**: Batch processing of records to optimize API usage and performance
- **Data Integrity**: Maintains original HubSpot data in the `RemoteRaw` field for reference
- **Automatic Pagination**: Handles large datasets through built-in pagination support
- **Rate Limit Handling**: Implements automatic retry logic for HubSpot API rate limits

## Quick Start

## How It Works

1. **Authentication**: Uses `@noco-integrations/hubspot-auth` for OAuth2 authentication
2. **Initialization**: `fetchData()` initiates the synchronization process
3. **Data Fetching**: Retrieves companies from HubSpot's API with pagination support
4. **Data Processing**: Processes each record through the formatter for schema mapping
5. **Streaming**: Emits normalized records through `DataObjectStream`
6. **Completion**: Finalizes the sync and updates the sync status

## Configuration

### Authentication

This integration uses OAuth2 authentication through the HubSpot Auth integration. Ensure you have:

1. Created a HubSpot Developer App
2. Configured the required OAuth scopes
3. Set up the auth integration in NocoDB

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
