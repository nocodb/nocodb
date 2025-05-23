# Auth Integration Template

This template provides a starting point for creating authentication integrations for NocoDB.

## How to Use This Template

1. Copy this template to create a new auth integration package:
   ```bash
   cp -r templates/auth packages/your-service-auth
   ```

2. Update the package name in `package.json`:
   ```json
   {
     "name": "@noco-integrations/your-service-auth",
     "version": "0.1.0",
     "description": "Your Service authentication integration for NocoDB",
     // ...
   }
   ```

3. Install any SDK packages for your service:
   ```bash
   cd packages/your-service-auth
   pnpm add @your-service/sdk
   ```

4. Update the configuration in `src/config.ts`:
   - Set the correct environment variable names
   - Configure the OAuth scopes if applicable
   - Update the OAuth URIs to match your service's endpoints

5. Rename the integration class in `src/integration.ts`:
   ```typescript
   export class YourServiceAuthIntegration extends AuthIntegration {
     // ...
   }
   ```

6. Implement the authentication methods:
   - Update the `authenticate()` method to work with your service's authentication requirements
   - **Import and use your service's SDK client** in the client creation methods
   - Implement the `exchangeToken()` method if your service supports OAuth

7. Update the import in `src/index.ts`:
   ```typescript
   import { YourServiceAuthIntegration } from './integration';
   // ...
   const integration: IntegrationEntry = {
     // ...
     sub_type: 'your-service',
     wrapper: YourServiceAuthIntegration,
     // ...
   };
   ```

8. Update the form configuration in `src/form.ts`:
   - Modify or remove auth types that your service doesn't support
   - Add any service-specific fields
   - Update the OAuth configuration if applicable

9. Update the manifest in `src/manifest.ts` with your integration's metadata:
   - Set the correct title, icon, and description
   - Update the author and website information

## Supported Authentication Types

This template provides implementation examples for the following authentication types:

- **API Key**: Authentication using a simple API key
- **Basic Auth**: Username and password authentication
- **Bearer Token**: Authentication using a bearer token
- **OAuth**: OAuth 2.0 authentication (if configured)
- **Custom**: Custom authentication specific to your service

## Best Practices

### Return SDK Clients, Not Just Tokens

The template is designed to return fully initialized SDK clients rather than just authentication tokens. This is a best practice because:

1. **Encapsulation**: It hides the authentication details from consumers of the integration
2. **Ease of Use**: Consumers get a ready-to-use client with all the service's functionality
3. **Consistency**: Provides a consistent approach across different authentication types

Example:

```typescript
// Instead of returning raw credentials like this:
return {
  custom: {
    token: this.config.token
  }
};

// Return an initialized SDK client:
return {
  custom: new YourServiceSDK({
    apiKey: this.config.token,
    baseUrl: 'https://api.yourservice.com'
  })
};
```

## Requirements

- Implement the `AuthIntegration` abstract class from `@noco-integrations/core`
- Provide the required `authenticate()` method that returns a fully initialized SDK client
- Optionally implement the `exchangeToken()` method for OAuth support

## Building and Testing

```bash
# Build the integration
cd packages/your-service-auth
pnpm build
```

For more detailed information, refer to the Auth integration guide in the documentation. 