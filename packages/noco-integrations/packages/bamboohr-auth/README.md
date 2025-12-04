## BambooHR Auth Integration

Authentication integration for BambooHR API in NocoDB.

## Features

- **API Key Authentication**: Simple API key based authentication using BambooHR API key
- **Domain Configuration**: Support for custom BambooHR subdomain per workspace
- **API Client**: Built-in HTTP client for BambooHR REST API
- **Secure Storage**: API keys are stored securely via NocoDB integrations framework

## Authentication Method

### API Key

BambooHR uses API key based authentication:

1. Log in to your BambooHR account
2. Go to `Profile` → `API Keys`
3. Create a new API key for NocoDB
4. Copy the generated API key
5. Configure the BambooHR Auth integration in NocoDB with:
   - Your BambooHR subdomain (e.g. `yourcompany` for `https://yourcompany.bamboohr.com`)
   - The API key you generated

## Configuration

### Environment Variables

You can configure default values via environment variables (all optional, can be overridden per connection):

```bash
INTEGRATION_AUTH_BAMBOOHR_SUBDOMAIN=yourcompany
INTEGRATION_AUTH_BAMBOOHR_API_KEY=your_api_key
```

## API Client Usage

The integration returns a pre-configured HTTP client for the BambooHR API (using `axios` under the hood):

```typescript
const client = await integration.authenticate();

// Get current employee directory
const { data: employees } = await client.get('/employees/directory');

// Get details for a specific employee
const { data: employee } = await client.get('/employees/123');

// List time off requests
const { data: timeOff } = await client.get('/time_off/requests');

// The client is pre-configured with:
// - Base URL: https://{subdomain}.bamboohr.com/api/gateway.php
// - Authorization header using BambooHR API key
// - JSON handling for request/response where applicable
```

## BambooHR API Documentation

- `https://documentation.bamboohr.com/reference`

## Error Handling

The integration surfaces meaningful error messages for:
- Invalid or missing API key
- Incorrect BambooHR subdomain
- Permission errors for specific API endpoints
- Network or API request failures

## Security

- API keys are never exposed to the frontend
- Credentials are stored and managed by NocoDB's secure integrations framework
- All requests to BambooHR are made over HTTPS
