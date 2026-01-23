# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation

For comprehensive product documentation, features, and API references: https://nocodb.com/llms.txt

## Project Overview

NocoDB is an open-source Airtable alternative that turns any database into a smart spreadsheet. This is the enterprise edition (EE) monorepo.

Key capabilities:
- Transforms MySQL, PostgreSQL, SQL Server, SQLite & MariaDB into collaborative spreadsheets
- Rich field types: text, numerical, date-time, relational (Links), formula-based
- Multiple views: Grid, Form, Calendar, Kanban, Gallery, Map
- Auto-generated REST APIs
- Automation: workflows, webhooks, scripts
- NocoAI for AI capabilities, NocoSync for external data integration
- MCP (Model Context Protocol) server support

## Monorepo Structure

- **packages/nocodb** - Backend (NestJS + TypeScript)
- **packages/nc-gui** - Frontend (Nuxt 3 + Vue 3)
- **packages/nocodb-sdk** - JavaScript/TypeScript SDK
- **packages/nocodb-sdk-v2** - V2 SDK
- **packages/nc-sql-executor** - SQL execution service
- **packages/noco-integrations** - Integration plugins (Slack, Discord, AWS, etc.)
- **packages/nc-knex-dialects** - Custom Knex dialects (Snowflake, Databricks)
- **tests/playwright** - E2E testing suite

## Essential Commands

```bash
# Installation (pnpm is enforced - npm/yarn will fail)
pnpm bootstrap          # Full EE bootstrap
pnpm bootstrap:ce       # Community Edition bootstrap

# Development
pnpm start:backend      # Backend at http://localhost:8080
pnpm start:frontend     # Frontend at http://localhost:3000
pnpm start:sql-executor # SQL executor service

# Database containers for testing
pnpm start:pg           # Start PostgreSQL
pnpm stop:pg
pnpm start:mysql        # Start MySQL
pnpm stop:mysql

# E2E Testing
pnpm start:playwright:pg        # Backend + Frontend for E2E (PostgreSQL)
pnpm start:playwright:pg:ee     # Enterprise Edition E2E
```

### Backend (packages/nocodb)

```bash
pnpm start              # Dev mode with watch
pnpm watch:run:ee       # EE dev build
pnpm build:ee           # Production EE build
pnpm lint               # ESLint
pnpm test:unit          # Mocha unit tests
pnpm test:unit:pg:ee    # Unit tests with PostgreSQL + EE
```

### Frontend (packages/nc-gui)

```bash
pnpm dev                # Nuxt dev server
pnpm dev:ee             # EE frontend dev
pnpm build:ee           # Production EE build
pnpm lint               # ESLint
pnpm test               # Vitest unit tests
```

## Architecture

### Backend (NestJS)

- **src/controllers/** - REST API controllers (~98 controllers)
- **src/models/** - Data models (Base, Model, View, Column, User, Integration, etc.)
- **src/services/** - Business logic
- **src/db/** - Database layer with BaseModelSqlv2, CustomKnex, formula evaluation
- **src/ee/, src/ee-on-prem/, src/ee-cloud/** - Enterprise Edition code
- **src/run/** - Entry points

### Frontend (Nuxt + Vue)

- **pages/** - Route-based pages
- **components/** - Vue components (~34 directories)
- **composables/** - Vue composables (~95 files)
- **store/** - Pinia stores
- **lang/** - i18n (42+ languages)
- **ee/** - Enterprise Edition features
- Uses hash-based routing (SPA mode)

### Database Model Hierarchy

```
Workspace → Base → Model (Table) → Column
                              → View (Grid, Gallery, Form, Kanban, Calendar, Map)
```

## Key Environment Variables

- `NC_DB` - Database connection string
- `EE=true` - Enable Enterprise Edition
- `NC_AUTH_JWT_SECRET` - JWT secret
- `NC_DISABLE_TELE` - Disable telemetry

## Build Memory Issues

For large builds that run out of memory:
```bash
NODE_OPTIONS="--max-old-space-size=8192" pnpm build:ee
```

## Git Workflow

- **develop** - Main development branch (target for PRs)
- **master** - Stable release snapshots only
- Branch naming: `feat/`, `fix/`, `enhancement/`
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, etc.

## Tech Stack

- **Backend**: NestJS, Knex, Socket.io, Bull (job queue), Redis
- **Frontend**: Nuxt 3, Vue 3, Pinia, WindiCSS, Ant Design Vue
- **Databases**: SQLite (default), PostgreSQL, MySQL, Snowflake, Databricks
- **Build**: Rspack (backend), Vite (frontend)
- **Testing**: Mocha (backend unit), Vitest (frontend unit), Playwright (E2E)
