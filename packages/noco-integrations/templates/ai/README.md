# AI Integration Template

This template provides a starting point for creating AI integrations for NocoDB.

## How to Use This Template

1. Copy this template to create a new AI integration package:
   ```bash
   cp -r templates/ai packages/your-provider-ai
   ```

2. Update the package name in `package.json`:
   ```json
   {
     "name": "@noco-integrations/your-provider-ai",
     "version": "0.1.0",
     "description": "Your Provider AI integration for NocoDB",
     // ...
   }
   ```

3. Rename the integration class in `src/integration.ts`:
   ```typescript
   export class YourProviderAiIntegration extends AiIntegration {
     // ...
   }
   ```

4. Update the import in `src/index.ts`:
   ```typescript
   import { YourProviderAiIntegration } from './integration';
   // ...
   const integration: IntegrationEntry = {
     // ...
     sub_type: 'your-provider',
     wrapper: YourProviderAiIntegration,
     // ...
   };
   ```

5. Implement the required methods in your integration class:
   - `generateObject<T>(args: AiGenerateObjectArgs)`: Generate an object using the AI provider's API
   - `getModelAlias(model: string)`: Get a user-friendly alias for a model ID

6. Update the form configuration in `src/form.ts` to include any provider-specific fields

7. Update the manifest in `src/manifest.ts` with your integration's metadata

## Key Files

- `src/integration.ts`: The main integration implementation
- `src/form.ts`: Form definition for the integration's configuration UI
- `src/manifest.ts`: Metadata about the integration
- `src/index.ts`: Entry point that exports the integration

## Requirements

- Implement the `AiIntegration` abstract class from `@noco-integrations/core`
- Provide all required methods and configurations
- Follow the established pattern for AI integrations

## Building and Testing

```bash
# Build the integration
cd packages/your-provider-ai
pnpm build
```

For more detailed information, refer to the AI integration guide in the documentation. 