# NocoDB v3 Webhook API Specification

## Overview

This document provides the complete API specification for NocoDB v3 Webhook APIs, based on the existing v2 webhook functionality and following v3 API patterns.

## Base URL Pattern

All webhook API endpoints follow the v3 pattern:
```
/api/v3/meta/bases/{baseId}
```

## Authentication

All endpoints require authentication via API token or JWT token as per standard NocoDB authentication.

## Endpoints

### 1. List Webhooks

**GET** `/api/v3/meta/bases/{baseId}/tables/{tableId}/hooks`

List all webhooks for a specific table.

**Parameters:**
- `baseId` (path, required): The base ID
- `tableId` (path, required): The table ID

**Response:**
```json
{
  "list": [
    {
      "id": "hk_abc123",
      "title": "My Webhook",
      "description": "Webhook description",
      "event": ["after"],
      "operation": ["insert", "update"],
      "async": false,
      "retries": 10,
      "retry_interval": 60000,
      "timeout": 60000,
      "active": true,
      "notification": {
        "type": "URL",
        "payload": {
          "method": "POST",
          "body": "{{ json data }}",
          "headers": [{}],
          "parameters": [{}],
          "auth": "",
          "path": "https://webhook.site/example"
        }
      },
      "condition": false,
      "version": "v2",
      "fk_model_id": "md_table123",
      "created_at": "2025-01-16T06:04:18.000Z",
      "updated_at": "2025-01-16T06:04:18.000Z"
    }
  ],
  "pageInfo": {
    "totalRows": 1,
    "page": 1,
    "pageSize": 25,
    "isFirstPage": true,
    "isLastPage": true
  }
}
```

### 2. Create Webhook

**POST** `/api/v3/meta/bases/{baseId}/tables/{tableId}/hooks`

Create a new webhook for a specific table.

**Parameters:**
- `baseId` (path, required): The base ID  
- `tableId` (path, required): The table ID

**Request Body:**
```json
{
  "title": "My Webhook",
  "description": "Webhook description", 
  "event": ["after"],
  "operation": ["insert", "update"],
  "async": false,
  "retries": 10,
  "retry_interval": 60000,
  "timeout": 60000,
  "active": true,
  "notification": {
    "type": "URL",
    "payload": {
      "method": "POST",
      "body": "{{ json data }}",
      "headers": [{}],
      "parameters": [{}],
      "auth": "",
      "path": "https://webhook.site/example"
    }
  },
  "condition": false,
  "version": "v2"
}
```

**Response:**
Returns the created webhook object with generated ID and timestamps.

### 3. Update Webhook

**PATCH** `/api/v3/meta/bases/{baseId}/hooks/{hookId}`

Update an existing webhook.

**Parameters:**
- `baseId` (path, required): The base ID
- `hookId` (path, required): The webhook ID

**Request Body:**
Same as create webhook, with only fields to be updated.

**Response:**
Returns the updated webhook object.

### 4. Delete Webhook

**DELETE** `/api/v3/meta/bases/{baseId}/hooks/{hookId}`

Delete a webhook.

**Parameters:**
- `baseId` (path, required): The base ID
- `hookId` (path, required): The webhook ID

**Response:**
```json
{
  "msg": "Hook deleted successfully"
}
```

### 5. Test Webhook

**POST** `/api/v3/meta/bases/{baseId}/tables/{tableId}/hooks/test`

Test a webhook configuration.

**Parameters:**
- `baseId` (path, required): The base ID
- `tableId` (path, required): The table ID

**Request Body:**
```json
{
  "title": "Test Hook",
  "event": ["after"], 
  "operation": ["insert"],
  "notification": {
    "type": "URL",
    "payload": {
      "method": "POST",
      "body": "{{ json data }}",
      "headers": [{}],
      "parameters": [{}],
      "auth": "",
      "path": "https://webhook.site/test"
    }
  },
  "payload": {
    "data": {
      "id": "rec123",
      "name": "Test Record"
    },
    "user": {
      "id": "user123",
      "email": "user@example.com"
    }
  }
}
```

**Response:**
```json
{
  "msg": "The hook has been tested successfully"
}
```

### 6. Get Sample Payload

**GET** `/api/v3/meta/bases/{baseId}/tables/{tableId}/hooks/samplePayload/{event}/{operation}/{version}`

Get a sample payload for webhook configuration.

**Parameters:**
- `baseId` (path, required): The base ID
- `tableId` (path, required): The table ID
- `event` (path, required): Event type ("before" or "after")
- `operation` (path, required): Operation type ("insert", "update", "delete", "bulkInsert", "bulkUpdate", "bulkDelete")
- `version` (path, required): Webhook version ("v1" or "v2")
- `includeUser` (query, optional): Include user information in payload ("true" or "false")

**Response:**
```json
{
  "type": "records.after.insert",
  "id": "abc123",
  "data": {
    "table_id": "md_table123",
    "table_name": "Users",
    "view_id": "vw_view123", 
    "view_name": "Grid View"
  },
  "user": {
    "id": "user123",
    "email": "user@example.com"
  }
}
```

### 7. Get Webhook Logs

**GET** `/api/v3/meta/bases/{baseId}/hooks/{hookId}/logs`

Retrieve execution logs for a webhook.

**Parameters:**
- `baseId` (path, required): The base ID  
- `hookId` (path, required): The webhook ID
- Standard pagination parameters (page, pageSize, etc.)

**Response:**
```json
{
  "list": [
    {
      "id": "log123",
      "fk_hook_id": "hk_abc123",
      "type": "URL",
      "payload": "{\"method\":\"POST\",\"body\":\"data\",\"path\":\"https://webhook.site/example\"}",
      "response": "{\"status\":200,\"statusText\":\"OK\"}",
      "triggered_by": "user123",
      "test_call": false,
      "execution_time": 1250,
      "created_at": "2025-01-16T06:04:18.000Z",
      "updated_at": "2025-01-16T06:04:18.000Z"
    }
  ],
  "pageInfo": {
    "totalRows": 1,
    "page": 1, 
    "pageSize": 25,
    "isFirstPage": true,
    "isLastPage": true
  }
}
```

### 8. Trigger Webhook

**POST** `/api/v3/meta/bases/{baseId}/hooks/{hookId}/trigger/{rowId}`

Manually trigger a webhook for a specific row.

**Parameters:**
- `baseId` (path, required): The base ID
- `hookId` (path, required): The webhook ID
- `rowId` (path, required): The row ID to trigger webhook for

**Response:**
```json
{
  "msg": "Hook triggered successfully"
}
```

## Error Responses

All endpoints return standard HTTP error codes with descriptive messages:

- `400 Bad Request`: Invalid request parameters or body
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error response format:
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

## Webhook Event Types

- **event**: `["before", "after"]`
- **operation**: `["insert", "update", "delete", "bulkInsert", "bulkUpdate", "bulkDelete"]`

## Notification Types

Currently supported:
- `URL`: HTTP webhook
- `Email`: Email notification (if configured)
- `Slack`: Slack integration (if configured)
- `Discord`: Discord integration (if configured)
- `Teams`: Microsoft Teams integration (if configured)
- `Mattermost`: Mattermost integration (if configured)

## Implementation Notes

1. **Backward Compatibility**: v3 API maintains full compatibility with existing v2 webhook functionality
2. **Service Layer**: Uses existing HooksService from v2 implementation
3. **Authentication**: Follows standard v3 authentication patterns
4. **URL Pattern**: Consistent with v3 `/api/v3/meta/bases/{baseId}` pattern
5. **Response Format**: Follows v3 response patterns with proper pagination
6. **Error Handling**: Uses v3 error handling patterns

## Migration from v2 to v3

### URL Changes
```
v2: /api/v2/meta/tables/{tableId}/hooks
v3: /api/v3/meta/bases/{baseId}/tables/{tableId}/hooks

v2: /api/v2/meta/hooks/{hookId}  
v3: /api/v3/meta/bases/{baseId}/hooks/{hookId}
```

### Key Differences
1. **Base ID Required**: All v3 endpoints require baseId in the path
2. **Consistent URL Pattern**: All endpoints follow the v3 pattern
3. **Enhanced Response Format**: Better structured responses with improved metadata
4. **Future Extensibility**: Designed to support future webhook enhancements

This specification provides a complete v3 webhook API that maintains compatibility with existing functionality while following v3 patterns and enabling future automation capabilities.