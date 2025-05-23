# NocoDB Integrations TODO

This file tracks the integration status for popular ticketing and project management systems.

# Rules

Before checking a box run `pnpm run install && pnpm run build` on root to ensure the integration is properly compiling and all `pnpm fix` issues are resolved.
Avoid using `any` as much as possible. Try to use the derived types from libraries used in the integration.

# Tasks

- [x] List steps to implement all ai integrations (we only have openai for now)
  1. [x] Implement Google AI (Gemini) integration
  2. [x] Implement Anthropic (Claude) integration
  3. [x] Implement OpenAI integration
  4. [x] Implement Groq integration
  5. [x] Implement Amazon Bedrock integration
  6. [x] Implement Azure integration
  7. [x] Implement Deepseek integration
  8. [x] Implement OpenAI Compatible integration

## Notes
- Each integration should follow the structure defined in the monorepo guide
- Start each integration from version 0.1.0 