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
