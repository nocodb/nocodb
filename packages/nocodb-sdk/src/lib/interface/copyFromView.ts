/**
 * Seeding an interface page's config from an existing table view.
 *
 * Shares the vocabulary of the view→view "Copy configuration from another
 * view" flow (`ViewSettingOverrideOptions`, `copyViewConfigOptionMap` in
 * `lib/viewUtils.ts`) so a builder sees the same eight settings in both places.
 * What differs is the DESTINATION: a view there, an interface page config here.
 *
 * `getCopyViewConfigOptions()` cannot answer for us, because it expresses the
 * destination as a `ViewTypes` — and interface layouts do not line up with view
 * types on the receiving side:
 *
 * - the interface LIST viz holds `group_by` and `visible_field_ids`, but
 *   `ViewTypes.LIST` is absent from those options' `supportedViewTypes`, so a
 *   list destination would be offered almost nothing;
 * - RECORD_REVIEW has no view twin at all — its list pane takes filters, sorts,
 *   grouping and record colour, while field ORDER, column width and row height
 *   have nowhere to land.
 *
 * So the destination side is declared explicitly below, against the config
 * shapes in `pageConfigs.ts`. The SOURCE side still comes from
 * `copyViewConfigOptionMap` — sources are real views, so that map is exact.
 */
import {
  copyViewConfigOptionMap,
  type CopyViewConfigOption,
} from '../viewUtils';
import { ViewSettingOverrideOptions } from '../enums';
import { ViewTypes } from '../globals';
import { InterfacePageLayoutTypes } from './enums';
import { InterfaceVisualizationTypes } from './pageConfigs';
import type { AnyInterfacePageConfig } from './pageConfigs';

/**
 * The interface visualization each view type corresponds to.
 *
 * `ViewTypes.MAP` and `ViewTypes.FORM` have no counterpart — a map's marker
 * field and a form's layout have nowhere to land on a table or record-review
 * page — so they are absent, and that absence is what
 * `canViewTypeSeedInterfacePage` reads to keep them out of the view picker.
 */
export const VIEW_TYPE_TO_INTERFACE_VIZ: Partial<
  Record<ViewTypes, InterfaceVisualizationTypes>
> = {
  [ViewTypes.GRID]: InterfaceVisualizationTypes.GRID,
  [ViewTypes.LIST]: InterfaceVisualizationTypes.LIST,
  [ViewTypes.GALLERY]: InterfaceVisualizationTypes.GALLERY,
  [ViewTypes.KANBAN]: InterfaceVisualizationTypes.KANBAN,
  [ViewTypes.CALENDAR]: InterfaceVisualizationTypes.CALENDAR,
  [ViewTypes.TIMELINE]: InterfaceVisualizationTypes.TIMELINE,
  [ViewTypes.GANTT]: InterfaceVisualizationTypes.GANTT,
};

/**
 * True when a view of this type can seed an interface page at all. Takes a bare
 * number because `ViewType.type` is untyped on the generated API surface.
 */
export function canViewTypeSeedInterfacePage(viewType?: number): boolean {
  return (
    viewType !== undefined &&
    !!VIEW_TYPE_TO_INTERFACE_VIZ[viewType as ViewTypes]
  );
}

/**
 * Settings each TABLE-page visualization can actually hold, read off the
 * `InterfaceVisualizationConfig` members in `pageConfigs.ts`.
 *
 * Every viz extends `InterfaceVizCommon` — `filters`, `sorts`,
 * `visible_field_ids`, `field_order`, `field_configs`, `color_by` — so those
 * five options are universal. The two exceptions:
 *
 * - COLUMN_WIDTH lands on `field_configs[id].width`, which exists on every viz
 *   but only MEANS anything in the column-based renderers (grid, list). On a
 *   gallery/kanban card it would be written and never read.
 * - ROW_HEIGHT and GROUP exist only where the config declares them.
 */
const TABLE_VIZ_DEST_SUPPORT: Record<
  InterfaceVisualizationTypes,
  ViewSettingOverrideOptions[]
> = {
  [InterfaceVisualizationTypes.GRID]: [
    ViewSettingOverrideOptions.FIELD_VISIBILITY,
    ViewSettingOverrideOptions.FIELD_ORDER,
    ViewSettingOverrideOptions.COLUMN_WIDTH,
    ViewSettingOverrideOptions.ROW_HEIGHT,
    ViewSettingOverrideOptions.FILTER_CONDITION,
    ViewSettingOverrideOptions.GROUP,
    ViewSettingOverrideOptions.SORT,
    ViewSettingOverrideOptions.ROW_COLORING,
  ],
  [InterfaceVisualizationTypes.LIST]: [
    ViewSettingOverrideOptions.FIELD_VISIBILITY,
    ViewSettingOverrideOptions.FIELD_ORDER,
    ViewSettingOverrideOptions.COLUMN_WIDTH,
    ViewSettingOverrideOptions.ROW_HEIGHT,
    ViewSettingOverrideOptions.FILTER_CONDITION,
    ViewSettingOverrideOptions.GROUP,
    ViewSettingOverrideOptions.SORT,
    ViewSettingOverrideOptions.ROW_COLORING,
  ],
  [InterfaceVisualizationTypes.GALLERY]: [
    ViewSettingOverrideOptions.FIELD_VISIBILITY,
    ViewSettingOverrideOptions.FIELD_ORDER,
    ViewSettingOverrideOptions.FILTER_CONDITION,
    ViewSettingOverrideOptions.SORT,
    ViewSettingOverrideOptions.ROW_COLORING,
  ],
  [InterfaceVisualizationTypes.KANBAN]: [
    ViewSettingOverrideOptions.FIELD_VISIBILITY,
    ViewSettingOverrideOptions.FIELD_ORDER,
    ViewSettingOverrideOptions.FILTER_CONDITION,
    ViewSettingOverrideOptions.SORT,
    ViewSettingOverrideOptions.ROW_COLORING,
  ],
  [InterfaceVisualizationTypes.CALENDAR]: [
    ViewSettingOverrideOptions.FIELD_VISIBILITY,
    ViewSettingOverrideOptions.FIELD_ORDER,
    ViewSettingOverrideOptions.FILTER_CONDITION,
    ViewSettingOverrideOptions.SORT,
    ViewSettingOverrideOptions.ROW_COLORING,
  ],
  [InterfaceVisualizationTypes.TIMELINE]: [
    ViewSettingOverrideOptions.FIELD_VISIBILITY,
    ViewSettingOverrideOptions.FIELD_ORDER,
    ViewSettingOverrideOptions.ROW_HEIGHT,
    ViewSettingOverrideOptions.FILTER_CONDITION,
    ViewSettingOverrideOptions.GROUP,
    ViewSettingOverrideOptions.SORT,
    ViewSettingOverrideOptions.ROW_COLORING,
  ],
  [InterfaceVisualizationTypes.GANTT]: [
    ViewSettingOverrideOptions.FIELD_VISIBILITY,
    ViewSettingOverrideOptions.FIELD_ORDER,
    ViewSettingOverrideOptions.ROW_HEIGHT,
    ViewSettingOverrideOptions.FILTER_CONDITION,
    ViewSettingOverrideOptions.GROUP,
    ViewSettingOverrideOptions.SORT,
    ViewSettingOverrideOptions.ROW_COLORING,
  ],
};

/**
 * RECORD_REVIEW has no visualization — its list pane
 * (`InterfaceRecordReviewListConfig`) takes filters, sorts, `group_by` and
 * `item.color_by`, and FIELD_VISIBILITY seeds the page-level
 * `allowed_field_ids` projection boundary.
 *
 * Field ORDER, column width and row height are deliberately absent: the detail
 * pane's ordering is structural (groups → rows → fields), and the list pane
 * renders cards, not columns.
 */
const RECORD_REVIEW_DEST_SUPPORT: ViewSettingOverrideOptions[] = [
  ViewSettingOverrideOptions.FIELD_VISIBILITY,
  ViewSettingOverrideOptions.FILTER_CONDITION,
  ViewSettingOverrideOptions.GROUP,
  ViewSettingOverrideOptions.SORT,
  ViewSettingOverrideOptions.ROW_COLORING,
];

/** The page being created, as far as the copy is concerned. */
export interface InterfaceCopyFromViewDest {
  layout: InterfacePageLayoutTypes;
  /** TABLE layouts only — which visualization the wizard is creating. */
  visualization?: InterfaceVisualizationTypes;
}

/** Layouts the copy control is offered for (phase 1). */
export function interfaceLayoutSupportsCopyFromView(
  layout: InterfacePageLayoutTypes
): boolean {
  return (
    layout === InterfacePageLayoutTypes.TABLE ||
    layout === InterfacePageLayoutTypes.RECORD_REVIEW
  );
}

/** Settings the destination page can hold, ignoring the source view. */
export function getInterfaceCopyFromViewDestSupport(
  dest: InterfaceCopyFromViewDest
): ViewSettingOverrideOptions[] {
  if (dest.layout === InterfacePageLayoutTypes.RECORD_REVIEW) {
    return RECORD_REVIEW_DEST_SUPPORT;
  }

  if (dest.layout === InterfacePageLayoutTypes.TABLE && dest.visualization) {
    return TABLE_VIZ_DEST_SUPPORT[dest.visualization] ?? [];
  }

  return [];
}

/**
 * The option rows to render, in display order — same contract as
 * `getCopyViewConfigOptions()`: the destination decides which options EXIST,
 * the source decides which are `disabled`. An absent `sourceViewType` (nothing
 * picked yet) leaves everything enabled.
 */
export function getInterfaceCopyFromViewOptions(
  sourceViewType: ViewTypes | undefined,
  dest: InterfaceCopyFromViewDest
): Omit<CopyViewConfigOption, 'supportedViewTypes'>[] {
  const destSupport = getInterfaceCopyFromViewDestSupport(dest);

  return destSupport
    .map((value) => {
      const { supportedViewTypes, ...rest } = copyViewConfigOptionMap[value];

      return {
        ...rest,
        disabled:
          sourceViewType !== undefined &&
          !supportedViewTypes.includes(sourceViewType),
      };
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Narrow a selection to what the current source/destination pair still
 * supports — called when either end changes, so a setting picked for a grid
 * source does not survive a switch to a gallery source that cannot provide it.
 */
export function extractSupportedInterfaceCopyFromViewOptions(
  selected: ViewSettingOverrideOptions[],
  sourceViewType: ViewTypes | undefined,
  dest: InterfaceCopyFromViewDest
): ViewSettingOverrideOptions[] {
  const available = new Set(
    getInterfaceCopyFromViewOptions(sourceViewType, dest)
      .filter((option) => !option.disabled)
      .map((option) => option.value)
  );

  return selected.filter((value) => available.has(value));
}

/**
 * Why a copied page will not match its source view exactly. Surfaced in the
 * wizard BEFORE the page is created — several of these silently WIDEN the
 * record set, so discovering them afterwards is too late.
 */
export enum InterfaceCopyFromViewWarnings {
  /**
   * The view carries field-to-field conditions (`Filter.fk_value_col_id`),
   * which the builder-authored interface filter schema
   * (`filterLeafSchema` in `config-schemas.ts`) does not express. Those
   * conditions are dropped, so the page matches MORE records than the view.
   */
  DYNAMIC_FILTERS_DROPPED = 'dynamic_filters_dropped',
  /**
   * The view carries `logical_op: 'not'` conditions. Interface filter groups
   * are `'and' | 'or'` only, and coercing a NOT to an AND would INVERT the
   * condition rather than merely relax it — so those nodes are dropped, again
   * widening the record set.
   */
  NEGATED_FILTERS_DROPPED = 'negated_filters_dropped',
  /**
   * A filter-mode row-colour view whose conditions disagree on
   * `is_set_as_background`. `InterfaceRecordColorConfig`'s `conditions` variant
   * has no per-condition background, so the colours come across but the
   * background treatment does not.
   */
  ROW_COLOR_BACKGROUND_LOST = 'row_color_background_lost',
  /**
   * Grouping was requested but the destination cannot hold it (a grid view
   * copied into a gallery/kanban/calendar page).
   */
  GROUPING_DROPPED = 'grouping_dropped',
}

export interface InterfaceCopyFromViewWarning {
  code: InterfaceCopyFromViewWarnings;
  /** Occurrence count where it reads meaningfully (dropped conditions). */
  count?: number;
}

/** Request body of the `interfacePageConfigFromView` read operation. */
export interface InterfaceCopyFromViewPayload {
  /** Source table — must own both the view and the page being created. */
  fk_model_id: string;
  sourceViewId: string;
  layout: InterfacePageLayoutTypes;
  /** TABLE layouts only. */
  visualization?: InterfaceVisualizationTypes;
  settings: ViewSettingOverrideOptions[];
}

/**
 * Result of the read operation. `config` is a PARTIAL page config, meant to be
 * merged over the wizard's own defaults and then handed to the untouched
 * `interfacePageCreate` — keeping that traced command's payload literal, so
 * sandbox replay never re-reads a view that may have changed since.
 */
export interface InterfaceCopyFromViewResult {
  config: Partial<AnyInterfacePageConfig>;
  warnings: InterfaceCopyFromViewWarning[];
}
