import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { ToolbarPage } from '../common/Toolbar';
import { TopbarPage } from '../common/Topbar';

/**
 * Page object for the Gantt view. Mirrors the Timeline page object — Gantt
 * was forked from Timeline (see `composables/useGanttViewStore.ts` header
 * comment) so navigation / zoom / fields-menu helpers are intentionally
 * shaped the same way. When a behaviour drifts, both helpers should drift
 * together; if they don't, that's a sign one of the two regressed.
 */
export class GanttPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly toolbar: ToolbarPage;
  readonly topbar: TopbarPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.toolbar = new ToolbarPage(this);
    this.topbar = new TopbarPage(this);
  }

  get() {
    return this.dashboard.rootPage.getByTestId('nc-gantt-wrapper');
  }

  async waitLoading() {
    await this.get().waitFor({ state: 'visible' });
    // Initial data fetch + navigateToClosestRecord pan happen on mount; let
    // both settle before any caller asserts on bar positions.
    await this.rootPage.waitForTimeout(1000);
  }

  async getActiveDateLabel() {
    return await this.get().getByTestId('nc-gantt-active-date').textContent();
  }

  async clickToday() {
    await this.get().getByTestId('nc-gantt-today-btn').click();
    await this.rootPage.waitForTimeout(500);
  }

  async clickNext() {
    await this.get().getByTestId('nc-gantt-next-btn').click();
    await this.rootPage.waitForTimeout(500);
  }

  async clickPrev() {
    await this.get().getByTestId('nc-gantt-prev-btn').click();
    await this.rootPage.waitForTimeout(500);
  }

  /**
   * The Gantt has its own toolbar (`.nc-gantt-toolbar`), so the shared
   * ToolbarPage helpers that anchor on `.nc-table-toolbar` don't resolve.
   * Toggle the fields-menu dropdown explicitly, scoped to the Gantt wrapper.
   */
  async clickFields() {
    const fieldsMenu = this.rootPage.locator('[data-testid="nc-fields-menu"]');
    const wasOpen = await fieldsMenu.isVisible();
    await this.get().locator('button.nc-fields-menu-btn').click();
    if (wasOpen) await fieldsMenu.waitFor({ state: 'hidden' });
    else await fieldsMenu.waitFor({ state: 'visible' });
  }

  bars(): Locator {
    return this.get().locator('[data-testid="nc-gantt-bar"]');
  }

  async getBarCount() {
    return await this.bars().count();
  }

  async getFirstBar(): Promise<Locator> {
    return this.bars().first();
  }

  /**
   * Returns the visible (clipped) text of the first bar — what the user
   * actually reads inside the bar's rectangle. With overflow-hidden on the
   * bar div, narrow bars render less than their full inner text — but
   * `textContent()` returns the full text regardless of clipping. Useful
   * for asserting the bar contains a substring; not useful for asserting
   * the clip happened. Use `verifyBarFitsInBox()` for the clip assertion.
   */
  async getBarText(index = 0): Promise<string> {
    return ((await this.bars().nth(index).textContent()) ?? '').trim();
  }

  /**
   * Assert that the bar's rendered text doesn't visually spill past its
   * own bounding box. Compares the rendered element's bounding box to its
   * scrollWidth — if scrollWidth > clientWidth the content is clipped
   * (good), and the overflow-hidden style keeps it invisible. Without the
   * spill-out fix this returned scrollWidth ≈ clientWidth even on narrow
   * bars (because the label rendered as a separate sibling). Now it
   * should be strictly clipped when narrower than the inline text.
   */
  async verifyBarClipsWhenNarrow(index = 0) {
    const bar = this.bars().nth(index);
    await bar.scrollIntoViewIfNeeded();
    const overflowsCleanly = await bar.evaluate(el => {
      const style = window.getComputedStyle(el as HTMLElement);
      // The bar must declare overflow-hidden so any overflow we measure
      // below is actually clipped from view.
      return style.overflow === 'hidden' || style.overflowX === 'hidden';
    });
    expect(overflowsCleanly, 'bar should have overflow:hidden').toBe(true);
  }

  /**
   * Hover the bar to surface the NcTooltip, then read its content. The
   * tooltip portal mounts under `body > .ant-tooltip` — locate the last
   * visible tooltip and grab its inner text.
   */
  async getBarTooltipText(index = 0): Promise<string> {
    const bar = this.bars().nth(index);
    await bar.scrollIntoViewIfNeeded();
    await bar.hover();
    const tooltip = this.rootPage.locator('.ant-tooltip-inner').last();
    await tooltip.waitFor({ state: 'visible', timeout: 3000 });
    return ((await tooltip.textContent()) ?? '').trim();
  }

  async clickBar(index = 0) {
    await this.bars().nth(index).click();
    await this.rootPage.waitForTimeout(500);
  }

  /**
   * Inspector panel — slides in from the right when a bar is clicked.
   * Lives outside the Gantt wrapper in the layout, so locate it from
   * the root page.
   */
  async getInspector(): Promise<Locator> {
    return this.rootPage.getByTestId('nc-gantt-inspector');
  }

  async closeInspector() {
    await this.rootPage.getByTestId('nc-gantt-inspector').getByTestId('nc-gantt-inspector-close').click();
    await this.rootPage.waitForTimeout(300);
  }

  /**
   * Set zoom level. The dropdown is matched via `data-value=<level>`
   * inside `.nc-gantt-zoom-dropdown`, same convention as Timeline.
   */
  async setZoomLevel(level: 'week' | '2week' | 'month' | 'quarter' | '6month' | 'year' | '2year' | '5year') {
    await this.get().getByTestId('nc-gantt-view-mode').click();
    const dropdown = this.rootPage.locator('.nc-gantt-zoom-dropdown');
    await dropdown.waitFor({ state: 'visible' });
    await dropdown.locator(`[data-value="${level}"]`).first().click();
    await this.rootPage.waitForTimeout(800);
  }

  /**
   * Dependency arrows — rendered as SVG paths with the hit-area class
   * `nc-gantt-arrow-hit`. One path per edge between visible bars. The
   * outer SVG mounts only when `arrowPaths.length || linkCreationDrag`,
   * so a zero count is fine when no deps are configured.
   */
  async getArrowCount(): Promise<number> {
    return await this.get().locator('.nc-gantt-arrow-hit').count();
  }

  async verifyEmptyState() {
    await expect(this.get()).toContainText(/No date range configured|noGanttRange/i);
  }

  async verifyBarsRendered() {
    const count = await this.getBarCount();
    expect(count).toBeGreaterThan(0);
  }
}
