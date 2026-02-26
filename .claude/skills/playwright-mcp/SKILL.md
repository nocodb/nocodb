---
name: playwright-mcp
description: Playwright MCP UI testing patterns and techniques. Reference guide for exploratory frontend testing using browser_snapshot, browser_navigate, browser_click, and other Playwright MCP tools.
---

# Playwright MCP — Frontend Testing Guide

Patterns for using Playwright MCP tools (`mcp__plugin_playwright_playwright__*`) for exploratory UI testing of the NocoDB frontend.

## Core Principles

1. **`browser_snapshot` over `browser_take_screenshot`** — snapshots return a structured accessibility tree with searchable text and element refs for interaction. Screenshots are images you can't programmatically verify.
2. **Navigate by URL, not by clicking** — sidebar icons are collapsed/icon-only and nearly impossible to identify in snapshots. Get entity IDs via API, then `browser_navigate` to `/#/workspace_id/base_id/table_id`.
3. **API for setup, browser for verification** — create test data (users, bases, tables) via `nocodb-dev-api` CLI or curl. Only use the browser for the specific UI interaction under test.
4. **Re-snapshot after every action** — always snapshot after clicks/form fills to verify the result.

## Authentication

```
# Option A: API-only (for backend testing)
npx tsx .claude/skills/nocodb-dev-api/cli.ts signup --email=test@example.com --password=Password123.
npx tsx .claude/skills/nocodb-dev-api/cli.ts signin --email=test@example.com --password=Password123.

# Option B: Browser login (for UI testing)
browser_navigate → http://localhost:3000/#/signin
browser_fill_form → email + password fields
browser_click → submit button
browser_wait_for → dashboard text or sidebar element
```

- NocoDB shows onboarding on first login — click `nc-onboarding-flow-skip-button` to dismiss
- After login, page may redirect through multiple routes — wait for final destination

## Element Interaction

| Tool | Use for |
|------|---------|
| `browser_fill_form` | Multi-field forms (login, signup) — pass all fields at once |
| `browser_type` | Single inputs (search, license key, rename) |
| `browser_click` | Buttons, tabs, menu items — use `ref` from snapshot |
| `browser_press_key` | `Escape` to close modals/menus; `Enter` to submit |
| `browser_select_option` | Dropdowns with `<select>` |

Always use `ref` from the most recent snapshot — refs are stable within a page state but change after navigation or DOM updates.

## Verifying UI State via Snapshot

| What to check | How to find it in snapshot |
|---------------|--------------------------|
| Text presence | Search for the string in the YAML output |
| Modal open | `dialog` element appears in tree |
| Active tab | `[selected]` or `[active]` attribute |
| Toggle on/off | `[checked]` attribute on switches/checkboxes |
| Button disabled | `[disabled]` attribute |
| Element hidden | It simply won't appear in the snapshot |
| Toast message | Snapshot immediately after action — toasts auto-dismiss |

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Snapshot taken before page finished loading | `browser_wait_for` with expected text, or `time: 2` then snapshot |
| Collapsed sidebar — icons have no text | Navigate by URL; use API to get entity IDs |
| Sidebar icon click opens command palette | Those are keyboard shortcut icons (K/L/J) — use URL navigation |
| `browser_wait_for` times out | Element may exist but be hidden — snapshot to diagnose |
| Dropdown closes between snapshot and click | Click using ref from the snapshot where menu is still open |
| Password `!` in curl JSON breaks shell | Avoid `!` in passwords; use `Password123` or `Password123.` |

## Efficient Testing Flow

```
1. Start containers / dev servers
2. Health check: GET /api/v1/health → {"message":"OK"}
3. Create test data via API (nocodb-dev-api CLI or curl)
4. browser_navigate → target page URL
5. browser_wait_for → expected text on page
6. browser_snapshot → verify initial state
7. browser_click / browser_type → perform the interaction
8. browser_snapshot → verify result
```

## Docker Testing

- `--add-host=host.docker.internal:host-gateway` — lets container reach host PG/services
- Health check: poll `GET /api/v1/health` until `{"message":"OK"}`
- Multiple containers on different ports for A/B comparison
- `docker logs <name>` when something doesn't work

## Key `data-testid` Values

| Area | Test IDs |
|------|----------|
| Login | `nc-form-signin__email`, `nc-form-signin__password`, `nc-form-signin__submit` |
| Onboarding | `nc-onboarding-flow-skip-button` |
| Sidebar | `nc-sidebar-userinfo`, `nc-sidebar-create-base-btn`, `nc-sidebar-team-settings-btn`, `nc-sidebar-integrations-btn` |
| Share | `nc-share-base-sub-modal`, `share-custom-url-toggle` |
| License | `nc-license-key-input`, `nc-license-save-btn`, `nc-license-remove-btn` |
| Base creation | `nc-menu-from-scratch`, `docs-create-proj-dlg-create-btn` |
| Settings | `snapshots-tab` |

## When to Use Playwright MCP vs Automated Tests

- **Playwright MCP**: One-off verification, exploratory testing, visual comparison, testing fixes before committing
- **Automated specs** (`tests/playwright/`): Regression testing, CI/CD, repeatable scenarios
- MCP is interactive and good for investigating unknown UI state; specs are deterministic and repeatable
