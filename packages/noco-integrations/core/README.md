# NocoDB Integrations Core

This package contains the core interfaces, types, and utilities that all NocoDB integrations depend on.

## Overview

The core package defines:

1. Base integration classes that all integrations extend
2. Type definitions for integration structures
3. Form definitions for integration configuration UI
4. Integration registry mechanisms
5. Utility functions for working with integrations

## Integration Types

The core package defines abstract base classes for the following integration types:

- **AI Integrations**: For integrating AI providers
- **Auth Integrations**: For handling authentication with external services
- **Sync Integrations**: For synchronizing data with external systems

## Usage

Integration packages should import and extend the appropriate abstract classes from this package.

```typescript
import { AiIntegration } from '@noco-integrations/core';

export class MyAiIntegration extends AiIntegration {
  // Implementation...
}
```

## Development

To build the package:

```bash
pnpm build
```

To clean the build artifacts:

```bash
pnpm clean
``` 