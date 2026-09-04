import { InterfacePageLayoutTypes } from './enums';
import type { InterfaceButtonConfig, InterfaceButtonScope } from './elements';
import type {
  AnyInterfacePageConfig,
  InterfaceDashboardPageConfig,
  InterfaceRecordDetailPageConfig,
  InterfaceRecordReviewPageConfig,
  InterfaceTablePageConfig,
} from './pageConfigs';

/** One configured button together with where it sits on the page. */
export interface InterfaceButtonPlacement {
  button: InterfaceButtonConfig;
  scope: InterfaceButtonScope;
  /** Table the placement binds — page's table, or the dashboard group's own. Absent = page's. */
  fk_model_id?: string | null;
}

/**
 * Every button a page config carries, across all of its placements. Field-group
 * and custom-page buttons are accepted by the schema but have no builder or
 * renderer yet, so they are not listed.
 */
export function collectInterfaceButtonPlacements(
  layout: InterfacePageLayoutTypes | string,
  config: AnyInterfacePageConfig | null | undefined
): InterfaceButtonPlacement[] {
  if (!config) return [];

  switch (layout) {
    case InterfacePageLayoutTypes.RECORD_DETAIL:
      return (
        (config as InterfaceRecordDetailPageConfig).user_actions?.buttons ?? []
      ).map((button) => ({ button, scope: 'record' }));
    case InterfacePageLayoutTypes.RECORD_REVIEW: {
      const review = config as InterfaceRecordReviewPageConfig;
      return [
        ...(review.list?.user_actions?.buttons ?? []).map((button) => ({
          button,
          scope: 'page' as const,
        })),
        ...(review.detail?.user_actions?.buttons ?? []).map((button) => ({
          button,
          scope: 'record' as const,
        })),
      ];
    }
    case InterfacePageLayoutTypes.TABLE:
      return (
        (config as InterfaceTablePageConfig).user_actions?.buttons ?? []
      ).map((button) => ({ button, scope: 'page' }));
    case InterfacePageLayoutTypes.DASHBOARD:
      return ((config as InterfaceDashboardPageConfig).groups ?? []).flatMap(
        (group) =>
          (group.user_actions?.buttons ?? []).map((button) => ({
            button,
            scope: 'page' as const,
            fk_model_id: group.fk_model_id,
          }))
      );
    default:
      return [];
  }
}

/** The placement of one button by id, or null. */
export function findInterfaceButtonPlacement(
  layout: InterfacePageLayoutTypes | string,
  config: AnyInterfacePageConfig | null | undefined,
  buttonId: string
): InterfaceButtonPlacement | null {
  return (
    collectInterfaceButtonPlacements(layout, config).find(
      (p) => p.button.id === buttonId
    ) ?? null
  );
}
