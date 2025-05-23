# NocoDB Integrations

This monorepo contains the integration framework and various integrations for NocoDB.

## Structure

```
nocodb-integrations/
├── core/                      # Core integration framework
├── packages/
│   ├── auth-github/           # GitHub auth integration
│   ├── ai-openai/             # OpenAI integration
│   └── ...                    # Other integrations
```

## Development

### Prerequisites

- Node.js >= 22
- pnpm >= 9

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Testing

The repository includes a comprehensive testing setup:

```bash
# Run tests for all packages
pnpm test

# Run tests with coverage for all packages
pnpm test:coverage

# Run tests for a specific package
pnpm --filter @noco-integrations/openai-ai test
```

Each integration package contains its own tests in a `tests/` directory. All tests use Vitest as the testing framework.

## Creating a New Integration

Alternatively, you can create a new package manually:

1. Create a new package in the `packages` directory
2. Follow the integration package structure:
   ```
  provider-type/
   ├── src/
   │   ├── index.ts             # Main entry point
   │   ├── manifest.ts          # Integration metadata
   │   ├── form.ts              # Configuration form
   │   └── integration.ts       # Integration implementation
   ├── tests/                   # Tests for the integration
   ├── package.json
   ├── tsconfig.json
   └── README.md
   ```

3. Implement the required interfaces from `@noco-integrations/core`
4. Add tests for your integration

## Sync Integration Standardization Guidelines

This document outlines the standards and best practices for creating and maintaining sync integrations in the NocoDB integrations monorepo.

### Structure

Every sync integration should follow this structure:

```
packages/[provider]-sync/
├── package.json          # Dependencies and metadata
├── tsconfig.json         # TypeScript configuration
└── src/
    ├── index.ts          # Integration entry point
    ├── integration.ts    # Implementation class
    ├── form.ts           # Configuration UI definition
    └── manifest.ts       # Integration metadata
```

### Implementation Standards

1. **Class Structure**
   - Extend the `SyncIntegration` abstract class
   - Implement all required methods:
     - `getDestinationSchema()`
     - `fetchData()`
     - `formatData()`
     - `getIncrementalKey()`

2. **Error Handling**
   - Use try/catch blocks for all API calls
   - Log errors with descriptive messages
   - Include provider-specific error codes where possible

3. **Pagination**
   - Implement proper pagination for all API endpoints
   - Use provider-specific pagination mechanisms

4. **Data Mapping**
   - Follow consistent patterns when mapping provider data to NocoDB schema
   - Use helper methods for complex mappings

5. **Authentication**
   - Use auth integrations correctly
   - Handle token refresh when needed

### Code Style

1. **Naming Conventions**
   - Class name: `[Provider]SyncIntegration`
   - File names: lowercase with hyphens
   - Config interface: `[Provider]SyncPayload`

2. **Logging**
   - Use the built-in `this.log()` method
   - Format log messages as `[Provider Sync] Message`

3. **Comments**
   - Document complex logic or workarounds

### Configuration Form

1. **Required Fields**
   - Authentication integration selection
   - Provider-specific identifiers (repo, project, etc.)

2. **Optional Fields**
   - Data filtering options (e.g., include closed items)
   - Sync frequency settings

### Testing

1. **Manual Testing**
   - Test with real provider accounts
   - Verify incremental sync works correctly

2. **Automated Testing**
   - Create unit tests for data mapping functions
   - Use mocks for API responses
