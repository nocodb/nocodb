# Bitbucket Sync Integration

Sync integration for Bitbucket issues and pull requests in NocoDB.

## Features

- **Issue Syncing**: Sync issues from Bitbucket repositories
- **Pull Request Syncing**: Optional PR syncing with reviewers and status
- **Comment Syncing**: Sync issue and PR comments
- **User Syncing**: Automatic user extraction from issues, PRs, and comments
- **Incremental Sync**: Only fetch updated items on subsequent syncs
- **Multi-Repository**: Sync multiple repositories simultaneously

## Configuration

### Prerequisites

Requires a configured Bitbucket Auth integration (`@noco-integrations/bitbucket-auth`).

### Required Permissions

Your Bitbucket access token or OAuth app must have the following scopes:

- **`repository`** - Read access to repositories (required for issues and PRs)
- **`issue`** - Read access to issue comments (required for comment syncing)
- **`pullrequest`** - Read access to pull requests (if syncing PRs)
- **`account`** - Read access to user information

**Note**: If your token lacks the `issue` scope, comment syncing will be skipped with a warning, but issues and PRs will still sync successfully.

### Sync Options

1. **Repositories**: Select one or more repositories to sync (format: `workspace/repository`)
2. **Include Closed Issues**: Sync closed/resolved issues (default: true)
3. **Include Pull Requests**: Sync pull requests in addition to issues (default: false)

## Data Schema

Syncs to the **Ticketing** schema with the following tables:

### Tickets (Issues & PRs)
- **Name**: Issue/PR title
- **Description**: Issue/PR description
- **Status**: Issue state (new, open, resolved, closed) or PR state (OPEN, MERGED, DECLINED)
- **Priority**: Issue priority
- **Ticket Type**: "Issue" or "Pull Request"
- **Ticket Number**: Issue/PR ID
- **URL**: Link to issue/PR on Bitbucket
- **Is Active**: Whether issue/PR is open
- **Completed At**: When issue/PR was closed/merged
- **Creator**: Link to reporter/author
- **Assignees**: Link to assignees/reviewers

### Users
- **Name**: Display name or username
- **URL**: Link to user profile

### Comments
- **Title**: Auto-generated comment title
- **Body**: Comment content
- **URL**: Link to comment
- **Ticket**: Link to parent issue/PR
- **Created By**: Link to comment author

## Bitbucket API Endpoints Used

- `GET /repositories` - List user repositories
- `GET /repositories/{workspace}/{repo}/issues?q=...&sort=-updated_on` - List issues with filtering
- `GET /repositories/{workspace}/{repo}/pullrequests?q=...&sort=-updated_on` - List pull requests with filtering
- `GET /repositories/{workspace}/{repo}/issues/{issue_id}/comments?q=...&sort=-created_on` - List issue comments with filtering

### Query Language

The integration uses Bitbucket's query language for server-side filtering:

**State Filtering:**
- Issues: `(state = "new" OR state = "open")`
- PRs: `state = "OPEN"`

**Incremental Sync:**
- `updated_on > 2024-01-01T00:00:00.000Z`
- `created_on > 2024-01-01T00:00:00.000Z`

**Combined Filters:**
- `(state = "new" OR state = "open") AND updated_on > 2024-01-01T00:00:00.000Z`

## Incremental Sync

The integration supports incremental syncing based on:
- **Tickets**: `updated_on` timestamp
- **Comments**: `created_on` timestamp

Bitbucket API filters data on the server, so only items updated/created after the last sync are fetched and transferred over the network. This makes incremental syncs extremely efficient.

## Limitations

- **Email Privacy**: User emails are not available via Bitbucket API
- **Rate Limits**: Subject to Bitbucket API rate limits
- **Pagination**: Fetches up to 50 items per page

## Usage Example

```typescript
// Get the sync integration
const syncIntegration = await Integration.get(context, syncIntegrationId);

// Get the auth integration
const authIntegration = await Integration.get(
  context,
  syncIntegration.getConfig().authIntegrationId
);

// Authenticate
const authWrapper = await authIntegration.getIntegrationWrapper();
const auth = await authWrapper.authenticate(); // Returns axios instance

// Get sync wrapper
const syncWrapper = await syncIntegration.getIntegrationWrapper();

// Fetch data
const stream = await syncWrapper.fetchData(auth, {
  targetTables: [
    TARGET_TABLES.TICKETING_TICKET,
    TARGET_TABLES.TICKETING_USER,
    TARGET_TABLES.TICKETING_COMMENT,
  ],
});

// Process stream
for await (const record of stream) {
  console.log(record);
}
```

## Bitbucket API Documentation

- [Bitbucket Cloud REST API](https://developer.atlassian.com/cloud/bitbucket/rest/intro/)
- [Issues API](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-issue-tracker/)
- [Pull Requests API](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/)
- [Repositories API](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-repositories/)

## Error Handling

The integration includes comprehensive error handling:
- Repository-level error isolation (one repo failure doesn't stop others)
- Graceful pagination handling
- Detailed logging for debugging
- Stream error propagation
