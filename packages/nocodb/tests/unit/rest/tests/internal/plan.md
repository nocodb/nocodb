# Test Plan: Internal Controller View Operations (UiGet & UiPost)

## Context

The internal controller (`/api/v2/internal/:workspaceId/:baseId`) provides a unified endpoint for UI operations through query parameters. We need comprehensive tests for view-related operations in the UiGet and UiPost modules.

**Why this matters:**
- Internal API is a critical routing layer used by the frontend
- View operations (47 total) need test coverage for reliability
- Current test directory exists but is empty (created recently)
- Tests will validate both GET (read) and POST (write) operations

**Current State:**
- Directory structure exists: `/tests/unit/rest/tests/internal/ui-view/`
- Files are empty (0 bytes) - skeleton structure created but no implementation
- Not yet registered in main test orchestrator

**API Pattern:**
- GET: `/api/v2/internal/:workspaceId/:baseId?operation=viewList`
- POST: `/api/v2/internal/:workspaceId/:baseId?operation=viewUpdate`

## Test File Organization

Tests will be grouped into 8 files based on functionality:

```
/packages/nocodb/tests/unit/rest/tests/internal/
├── index.test.ts                    # Orchestrator (register internal tests)
└── ui-view/
    ├── index.test.ts                # View tests orchestrator
    ├── view-basic.test.ts           # Basic CRUD (list, update, delete)
    ├── view-create-types.test.ts    # Create all view types
    ├── view-columns.test.ts         # Column visibility & configuration
    ├── view-filters.test.ts         # Filter CRUD operations
    ├── view-sorts.test.ts           # Sort CRUD operations
    ├── view-row-colors.test.ts      # Conditional row coloring
    ├── view-sharing.test.ts         # Public view sharing
    └── view-type-updates.test.ts    # Type-specific updates
```

### Rationale for Grouping

1. **view-basic.test.ts** - Foundational operations (GET viewList, POST viewUpdate/viewDelete)
2. **view-create-types.test.ts** - All 6 view type creations (grid, form, gallery, kanban, map, calendar)
3. **view-columns.test.ts** - Column management (GET viewColumnList, POST viewColumnCreate/Update, show/hide all)
4. **view-filters.test.ts** - Filter operations (GET filterList/filterChildrenList, POST filterCreate/Update/Delete)
5. **view-sorts.test.ts** - Sort operations (GET sortList, POST sortCreate/Update/Delete)
6. **view-row-colors.test.ts** - Row coloring (GET viewRowColorInfo, POST add/update/delete conditions)
7. **view-sharing.test.ts** - Share operations (POST shareView/Update/Delete)
8. **view-type-updates.test.ts** - Type-specific updates (gridViewUpdate, formViewUpdate, etc.)

## Implementation Phases

### Phase 1: Test Skeletons & Registration

**Goal:** Create all test file structures and register with the main orchestrator

**Tasks:**
1. Update `/tests/unit/rest/tests/internal/index.test.ts`:
   - Import ui-view test orchestrator
   - Register in test execution

2. Update `/tests/unit/rest/tests/internal/ui-view/index.test.ts`:
   - Import all 8 test files
   - Create describe block structure
   - Call each test function

3. Create all 8 test files with:
   - Import statements (mocha, chai, supertest, init, helpers)
   - Export default function wrapper
   - EE check (`if (!isEE()) return true;`)
   - Main describe block
   - Empty beforeEach/afterEach hooks
   - Describe blocks for each operation (no test implementations yet)

4. Register internal tests in main orchestrator:
   - Update `/tests/unit/rest/index.test.ts`
   - Import internal tests
   - Add to appropriate test set

**Deliverables:**
- 10 files updated/created (2 orchestrators + 8 test files)
- Test structure runs without errors (all tests pending)
- Proper test registration in test sets

**Verification:**
```bash
npm run test:unit -- --grep "Internal API - View Operations"
```
Should show pending tests (no failures).

---

### Phase 2: Implement view-basic.test.ts

**Goal:** Implement foundational view operations tests

**Operations to test:**
- GET viewList (11 tests)
- POST viewUpdate (8 tests)
- POST viewDelete (5 tests)

**Test cases:**

**viewList (GET):**
1. List all views for a table
2. List views with default grid view
3. List views with multiple view types
4. List views returns correct structure (id, title, type, lock_type, etc.)
5. List views for table with no custom views
6. List views includes view ordering
7. List views respects personal view ownership
8. List views filters by view type
9. List views with invalid tableId returns 404
10. List views with invalid baseId returns 404
11. List views without authentication returns 401

**viewUpdate (POST):**
1. Update view title
2. Update view show_system_fields
3. Update view lock_type
4. Update view meta properties
5. Update view with invalid viewId returns 404
6. Update view title to duplicate returns 400
7. Update personal view by non-owner returns 403
8. Cannot change last collaborative grid to personal

**viewDelete (POST):**
1. Delete custom view
2. Delete view cascade deletes filters
3. Delete view cascade deletes sorts
4. Delete view cascade deletes view columns
5. Cannot delete last collaborative grid view

**Setup requirements:**
- Create base with workspace
- Create table with 6 field types (SingleLineText, Number, DateTime, SingleSelect, Checkbox, Attachment)
- Override feature flag: `FEATURE_API_VIEW_V3`
- Get default view from created table

**Assertion patterns:**
- Response status codes (200, 400, 403, 404)
- Response body structure validation
- Verify operations via subsequent GET requests
- Check cascade effects on related entities

**Estimated:** ~24 tests, ~150-200 lines

---

### Phase 3: Implement view-create-types.test.ts

**Goal:** Test creation of all 6 view types

**Operations to test:**
- POST gridViewCreate (5 tests)
- POST formViewCreate (4 tests)
- POST galleryViewCreate (4 tests)
- POST kanbanViewCreate (5 tests)
- POST mapViewCreate (4 tests)
- POST calendarViewCreate (5 tests)
- GET formViewGet (2 tests)
- GET mapViewGet (2 tests)

**Test cases per view type:**

**Grid View:**
1. Create basic grid view
2. Create grid view with groups configuration
3. Create grid view with custom row height
4. Create grid view copying from existing view
5. Verify grid view appears in viewList

**Form View:**
1. Create basic form view
2. Create form view with field configuration
3. Get form view details
4. Verify form view has proper defaults

**Gallery View:**
1. Create basic gallery view
2. Create gallery view with cover_field_id
3. Verify gallery shows cover + 3 columns
4. Create gallery with invalid cover field returns 400

**Kanban View:**
1. Create kanban view with stack_by (SingleSelect field)
2. Create kanban with grouping column
3. Verify kanban shows grouping + cover + 3 columns
4. Create kanban without grouping column returns 400
5. Create kanban with invalid field type returns 400

**Map View:**
1. Create basic map view (requires geo data column)
2. Get map view details
3. Verify geo column always visible
4. Create map without geo column returns 400

**Calendar View:**
1. Create calendar with date range
2. Create calendar with start and end date fields
3. Verify date range configuration
4. Create calendar without date range returns 400
5. Create calendar with invalid date fields returns 400

**Setup additions:**
- Add Geo field for map tests
- Ensure DateTime field exists for calendar tests
- Ensure SingleSelect field exists for kanban tests

**Estimated:** ~31 tests, ~300-350 lines

---

### Phase 4: Implement view-columns.test.ts

**Goal:** Test view column visibility and configuration

**Operations to test:**
- GET viewColumnList (5 tests)
- POST viewColumnCreate (4 tests)
- POST viewColumnUpdate (6 tests)
- POST showAllColumns (3 tests)
- POST hideAllColumns (3 tests)
- POST gridColumnUpdate (4 tests)

**Test cases:**

**viewColumnList:**
1. Get all columns for a view
2. Verify column structure (field_id, show, order, width)
3. List columns for view with hidden columns
4. List columns returns correct order
5. List columns with invalid viewId returns 404

**viewColumnCreate:**
1. Create view column for new field
2. Create view column with visibility settings
3. Create view column with custom order
4. Create duplicate view column returns 400

**viewColumnUpdate:**
1. Update column visibility (show/hide)
2. Update column order
3. Update column width
4. Update multiple properties together
5. Update with invalid viewId returns 404
6. Update with invalid field_id returns 404

**showAllColumns:**
1. Show all hidden columns
2. Verify all columns visible after operation
3. Show all columns for view with all columns already visible

**hideAllColumns:**
1. Hide all non-essential columns
2. Verify display value and system columns remain visible
3. Hide all columns for view with all columns already hidden

**gridColumnUpdate:**
1. Update grid column width
2. Update grid column aggregation
3. Update grid column with invalid columnId returns 404
4. Update grid column maintains view integrity

**Estimated:** ~25 tests, ~200-250 lines

---

### Phase 5: Implement view-filters.test.ts

**Goal:** Test filter operations on views

**Operations to test:**
- GET filterList (5 tests)
- GET filterChildrenList (3 tests)
- POST filterCreate (8 tests)
- POST filterUpdate (5 tests)
- POST filterDelete (4 tests)
- GET linkFilterList (EE - 2 tests)
- POST linkFilterCreate (EE - 2 tests)
- GET widgetFilterList (EE - 2 tests)

**Test cases:**

**filterList:**
1. Get all filters for a view
2. Get filters returns correct structure (fk_column_id, comparison_op, value)
3. Get filters for view with no filters
4. Get filters includes nested filter groups
5. Get filters with invalid viewId returns 404

**filterChildrenList:**
1. Get children of filter group
2. Get children for leaf filter returns empty
3. Get children with invalid filterId returns 404

**filterCreate:**
1. Create simple filter (eq, neq, like)
2. Create filter with comparison operators (gt, lt, gte, lte)
3. Create filter group (and, or)
4. Create nested filter (parent filter group)
5. Create filter on SingleSelect field
6. Create filter on DateTime field
7. Create filter with invalid field_id returns 400
8. Create filter with invalid comparison_op returns 400

**filterUpdate:**
1. Update filter comparison operator
2. Update filter value
3. Update filter logical operator (and/or)
4. Update filter with invalid filterId returns 404
5. Update filter with invalid comparison_op returns 400

**filterDelete:**
1. Delete filter removes from view
2. Delete filter group removes all children
3. Verify data reflects filter changes
4. Delete filter with invalid filterId returns 404

**linkFilterList (EE only):**
1. Get filters on link columns
2. Get link filters with invalid columnId returns 404

**linkFilterCreate (EE only):**
1. Create filter on link column
2. Create link filter with invalid columnId returns 400

**widgetFilterList (EE only):**
1. Get filters on widget
2. Get widget filters with invalid widgetId returns 404

**Estimated:** ~31 tests, ~300-350 lines

---

### Phase 6: Implement view-sorts.test.ts

**Goal:** Test sort operations on views

**Operations to test:**
- GET sortList (4 tests)
- POST sortCreate (6 tests)
- POST sortUpdate (4 tests)
- POST sortDelete (3 tests)

**Test cases:**

**sortList:**
1. Get all sorts for a view
2. Get sorts returns correct structure (fk_column_id, direction, order)
3. Get sorts for view with no sorts
4. Get sorts with invalid viewId returns 404

**sortCreate:**
1. Create ascending sort
2. Create descending sort
3. Create multiple sorts (order matters)
4. Create sort on SingleSelect field
5. Create sort with invalid field_id returns 400
6. Create sort with invalid direction returns 400

**sortUpdate:**
1. Update sort direction
2. Update sort order
3. Update sort with invalid sortId returns 404
4. Update sort with invalid direction returns 400

**sortDelete:**
1. Delete sort removes from view
2. Delete sort reorders remaining sorts
3. Delete sort with invalid sortId returns 404

**Estimated:** ~17 tests, ~150-180 lines

---

### Phase 7: Implement view-row-colors.test.ts

**Goal:** Test conditional row coloring operations

**Operations to test:**
- GET viewRowColorInfo (4 tests)
- POST viewRowColorConditionAdd (5 tests)
- POST viewRowColorConditionUpdate (4 tests)
- POST viewRowColorConditionDelete (3 tests)
- POST viewRowColorSelectAdd (3 tests)
- POST viewRowColorInfoDelete (2 tests)
- POST rowColorConditionsFilterCreate (3 tests)

**Test cases:**

**viewRowColorInfo:**
1. Get row color configuration for view
2. Get row color info with conditions
3. Get row color info with select options
4. Get row color info with invalid viewId returns 404

**viewRowColorConditionAdd:**
1. Add filter-based row color condition
2. Add row color with specific color
3. Add multiple row color conditions
4. Add row color with invalid viewId returns 404
5. Add row color with invalid filter returns 400

**viewRowColorConditionUpdate:**
1. Update row color condition color
2. Update row color condition filter
3. Update row color with invalid conditionId returns 404
4. Update row color with invalid color format returns 400

**viewRowColorConditionDelete:**
1. Delete row color condition
2. Delete all row color conditions
3. Delete row color with invalid conditionId returns 404

**viewRowColorSelectAdd:**
1. Add select field for row coloring
2. Verify select options drive row colors
3. Add select with invalid field_id returns 400

**viewRowColorInfoDelete:**
1. Delete all row coloring configuration
2. Verify view has no row colors after deletion

**rowColorConditionsFilterCreate:**
1. Create filter for row color condition
2. Create nested filter for row color
3. Create filter with invalid conditionId returns 404

**Estimated:** ~24 tests, ~200-250 lines

---

### Phase 8: Implement view-sharing.test.ts

**Goal:** Test view sharing operations

**Operations to test:**
- POST shareView (5 tests)
- POST shareViewUpdate (4 tests)
- POST shareViewDelete (3 tests)

**Test cases:**

**shareView:**
1. Create public share for view
2. Share view generates UUID
3. Share view with password
4. Share view with meta options (allowCSVDownload)
5. Share personal view by non-owner returns 403

**shareViewUpdate:**
1. Update share password
2. Update share meta options
3. Update share with invalid viewId returns 404
4. Update unshared view returns 404

**shareViewDelete:**
1. Delete view share
2. Verify share is removed
3. Delete unshared view returns 404

**Estimated:** ~12 tests, ~100-120 lines

---

### Phase 9: Implement view-type-updates.test.ts

**Goal:** Test type-specific view updates

**Operations to test:**
- POST gridViewUpdate (4 tests)
- POST formViewUpdate (4 tests)
- POST formColumnUpdate (3 tests)
- POST galleryViewUpdate (3 tests)
- POST kanbanViewUpdate (3 tests)
- POST mapViewUpdate (2 tests)
- POST calendarViewUpdate (3 tests)

**Test cases:**

**gridViewUpdate:**
1. Update grid row height
2. Update grid groups configuration
3. Update grid with invalid viewId returns 404
4. Update non-grid view with gridViewUpdate returns 400

**formViewUpdate:**
1. Update form view settings
2. Update form field configuration
3. Update form with invalid viewId returns 404
4. Update non-form view with formViewUpdate returns 400

**formColumnUpdate:**
1. Update form column (label, help, required)
2. Update form column scanner settings
3. Update form column with invalid columnId returns 404

**galleryViewUpdate:**
1. Update gallery cover_field_id
2. Update gallery with invalid viewId returns 404
3. Update non-gallery view with galleryViewUpdate returns 400

**kanbanViewUpdate:**
1. Update kanban stack_by field
2. Update kanban with invalid viewId returns 404
3. Update non-kanban view with kanbanViewUpdate returns 400

**mapViewUpdate:**
1. Update map geo data column
2. Update map with invalid viewId returns 404

**calendarViewUpdate:**
1. Update calendar date ranges
2. Update calendar with invalid viewId returns 404
3. Update non-calendar view with calendarViewUpdate returns 400

**Estimated:** ~22 tests, ~180-220 lines

---

## Critical Files

### To Create/Update:
1. `/tests/unit/rest/tests/internal/index.test.ts` - Internal tests orchestrator
2. `/tests/unit/rest/tests/internal/ui-view/index.test.ts` - View tests orchestrator
3. `/tests/unit/rest/tests/internal/ui-view/view-basic.test.ts`
4. `/tests/unit/rest/tests/internal/ui-view/view-create-types.test.ts`
5. `/tests/unit/rest/tests/internal/ui-view/view-columns.test.ts`
6. `/tests/unit/rest/tests/internal/ui-view/view-filters.test.ts`
7. `/tests/unit/rest/tests/internal/ui-view/view-sorts.test.ts`
8. `/tests/unit/rest/tests/internal/ui-view/view-row-colors.test.ts`
9. `/tests/unit/rest/tests/internal/ui-view/view-sharing.test.ts`
10. `/tests/unit/rest/tests/internal/ui-view/view-type-updates.test.ts`
11. `/tests/unit/rest/index.test.ts` - Main test orchestrator (register internal tests)

### Reference Files:
- `/packages/nocodb/tests/unit/rest/tests/metaApiV3/view.test.ts` - Existing view test patterns
- `/packages/nocodb/src/controllers/internal/modules/UiGet.operations.ts` - GET operations source
- `/packages/nocodb/src/controllers/internal/modules/UiPost.operations.ts` - POST operations source
- `/packages/nocodb/src/controllers/internal.controller.ts` - Main controller implementation

## Key Patterns

### Test Setup (beforeEach):
```typescript
beforeEach(async () => {
  context = await init();
  const workspaceId = context.fk_workspace_id;

  // Create base
  const baseResult = await request(context.app)
    .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
    .set('xc-token', context.xc_token)
    .send({ title: 'ViewTestBase' })
    .expect(200);

  initBase = await Base.getByTitleOrId(ctx, baseResult.body.id);

  // Create table with multiple field types
  const tableResult = await request(context.app)
    .post(`/api/v3/meta/bases/${initBase.id}/tables`)
    .set('xc-token', context.xc_token)
    .send({ title: 'ViewTestTable', fields: [...] })
    .expect(200);

  // Get table model
  const source = (await initBase.getSources())[0];
  ctx = { base_id: initBase.id, workspace_id: workspaceId };
  table = await Model.getByAliasOrId(ctx, {
    source_id: source.id,
    aliasOrId: tableResult.body.id,
    base_id: initBase.id
  });

  // Override feature flag
  featureMock = await overrideFeature({
    workspace_id: workspaceId,
    feature: PlanFeatureTypes.FEATURE_API_VIEW_V3,
    allowed: true
  });
});
```

### Internal API Call Pattern (GET):
```typescript
const response = await request(context.app)
  .get(`/api/v2/internal/${workspaceId}/${baseId}`)
  .query({
    operation: 'viewList',
    tableId: table.id
  })
  .set('xc-token', context.xc_token)
  .expect(200);
```

### Internal API Call Pattern (POST):
```typescript
const response = await request(context.app)
  .post(`/api/v2/internal/${workspaceId}/${baseId}`)
  .query({
    operation: 'viewUpdate',
    viewId: view.id
  })
  .set('xc-token', context.xc_token)
  .send({ title: 'Updated Title' })
  .expect(200);
```

### Assertion Pattern:
```typescript
expect(response.body).to.be.an('object');
expect(response.body.list).to.be.an('array');
expect(response.body.list[0]).to.have.property('id');
expect(response.body.list[0].title).to.eq('ExpectedTitle');
```

## Test Execution

After implementation, run tests with:
```bash
# Run all internal tests
npm run test:unit -- --grep "Internal API"

# Run specific test file
npm run test:unit -- --grep "Internal API - View Basic"

# Run in specific test set
npm run test:unit --test-set-2
```

## Success Criteria

- [ ] Phase 1: All 8 test files created with skeletons, tests registered
- [ ] Phase 2-9: Each phase implemented with ~80%+ test success rate
- [ ] All 47 view operations have at least one test
- [ ] Tests follow existing codebase patterns
- [ ] Tests are isolated (can run independently)
- [ ] EE vs CE differentiation properly handled
- [ ] Error cases (400, 403, 404) covered
- [ ] Tests pass in CI/CD environment
