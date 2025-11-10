# Freshdesk Auth Integration

Authentication integration for Freshdesk API using API Key authentication.

## Features

- **API Key Authentication**: Simple and secure authentication using Freshdesk API keys
- **HTTP Basic Auth**: Uses standard HTTP Basic Authentication (API_KEY:X)
- **Connection Testing**: Validates credentials by fetching agent information
- **Error Handling**: Comprehensive error handling with descriptive messages

## Configuration

### Required Fields

1. **Integration Name**: A friendly name for your integration
2. **Freshdesk Domain**: Your Freshdesk domain (e.g., `yourcompany.freshdesk.com`)
3. **API Key**: Your Freshdesk API key

### Finding Your API Key

1. Log in to your Freshdesk Support Portal
2. Click on your profile picture (top right corner)
3. Go to **Profile Settings**
4. Your API key will be available below the change password section

## Authentication Method

Freshdesk uses HTTP Basic Authentication with the following format:

```
Authorization: Basic base64(API_KEY:X)
```

Where:
- `API_KEY` is your Freshdesk API key
- `X` is a dummy password (any value works, 'X' is used by convention)

## Usage Example

```typescript
import { FreshdeskAuthIntegration } from '@noco-integrations/freshdesk-auth';

const integration = new FreshdeskAuthIntegration({
  domain: 'yourcompany.freshdesk.com',
  api_key: 'your_api_key_here',
});

// Authenticate and get client
const client = await integration.authenticate();

// Use the authenticated axios client
const response = await client.axios.get('/tickets');

// Test connection
const testResult = await integration.testConnection();
console.log(testResult.success); // true if connected
```

## API Reference

### FreshdeskClient

The authenticated client returned by `authenticate()`:

```typescript
interface FreshdeskClient {
  axios: AxiosInstance;  // Authenticated axios instance
  domain: string;        // Freshdesk domain
  apiBaseUrl: string;    // Full API base URL
}
```

### Methods

- `authenticate()`: Creates and returns an authenticated Freshdesk client
- `testConnection()`: Tests the connection and validates credentials
- `destroy()`: Cleans up resources

## Error Handling

The integration handles various error scenarios:

- **401 Unauthorized**: Invalid API key
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Invalid Freshdesk domain
- **Network errors**: Connection issues

## Documentation

- [Freshdesk API Documentation](https://developers.freshdesk.com/api/)
- [Authentication Guide](https://developers.freshdesk.com/api/#authentication)

## License

MIT
