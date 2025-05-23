# NocoDB Integrations TODO

This file tracks the integration status for popular ticketing and project management systems.

Before checking a box run `pnpm run install && pnpm run build` to ensure the integration is properly compiling and all `pnpm fix` issues are resolved.

## High Priority

### GitHub
- [x] Auth Integration
- [x] Sync Integration

### GitLab
- [x] Auth Integration
- [x] Sync Integration

### Jira
- [x] Auth Integration
- [ ] Sync Integration

### Linear
- [x] Auth Integration
- [ ] Sync Integration

### Asana
- [ ] Auth Integration
- [ ] Sync Integration

## Medium Priority

### Monday.com
- [ ] Auth Integration
- [ ] Sync Integration

### Trello
- [ ] Auth Integration
- [ ] Sync Integration

### ClickUp
- [ ] Auth Integration
- [ ] Sync Integration

## Lower Priority

### Azure DevOps
- [ ] Auth Integration
- [ ] Sync Integration

### Zendesk
- [ ] Auth Integration
- [ ] Sync Integration

### Freshdesk
- [ ] Auth Integration
- [ ] Sync Integration

### ServiceNow
- [ ] Auth Integration
- [ ] Sync Integration

## Notes
- Auth integrations should be implemented first, followed by sync integrations
- Each integration should follow the structure defined in the monorepo guide
- Start each integration from version 0.1.0 