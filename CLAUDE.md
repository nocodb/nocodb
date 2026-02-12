# NocoDB Enterprise (NocoDB Hub) - Claude Instructions

> **IMPORTANT**: This repository is `nocohub` (NocoDB Enterprise/Hub). This is NOT the open-source `nocodb` repository. All work here is proprietary and should stay within this codebase.

## Quick Start

Before working on any task, read the relevant skill file(s) from `.skills/`:

| Task Type | Read This First |
|-----------|-----------------|
| Backend (API, services, controllers) | `.skills/nocohub-backend/SKILL.md` |
| Frontend (Vue, components, stores) | `.skills/nocohub-frontend/SKILL.md` |
| Multi-package / End-to-end features | `.skills/compound-engineering/SKILL.md` |
| Automations (nodes, workflows) | `.skills/nocohub-automations/SKILL.md` |
| CE/EE sync patterns | `.skills/nocohub-sync/SKILL.md` |
| **New PR / branch setup ("commando")** | **`.skills/commando/SKILL.md`** |

## Repository Structure

```
nocohub/
├── packages/
│   ├── nocodb-sdk/          # TypeScript types + API client
│   ├── nocodb/              # Backend (NestJS)
│   ├── nc-gui/              # Frontend (Vue 3 / Nuxt 3)
│   ├── noco-integrations/   # External integrations
│   └── ...                  # Support packages
├── .skills/                 # Claude skills (READ THESE!)
│   ├── commando/            # PR lifecycle management (say "commando")
│   ├── branches/            # Per-branch working memory (gitignored)
│   ├── nocohub-backend/
│   ├── nocohub-frontend/
│   ├── compound-engineering/
│   ├── nocohub-automations/
│   └── nocohub-sync/
└── tests/playwright/        # E2E tests
```

## Key Rules

### 1. Always Check Skills First

The `.skills/` folder contains battle-tested patterns, workflows, and conventions. Don't reinvent - follow existing patterns.

### 2. Build Order Matters

```
nocodb-sdk → nocodb (backend) → nc-gui (frontend)
```

After SDK changes: rebuild SDK before touching backend/frontend.

### 3. CE/EE Separation

- **EE code** lives in `ee/` subdirectories (mirrors CE structure)
- **EE extends CE** - never the other way around
- CE code must work without EE code present

### 4. Type Safety

- Define types in `nocodb-sdk` first
- Import types from `'nocodb-sdk'` in both backend and frontend
- Never use `any` without justification

## Common Commands

```bash
# Bootstrap
pnpm run bootstrap        # Full EE setup
pnpm run bootstrap:ce     # CE only

# Development
pnpm run start:backend    # Backend on :8080
pnpm run start:frontend   # Frontend on :3000

# Build SDK (after type changes)
cd packages/nocodb-sdk && pnpm run build:ee
```

## Skill Reference Files

Each skill has a `references/` folder with detailed documentation:

- `.skills/nocohub-backend/references/patterns.md` - Backend code patterns
- `.skills/nocohub-backend/references/meta-tables.md` - Database schema reference
- `.skills/nocohub-frontend/references/component-patterns.md` - Vue component patterns
- `.skills/nocohub-frontend/references/composable-patterns.md` - Composable patterns
- `.skills/nocohub-frontend/references/store-patterns.md` - Pinia store patterns
- `.skills/compound-engineering/references/workflows.md` - Cross-package checklists
- `.skills/compound-engineering/references/package-map.md` - Package dependencies

## PR Guidelines

1. **Update skills if you find outdated info** - Skills are living documentation
2. **Follow existing patterns** - Consistency > cleverness
3. **Test across packages** - Changes often have cross-package impact
4. **Include types** - SDK types should match implementation

## What NOT To Do

- Don't commit directly to `main`
- Don't skip SDK rebuild after type changes
- Don't import EE code from CE code
- Don't add CE features to `ee/` directories
- Don't confuse this repo with open-source `nocodb`
