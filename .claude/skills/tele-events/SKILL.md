---
name: tele-e-summary
description: Telemetry event catalog — centralized JSON reference for all frontend ($e/v-e) telemetry events. Use when adding new telemetry events, auditing coverage, or looking up event naming conventions.
---

# Telemetry Event Catalog

Centralized JSON catalog of all frontend telemetry events (`$e()` / `v-e`) used in NocoDB.

## Catalog Location

```
packages/nc-gui/tele/events.json
```

Lives alongside `lang/` (i18n) in nc-gui. Categorized by feature area, like `en.json`.

## JSON Structure

```json
{
  "category": {
    "c:feature:action": "Short description of when this fires"
  }
}
```

- `c:` prefix = client/UI interaction (click, toggle, open)
- `a:` prefix = API/action (create, delete, update)
- Format: `prefix:feature:sub-feature:action`

## Adding a new event

1. Look up the category in `tele/events.json`
2. If event exists, use the exact key
3. If new, add it to the JSON under the right category with a description
4. Use in code:
   ```html
   <NcButton v-e="['c:feature:action']">Click</NcButton>
   ```
   ```ts
   const { $e } = useNuxtApp()
   $e('a:feature:action', { optionalData: value })
   ```

## Scanning for missing events

```bash
npx tsx .claude/skills/tele-events/scan.ts          # Human-readable
npx tsx .claude/skills/tele-events/scan.ts --json    # JSON output
```

Reports events in code but missing from catalog, and stale events in catalog not found in code.
