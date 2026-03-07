# Responsive UI Verification Checklist

Breakpoints: `xs` (<480), `sm` (480+), `md` (820+), `lg` (1024+), `xl` (1280+)

Test each item on: **Mobile (xs)**, **Tablet (sm/md)**, **Desktop (lg+)**

---

## Completed Fixes (This Branch)

### Infrastructure

- [x] **Breakpoint constants** — `NC_BREAKPOINTS` + `NC_SCREEN_BREAKPOINTS` in `lib/constants.ts`, shared by WindiCSS and JS
- [x] **`activeBreakpoint` reactive state** — added to `useGlobal()` via `useConfigStore`, exposes current breakpoint (`xs`|`sm`|`md`|`lg`|`xl`|...)
- [x] **Body CSS classes** — `.mobile`, `.tablet`, `.desktop` auto-applied by `useConfigStore`
- [x] **WindiCSS screens** — configured from `NC_SCREEN_BREAKPOINTS` in `windi.config.ts`

### Form Builder System

- [x] **Form builder responsive span** — `FormBuilderResponsiveSpan` type `[mobile, tablet?, desktop?]` in SDK, resolver in `nc-gui/components/nc/form-builder/index.vue`
- [x] **Form builder `span: 0` = hidden** — fields with `span: 0` at current breakpoint are not rendered
- [x] **Ant Design vertical form override** — `@media (max-width: 575px)` override in `theme-overrides.scss` (both CE and EE) to prevent horizontal form layout
- [x] **All noco-integrations forms** — `span: 12` -> `span: [24, 12]` across 25+ integration packages and templates
- [x] **Account setup Config** — `span: 12` -> `span: [24, 12]`
- [x] **ManagedApp create form** — uses responsive spans `[24, 12]`, `[0, 12]`

### Modal System

- [x] **NcModal mobile variants** — `modalSizes` in `commonUtils.ts` supports `mobile` property with different width/height
- [x] **NcModal resolver** — `resolvedModalSize` computed in `Modal.vue` picks mobile variant when `isMobileMode`
- [x] **NcModal padding** — responsive `p-4 md:p-6` on modal content, `text-base md:text-lg` on header

### Workspace & Base List

- [x] **BasesHeader truncation** — workspace name truncation with `min-w-0` + `truncate` on flex child
- [x] **EE BaseListModal** — "Bases in" label `flex-shrink-0`, workspace name `truncate`
- [x] **BaseListModal** — uses `lg` modal size with mobile variant

### App Market

- [x] **App market list item** — install button inline with meta on mobile (`md:hidden`), standalone on desktop (`hidden md:block`)
- [x] **App market category select** — responsive width `xs:max-w-30 md:w-48`
- [x] **App market padding** — responsive padding on header, filters, list area

### Expanded Form

- [x] **Delete action hidden for new records** — `!isNew.value` in `deleteRecord` visibility
- [x] **Synced table delete gated** — `v-if="visibleMoreOptions.deleteRecord && meta?.synced"`
- [x] **Divider auto-derived** — `showDeleteDivider` computed from `Object.entries(result).some(...)`, no manual item tracking
- [x] **showMoreOptionsMenu** — uses `hasItemsAboveDelete || result.deleteRecord`

### Other Fixes

- [x] **Dark mode menu** — templates page mobile view fix
- [x] **DeleteModal, GeneralModal** — responsive layout fixes
- [x] **QuickImport, ImportModal** — responsive layout
- [x] **OAuthClient RegenerateSecret** — responsive layout
- [x] **MigrateToV3** — responsive layout
- [x] **RenameFile attachment** — responsive layout
- [x] **UserInfo sidebar** — responsive layout
- [x] **EE Account Delete** — responsive layout
- [x] **EE WorkspaceSelector** — responsive layout
- [x] **CreateProjectBtn** — responsive layout (CE + EE)

---

## Remaining Work

### 1. GRID VIEW (High Priority)

- [ ] **Grid canvas** — horizontal scroll, frozen first column, cell sizing
- [ ] **Column headers** — text truncation, resize handles, menu positioning
- [ ] **Row height** — touch-friendly row heights on mobile
- [ ] **Cell editing** — inline editors fit within cell bounds
- [ ] **Pagination** — page controls layout, compact mode on mobile
- [ ] **Aggregation row** — summary row fits without overflow
- [ ] **Group by** — group headers collapse/expand, nested indentation
- [ ] **Bulk actions bar** — selection count + actions fit on mobile
- [ ] **New row** — add row button/input accessible on all sizes
- [ ] **Context menu** — right-click menu positioning near edges

### 2. SMARTSHEET TOOLBAR (High Priority)

- [ ] **Toolbar overflow** — buttons wrap or collapse to icons on mobile
- [ ] **Fields menu** — column visibility toggle panel sizing
- [ ] **Filter menu** — filter builder layout, nested conditions
- [ ] **Sort menu** — sort list stacking
- [ ] **Group by menu** — group config panel
- [ ] **Search bar** — search input width and expand/collapse
- [ ] **Export dropdown** — menu positioning
- [ ] **Row height selector** — dropdown positioning
- [ ] **View action menu** — lock, duplicate, delete actions
- [ ] **Calendar toolbar** — mode selector, date navigation, today button
- [ ] **Pinned filters** — filter pills wrapping

### 3. SIDEBAR NAVIGATION (High Priority)

- [ ] **Sidebar collapse** — full sidebar vs mini sidebar vs hidden on mobile
- [ ] **Mini sidebar rail** — icon-only rail on tablet
- [ ] **Tree view** — project/table/view hierarchy indentation
- [ ] **Tree view scroll** — long lists scrolling within sidebar
- [ ] **Project node** — action menu, create new menu positioning
- [ ] **View list** — view icons + labels truncation
- [ ] **Search input** — sidebar search visibility and sizing
- [ ] **Create view button** — accessible on all breakpoints
- [ ] **Sidebar header** — workspace switcher, user info
- [ ] **Sidebar footer** — help, theme, version links

### 4. EXPANDED FORM / RECORD VIEW (High Priority)

- [x] **More options menu** — delete hidden for new records, synced gating, auto-derived divider
- [ ] **Form layout** — single column on mobile, multi-column on desktop
- [ ] **Right sidebar** — comments/audit as bottom sheet on mobile vs right panel
- [ ] **Field labels** — label above input on mobile, inline on desktop
- [ ] **Attachment fields** — thumbnail grid sizing
- [ ] **Link fields** — linked record list/modal sizing
- [ ] **Long text fields** — textarea height on mobile
- [ ] **Header** — record title, navigation arrows, close button
- [ ] **Footer** — save/cancel buttons layout
- [ ] **Detached mode** — modal sizing on different screens
- [ ] **Tab navigation** — Fields, Attachments, Discussion tabs

### 5. FORM VIEW (High Priority)

- [ ] **Form layout** — field stacking on mobile
- [ ] **Cover image** — responsive image sizing
- [ ] **Field drag/drop** — reorder on touch devices
- [ ] **Field settings panel** — right sidebar vs bottom sheet
- [ ] **Submit button** — full width on mobile
- [ ] **Multi-page form** — page navigation controls
- [ ] **Survey mode** — full-screen question layout
- [ ] **Shared form** — public form on mobile browsers

### 6. TOPBAR (High Priority)

- [ ] **Breadcrumb** — project > table > view truncation on mobile
- [ ] **Collaborator presence** — avatar overflow, "+N more"
- [ ] **Share button** — icon-only on mobile
- [ ] **Command palette trigger** — Cmd+K button sizing
- [ ] **View selector dropdown** — dropdown width on mobile
- [ ] **Table selector dropdown** — dropdown width on mobile
- [ ] **Editing state indicator** — compact display on mobile
- [ ] **Workflow/Script indicators** — collapse on mobile

### 7. WORKSPACE & BASE LIST (Medium Priority)

- [x] **Base list modal** — modal sizing with mobile variant
- [x] **BasesHeader** — workspace name truncation
- [x] **App market** — list item layout, install button inline on mobile
- [ ] **Base cards** — grid to list layout on mobile
- [ ] **Search + filter bar** — input widths, filter dropdown
- [ ] **Workspace switcher** — dropdown sizing on mobile
- [ ] **Create project dialog** — form layout on mobile
- [ ] **AI create project** — left/right pane stacking on mobile
- [ ] **Base node** — star, menu, meta info truncation

### 8. DIALOGS & MODALS (Medium Priority)

- [x] **NcModal sizes** — mobile variant support for md/lg/xl
- [x] **NcModal padding** — responsive p-4/p-6
- [ ] **Create table** — form fields stacking
- [ ] **Share dialog** — share link, permissions layout
- [ ] **Import dialog** — file upload area, progress display
- [ ] **Delete confirmations** — button layout in footer
- [ ] **Invite dialog** — email input, role selector
- [ ] **Keyboard shortcuts** — shortcut list scrolling
- [ ] **ERD dialog** — diagram zoom and pan on mobile
- [ ] **Bulk update** — field selection, value inputs
- [ ] **Quick import** — CSV/JSON upload area

### 9. CALENDAR VIEW (Medium Priority)

- [ ] **Month view** — day cells sizing, event cards
- [ ] **Week view** — time slots, day columns width
- [ ] **Day view** — full day layout, time slots
- [ ] **Year view** — month grid layout
- [ ] **Side panel** — record list sidebar vs bottom sheet
- [ ] **Record cards** — card content truncation
- [ ] **Date navigation** — prev/next/today buttons
- [ ] **Mode selector** — month/week/day toggle

### 10. GALLERY VIEW (Medium Priority)

- [ ] **Card grid** — columns: 1 on mobile, 2-3 on tablet, 4+ on desktop
- [ ] **Card sizing** — image aspect ratio, content truncation
- [ ] **Cover image** — responsive image display
- [ ] **Card fields** — field values layout within card
- [ ] **Toolbar** — cover field selector, row height

### 11. KANBAN VIEW (Medium Priority)

- [ ] **Stack columns** — horizontal scroll, single stack on mobile
- [ ] **Stack width** — min/max width per breakpoint
- [ ] **Card sizing** — content truncation within cards
- [ ] **Add/edit stack** — modal/inline form
- [ ] **Drag and drop** — touch-friendly card dragging
- [ ] **Uncategorized stack** — collapse/expand

### 12. COLUMN CONFIGURATION (Medium Priority)

- [ ] **Field type selector** — icon grid layout
- [ ] **Field options panel** — stacking within modal
- [ ] **Formula editor** — code input sizing
- [ ] **Link field config** — table/field selectors
- [ ] **Select options** — option list management
- [ ] **Default value config** — input sizing
- [ ] **Advanced options** — collapsible sections
- [ ] **Field permissions** — role matrix layout

### 13. SHARED VIEWS (Medium Priority)

- [ ] **Shared grid** — same as grid view concerns
- [ ] **Shared form** — mobile-optimized form layout
- [ ] **Shared gallery** — card grid responsiveness
- [ ] **Shared calendar** — calendar views on mobile
- [ ] **Password protection** — password input modal
- [ ] **Shared view topbar** — branding, export button
- [ ] **Shared kanban** — stack scrolling

### 14. AUTH PAGES (Medium Priority)

- [ ] **Sign in** — form centering, input widths, logo sizing
- [ ] **Sign up** — registration form layout
- [ ] **Forgot password** — single input form
- [ ] **Reset password** — form layout
- [ ] **OAuth authorize** — authorization prompt layout
- [ ] **SSO login** — provider buttons layout

### 15. ACCOUNT & SETTINGS (Lower Priority)

- [ ] **Profile page** — avatar upload, form fields
- [ ] **API tokens** — token list table
- [ ] **User management** — user list table, invite form
- [ ] **Authentication settings** — SSO config panels
- [ ] **License page** — license info display
- [ ] **Setup wizard** — step-by-step layout
- [ ] **Base settings** — data sources, access, visibility tabs
- [ ] **Data source config** — connection form fields

### 16. DESIGN SYSTEM COMPONENTS (Lower Priority)

- [ ] **NcButton** — touch target sizes (min 44x44px)
- [ ] **NcDropdown** — edge positioning on mobile
- [ ] **NcSelect** — dropdown width and positioning
- [ ] **NcTooltip** — touch-friendly tooltip display
- [ ] **NcTabs** — tab overflow/scroll on mobile
- [ ] **NcTable** — horizontal scroll for data tables
- [ ] **NcPagination** — compact mode on mobile
- [ ] **NcMenu** — submenu positioning
- [ ] **NcDatePicker** — calendar popup sizing

### 17. TIMELINE / MAP / LIST VIEWS (Lower Priority)

- [ ] **Timeline grid** — time axis scrolling
- [ ] **Timeline grouping** — group header layout
- [ ] **Map view** — map container sizing
- [ ] **Map markers** — marker interaction on touch
- [ ] **List/Tree view** — hierarchy indentation, node layout

### 18. AI & EXTENSIONS (Lower Priority)

- [ ] **AI base builder** — left/right pane layout
- [ ] **AI suggestion panels** — response content sizing
- [ ] **Extension panels** — panel width and stacking
- [ ] **Extension fullscreen** — viewport calculations

### 19. COMMAND PALETTES & SEARCH (Lower Priority)

- [ ] **Cmd+K palette** — modal width on mobile
- [ ] **Search results** — result item layout
- [ ] **Recent items** — list scrolling
- [ ] **Category navigation** — category tabs/pills

### 20. FEED & NOTIFICATIONS (Lower Priority)

- [ ] **Activity feed** — feed item cards
- [ ] **Feed sidebar** — width on different breakpoints
- [ ] **Notification list** — notification item layout

---

## Cross-Cutting Concerns

- [ ] **Touch targets** — all interactive elements min 44x44px on mobile
- [ ] **Text truncation** — long text uses `truncate` or `line-clamp` appropriately
- [ ] **Scroll containers** — `nc-scrollbar-thin` on scrollable areas
- [ ] **Viewport height** — use `nc-h-screen` instead of `h-screen`
- [ ] **Modal stacking** — nested modals don't overflow viewport
- [ ] **Keyboard on mobile** — inputs don't get hidden behind virtual keyboard
- [ ] **Orientation** — landscape mode on tablet/mobile doesn't break layouts
- [ ] **Dark mode** — responsive changes work in both light and dark themes
- [ ] **RTL** — responsive layouts work with RTL text direction
