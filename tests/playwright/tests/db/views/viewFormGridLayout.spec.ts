import { test } from '@playwright/test';

// Form view — multi-column grid layout.
//
// These are UNIMPLEMENTED placeholders: they rely on a `reorderFieldIntoRow`
// page helper (TODO — add to pages/Dashboard/Form/index.ts) plus seeded
// fixtures, and have no assertions yet. The whole group is marked
// `describe.fixme` so it is skipped WITHOUT running any beforeEach/afterEach
// (browser launch + base setup) — i.e. zero CI cost — while keeping the TODO
// record. Drop the `.fixme` once the helper + assertions are written.
//
// Manual smoke-test checklist until then:
//   1. Drag field B next to field A  → A and B share a row, equal width
//   2. Drag field C next to A/B      → three-up row, equal width
//   3. Try to drag 6th field into a row → drop should be rejected
//   4. Long-text / Attachment fields → always their own full-width row
//   5. Shared form URL on desktop    → renders multi-field rows
//   6. Shared form URL on mobile     → collapses to single column (<768px)

test.describe.fixme('Form view grid layout', () => {
  test('two fields on the same row render at equal width', () => {
    // TODO: add form.reorderFieldIntoRow({ sourceField, targetField }) helper,
    // then assert the two fields share a row with equal width and equal y.
  });

  test('max 5 fields per row — 6th drop is rejected', () => {
    // TODO: drag helper + a seeded table with 6+ visible fields.
  });

  test('long-text / attachment fields stay full-width', () => {
    // TODO: create a LongText field, attempt to drag it beside another field,
    // assert it snaps back to its own full-width row.
  });

  test('shared form on mobile viewport collapses to single column', () => {
    // TODO: seed a form with a multi-field row, open the shared URL at 375px,
    // assert the rows stack vertically.
  });
});
