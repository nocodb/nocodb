# NocoDB Integrations TODO

This file tracks the integration status for popular ticketing and project management systems.

# Rules

Before checking a box run `pnpm run install && pnpm run build` on root to ensure the integration is properly compiling and all `pnpm fix` issues are resolved.
Avoid using `any` as much as possible. Try to use the derived types from libraries used in the integration.

## High Priority

### GitHub
- [x] Auth Integration
- [x] Sync Integration
- [x] format<Entity> pattern
  - [x] Implement formatTicket
  - [x] Implement formatUser
  - [x] Implement formatComment
  - [x] Implement formatTeam

### GitLab
- [x] Auth Integration
- [x] Sync Integration
- [x] format<Entity> pattern
  - [x] Implement formatTicket
  - [x] Implement formatUser
  - [x] Implement formatComment
  - [x] Implement formatTeam

### Jira
- [x] Auth Integration
- [x] Sync Integration
- [ ] format<Entity> pattern
  - [ ] Implement formatTicket
  - [ ] Implement formatUser
  - [ ] Implement formatComment
  - [ ] Implement formatTeam

### Linear
- [x] Auth Integration
- [x] Sync Integration
- [ ] format<Entity> pattern
  - [ ] Implement formatTicket
  - [ ] Implement formatUser
  - [ ] Implement formatComment
  - [ ] Implement formatTeam

### Asana
- [x] Auth Integration
- [x] Sync Integration
- [ ] format<Entity> pattern
  - [ ] Implement formatTicket
  - [ ] Implement formatUser
  - [ ] Implement formatComment
  - [ ] Implement formatTeam

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