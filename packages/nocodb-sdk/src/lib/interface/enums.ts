export enum InterfacePageLayoutTypes {
  /** Multi-visualization table page (grid/gallery/kanban/list/calendar/timeline). */
  TABLE = 'table',
  /** Record list pane + inlined record detail pane. */
  RECORD_REVIEW = 'record_review',
  /** Groups of widgets (charts/metrics/mini-visualizations). */
  DASHBOARD = 'dashboard',
  /** Record create/update form — nav page or modal (reusable). */
  FORM = 'form',
  /** Landing page — the only layout without a source table. */
  OVERVIEW = 'overview',
  /** Reusable per-table record detail page (unparented, referenced by id). */
  RECORD_DETAIL = 'record_detail',
}

export enum InterfacePageVisualVariants {
  /** Full page (nav pages, fullscreen record detail). */
  PAGE = 'page',
  /** Modal dialog (record-creation/edit forms). */
  MODAL = 'modal',
  /** Side sheet (record detail default). */
  SIDESHEET = 'sidesheet',
}

/**
 * Which config snapshot an interface data/widget read resolves against.
 * DRAFT is builder-only (creator+) — everyone else is forced onto PUBLISHED
 * regardless of what they request.
 */
export enum InterfacePageEnvs {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

/** Layouts that require a source table (`fk_model_id`). */
export const INTERFACE_LAYOUTS_WITH_SOURCE: readonly InterfacePageLayoutTypes[] =
  [
    InterfacePageLayoutTypes.TABLE,
    InterfacePageLayoutTypes.RECORD_REVIEW,
    InterfacePageLayoutTypes.FORM,
    InterfacePageLayoutTypes.RECORD_DETAIL,
  ] as const;
