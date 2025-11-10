# Freshdesk Sync Integration

Sync integration for Freshdesk that syncs tickets, contacts, agents, and groups to NocoDB.

## Features

- **Ticket Sync**: Syncs all tickets with support for filtering by status
- **Contact Sync**: Syncs contacts (customers/requesters) associated with tickets
- **Agent Sync**: Syncs agents (support staff) assigned to tickets
- **Group Sync**: Syncs groups (teams) that tickets are assigned to
- **Incremental Sync**: Supports incremental updates based on `updated_at` timestamp
- **Rate Limiting**: Respects Freshdesk API rate limits with automatic delays
- **Pagination**: Handles pagination automatically (100 items per page)

## Configuration

### Required Fields

1. **Integration Name**: A friendly name for your sync integration
2. **Freshdesk Connection**: Select a configured Freshdesk auth integration
3. **Include Closed Tickets**: Whether to sync closed/resolved tickets (default: false)

## Synced Entities

### Tickets
- **Endpoint**: `/api/v2/tickets`
- **Fields**: ID, subject, description, status, priority, type, tags, timestamps, URLs
- **Links**: Requester (contact), assignee (agent), team (group)
- **Status Mapping**:
  - 2 → open
  - 3 → pending
  - 4 → resolved
  - 5 → closed
- **Priority Mapping**:
  - 1 → low
  - 2 → medium
  - 3 → high
  - 4 → urgent

### Conversations (Comments)
- **Endpoint**: `/api/v2/tickets/:id/conversations`
- **Fields**: ID, title, body, timestamps
- **Links**: Ticket, Created By (user)
- **Types**: Public comments and private notes
- **Pagination**: 30 items per page

### Contacts (Users)
- **Endpoint**: `/api/v2/contacts/:id`
- **Fields**: ID, name, email, phone, avatar, timestamps
- **Role**: customer

### Agents (Users)
- **Endpoint**: `/api/v2/agents/:id`
- **Role**: agent

### Groups (Teams)
- **Endpoint**: `/api/v2/admin/groups`
- **Fields**: ID, name, description, timestamps
- **Links**: Members (agents in the group via `agent_ids`)
- **Note**: Fetches all groups with their agent memberships

## Pagination

Freshdesk uses page-based pagination:
- Default: 30 items per page
- Page numbers start at 1
- Link header indicates if more pages exist

## Rate Limiting

The integration includes automatic rate limiting:
- 200ms delay between ticket page requests
- 100ms delay between individual contact/agent/group requests
- Respects Freshdesk's rate limit headers

## Incremental Sync

The integration supports incremental sync using the `updated_since` parameter:
- Only fetches tickets updated after the last sync
- Parameter: `updated_since=2024-01-01T00:00:00Z`
- Timestamp format: ISO 8601 (e.g., `2024-01-01T00:00:00Z`)
- Automatically managed by NocoDB sync system

## Filtering Strategy

The integration uses Freshdesk's **List Tickets API** (`/api/v2/tickets`) with client-side filtering:

**Why List API instead of Search API?**
- **List API**: Supports up to 300 pages (30,000 tickets)
- **Search API**: Limited to 10 pages (300 tickets)
- For comprehensive syncing, List API ensures we don't miss tickets

**Status Filtering:**
- When "Include Closed Tickets" is disabled, filters out resolved (4) and closed (5) tickets after fetching
- Client-side filtering ensures we get all open/pending tickets

**Incremental Filtering:**
- Uses `updated_since` parameter: `/api/v2/tickets?updated_since=2024-01-01T00:00:00Z`
- Only fetches tickets updated after the last sync
- Applied at API level for efficiency

## Usage Example

```typescript
import FreshdeskSyncIntegration from '@noco-integrations/freshdesk-sync';
import { FreshdeskAuthIntegration } from '@noco-integrations/freshdesk-auth';

// Create auth integration
const authIntegration = new FreshdeskAuthIntegration({
  domain: 'yourcompany.freshdesk.com',
  api_key: 'your_api_key',
});

// Authenticate
const auth = await authIntegration.authenticate();

// Create sync integration
const syncIntegration = new FreshdeskSyncIntegration({
  authIntegrationId: 'auth_integration_id',
  includeClosed: false,
});

// Fetch data
const stream = await syncIntegration.fetchData(auth, {
  targetTables: ['ticketing_ticket', 'ticketing_user', 'ticketing_team'],
});

// Process stream
stream.on('data', (record) => {
  console.log('Synced record:', record);
});
```

## API Endpoints Used

- `GET /api/v2/tickets` - List all tickets (supports up to 30,000 tickets)
- `GET /api/v2/tickets/:id/conversations` - List all conversations for a ticket
- `GET /api/v2/contacts/:id` - Get contact details
- `GET /api/v2/agents/:id` - Get agent details
- `GET /api/v2/admin/groups` - List all groups (teams) with agent memberships

## Error Handling

The integration handles various error scenarios:
- **404 Not Found**: Indicates end of pagination or deleted resource
- **401 Unauthorized**: Invalid API key
- **403 Forbidden**: Insufficient permissions
- **429 Too Many Requests**: Rate limit exceeded (automatic retry recommended)

## Best Practices

1. **Rate Limiting**: The integration includes built-in delays, but monitor your API usage
2. **Incremental Sync**: Use incremental sync for large datasets to reduce API calls
3. **Closed Tickets**: Consider excluding closed tickets for faster syncs
4. **Error Monitoring**: Monitor logs for failed requests to individual resources

## Documentation

- [Freshdesk API Documentation](https://developers.freshdesk.com/api/)
- [Tickets API](https://developers.freshdesk.com/api/#tickets)
- [Contacts API](https://developers.freshdesk.com/api/#contacts)
- [Agents API](https://developers.freshdesk.com/api/#agents)
- [Groups API](https://developers.freshdesk.com/api/#admin-groups)

## License

MIT
