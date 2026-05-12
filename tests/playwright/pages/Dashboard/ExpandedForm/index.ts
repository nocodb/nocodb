import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';
import { DateTimeCellPageObject } from '../common/Cell/DateTimeCell';
import { isEE } from '../../../setup/db';

export class ExpandedFormPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly addNewTableButton: Locator;
  readonly duplicateRowButton: Locator;
  readonly deleteRowButton: Locator;

  readonly btn_save: Locator;
  readonly btn_moreActions: Locator;
  readonly btn_nextField: Locator;
  readonly btn_previousField: Locator;

  readonly span_tableName: Locator;
  readonly span_modeFields: Locator;
  readonly span_modeFiles: Locator;

  readonly cnt_filesModeContainer: Locator;
  readonly cnt_filesNoAttachmentField: Locator;
  readonly cnt_attachmentsPreviewBar: Locator;
  readonly cnt_filesAttachmentHeader: Locator;
  readonly cnt_filesCurrentFieldTitle: Locator;
  readonly cnt_filesCurrentAttachmentTitle: Locator;
  readonly cnt_filesNoAttachment: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.addNewTableButton = this.dashboard.get().locator('.nc-add-new-table');
    this.duplicateRowButton = this.dashboard.get().locator('.nc-duplicate-row:visible');
    this.deleteRowButton = this.dashboard.get().locator('.nc-delete-row:visible');

    this.btn_save = this.get().getByTestId('nc-expanded-form-save');
    this.btn_moreActions = this.get().locator('.nc-expand-form-more-actions');
    this.btn_nextField = this.get().getByTestId('nc-expanded-form-next');
    this.btn_previousField = this.get().getByTestId('nc-expanded-form-prev');
    this.span_tableName = this.get().locator('.nc-expanded-form-header').last().locator('.nc-expanded-form-table-name');
    this.span_modeFields = this.get().locator('.nc-expanded-form-mode-switch').last().locator('.tab').nth(0);
    this.span_modeFiles = this.get().locator('.nc-expanded-form-mode-switch').last().locator('.tab').nth(1);

    this.cnt_filesModeContainer = this.get().locator('.nc-files-mode-container');
    this.cnt_filesNoAttachmentField = this.get().locator('.nc-files-no-attachment-field');
    this.cnt_attachmentsPreviewBar = this.get().locator('.nc-attachments-preview-bar');
    this.cnt_filesAttachmentHeader = this.get().locator('.nc-files-attachment-header');
    this.cnt_filesCurrentFieldTitle = this.get().locator('.nc-files-current-field-title');
    this.cnt_filesCurrentAttachmentTitle = this.cnt_attachmentsPreviewBar.locator(
      '.preview-cell-active .nc-preview-cell-title'
    );
    this.cnt_filesNoAttachment = this.get().locator('.nc-files-no-attachment');
  }

  // Matches either the modal (.nc-drawer-expanded-form) or the EE side panel
  // (.nc-expanded-form-panel). Both expose a unique data-testid on the root,
  // so tests don't depend on which surface the user has selected via the
  // expanded-form mode toggle.
  get() {
    return this.dashboard
      .get()
      .locator('[data-testid="nc-expanded-form-modal"], [data-testid="nc-expanded-form-panel"]');
  }

  // True when the EE side-panel surface is the one currently open. Used to
  // branch behaviour for surface-specific UI (e.g. comments are tab-toggled
  // in the panel but always present in the modal).
  async isPanelMode() {
    return (await this.dashboard.get().locator('[data-testid="nc-expanded-form-panel"]').count()) > 0;
  }

  // Promotes the panel into fullscreen so the same fields/files/discussion
  // mode selector the modal uses becomes visible. No-op in modal mode — the
  // modal is already laid out with the selector inline.
  async enterFullscreen() {
    if (!(await this.isPanelMode())) return;
    await this.rootPage.getByTestId('nc-expanded-form-panel-fullscreen').click();
  }

  async click3DotsMenu(menuItem: string) {
    await this.get().locator('.nc-expand-form-more-actions').last().click();

    // add delay; wait for the menu to appear
    await this.rootPage.waitForTimeout(500);

    const popUpMenu = this.rootPage.locator('.ant-dropdown');
    await popUpMenu.locator(`.ant-dropdown-menu-item:has-text("${menuItem}")`).click();
  }

  async clickDuplicateRow() {
    await this.click3DotsMenu('Duplicate Record');
    // wait for loader to disappear
    // await this.dashboard.waitForLoaderToDisappear();
    await this.rootPage.waitForTimeout(2000);
  }

  async clickDeleteRow() {
    await this.click3DotsMenu('Delete record');
    await this.rootPage.locator('.ant-btn-danger:has-text("Delete record")').click();
  }

  async isDisabledDuplicateRow() {
    const isDisabled = this.duplicateRowButton;
    return await isDisabled.count();
  }

  async isDisabledDeleteRow() {
    const isDisabled = this.deleteRowButton;
    return await isDisabled.count();
  }

  async gotoUsingUrlAndRowId({ rowId }: { rowId: string }) {
    const url = this.dashboard.rootPage.url();
    const expandedFormUrl = '/' + url.split('/').slice(3).join('/').split('?')[0] + `?rowId=${rowId}`;
    await this.rootPage.goto(expandedFormUrl);
    await this.dashboard.waitForLoaderToDisappear();
  }

  async fillField({
    columnTitle,
    value,
    type = 'text',
    ltarCount,
  }: {
    columnTitle: string;
    value: any;
    type?: string;
    ltarCount?: number | string;
  }) {
    const field = this.get().getByTestId(`nc-expand-col-${columnTitle}`);
    switch (type) {
      case 'text':
        await field.locator('input, textarea').fill(value);
        break;
      case 'geodata': {
        const [lat, long] = value.split(',');
        await this.rootPage.locator(`[data-testid="nc-geo-data-set-location-button"]`).click();
        await this.rootPage.locator(`[data-testid="nc-geo-data-latitude"]`).fill(lat);
        await this.rootPage.locator(`[data-testid="nc-geo-data-longitude"]`).fill(long);
        await this.rootPage.locator(`[data-testid="nc-geo-data-save"]`).click();
        break;
      }
      case 'belongsTo':
        await field.locator('.nc-virtual-cell').hover();
        await field
          .locator('.nc-action-icon.nc-plus, .nc-has-many-plus-icon, .nc-many-to-many-plus-icon')
          .first()
          .click();
        if (ltarCount !== undefined && ltarCount !== null) {
          await this.dashboard.linkRecord.verifyCount(`${ltarCount}`);
        }
        await this.dashboard.linkRecord.select(value, false);
        break;
      case 'hasMany':
      case 'manyToMany':
      case 'manyToOne':
        await field.locator('.nc-virtual-cell').hover();
        await field
          .locator('.nc-action-icon.nc-plus, .nc-has-many-plus-icon, .nc-many-to-many-plus-icon')
          .first()
          .click();
        if (ltarCount !== undefined && ltarCount !== null) {
          await this.dashboard.linkRecord.verifyCount(`${ltarCount}`);
        }
        await this.dashboard.linkRecord.select(value);
        break;
      case 'dateTime':
        await field.locator('.nc-cell .nc-date-input').click();
        // eslint-disable-next-line no-case-declarations
        const dateTimeObj = new DateTimeCellPageObject(this.dashboard.grid.cell);

        await dateTimeObj.selectDate({ date: value.slice(0, 10), locator: field.locator('.nc-cell') });

        await dateTimeObj.selectTime({
          hour: +value.slice(11, 13),
          minute: +value.slice(14, 16),
          locator: field.locator('.nc-cell'),
          fillValue: `${value.slice(11, 13).padStart(2, '0')}:${value.slice(14, 16).padStart(2, '0')}`,
        });
        break;
    }
  }

  async save({
    waitForRowsData = true,
  }: {
    waitForRowsData?: boolean;
  } = {}) {
    const saveRowAction = () => this.get().getByTestId('nc-expanded-form-save').click();

    if (waitForRowsData) {
      await this.waitForResponse({
        uiAction: saveRowAction,
        requestUrlPathToMatch: 'api/v1/db/data/noco/',
        httpMethodsToMatch: ['GET'],
        responseJsonMatcher: json => json['pageInfo'],
      });
    } else {
      await this.waitForResponse({
        uiAction: saveRowAction,
        requestUrlPathToMatch: 'api/v1/db/data/noco/',
        httpMethodsToMatch: ['POST'],
      });
    }

    await this.verifyToast({ message: `updated successfully.` });
    await this.rootPage.locator('[data-testid="grid-load-spinner"]').waitFor({ state: 'hidden' });

    // removing focus from toast
    await this.rootPage.waitForTimeout(1000);
    // Modal mode renders inside an `.nc-modal` wrapper which we click to
    // dismiss toast focus. Panel mode has no such wrapper — click the panel
    // root instead so we don't reach into stale, hidden modals.
    const visibleModal = this.rootPage.locator('.nc-modal:visible').first();
    if (await visibleModal.count()) {
      await visibleModal.click();
    } else {
      await this.get().click({ position: { x: 4, y: 4 } });
    }
    await this.rootPage.waitForTimeout(1000);
    await this.get().getByTestId('nc-expanded-form-close').last().click();
    await this.get().waitFor({ state: 'hidden' });
  }

  // check for the expanded form header table name

  // async verify({ header, url }: { header: string; url?: string }) {
  //   await expect(this.get().locator(`.nc-expanded-form-header`).last()).toContainText(header);
  //   if (url) {
  //     await expect.poll(() => this.rootPage.url()).toContain(url);
  //   }
  // }

  async escape() {
    // Panel handles Escape via @keydown on its root element, which only
    // fires when the panel has focus. After interactions (cell clicks, URL
    // navigation), focus may have moved away — re-focus the panel root so
    // Escape reliably closes the panel. No-op for the modal where Escape is
    // captured at body level by ant-design.
    if (await this.isPanelMode()) {
      await this.get()
        .focus()
        .catch(() => {});
    }
    await this.rootPage.keyboard.press('Escape');
    // Best-effort wait for the form to hide. The previous selector chain
    // (`.nc-drawer-expanded-form` nested inside `.nc-drawer-expanded-form`)
    // matched nothing and resolved instantly, masking flows where Escape is
    // ignored (Gallery's modal when focus has shifted). Downstream steps
    // navigate the URL anyway, so swallow timeouts here rather than block.
    await this.get()
      .waitFor({ state: 'hidden', timeout: 3000 })
      .catch(() => {});

    await this.rootPage.waitForLoadState('networkidle');
    await this.rootPage.waitForLoadState('domcontentloaded');
    await this.rootPage.waitForTimeout(500);
  }

  async close() {
    await this.get().getByTestId('nc-expanded-form-close').last().click();
  }

  async openChildCard(param: { column: string; title: string }) {
    const childField = this.get().locator(`[data-testid="nc-expand-col-${param.column}"]`);
    // Wait for either Links.vue (.nc-datatype-link) or HM/MM (maximize icon) to appear
    const linkText = childField.locator('.nc-datatype-link');
    const maximizeIcon = childField.locator('.nc-has-many-maximize-icon, .nc-many-to-many-maximize-icon');

    // Wait for either element with a generous timeout (external DB can be slow)
    await childField
      .locator('.nc-datatype-link, .nc-has-many-maximize-icon, .nc-many-to-many-maximize-icon, .chip')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 });

    if ((await linkText.count()) > 0 && (await linkText.isVisible())) {
      await linkText.click();
    } else if ((await maximizeIcon.count()) > 0) {
      await childField.hover();
      await maximizeIcon.click({ force: true });
    }

    const card = await this.rootPage.locator(`.ant-card:has-text("${param.title}")`);
    await card.hover();
    await card.locator(`.nc-expand-item`).click();
  }

  async verifyCount({ count }: { count: number }) {
    return await expect(
      this.rootPage.locator('[data-testid="nc-expanded-form-modal"], [data-testid="nc-expanded-form-panel"]')
    ).toHaveCount(count);
  }

  async verifyRoleAccess(param: { role: string }) {
    const role = param.role.toLowerCase();

    // expect(await this.btn_moreActions.count()).toBe(1);
    await this.rootPage.waitForTimeout(200);

    // Panel mode tab-toggles the comments drawer (modal renders it inline).
    // Click the toggle first, BEFORE opening the more-actions dropdown.
    //
    // Use native DOM `.click()` via `evaluate` instead of Playwright's click —
    // the toggle sits inside an `NcTooltip` wrapper that sometimes intercepts
    // synthesized pointer events on slow CI runners, making Playwright report
    // a successful click even when the @click handler never fires. A native
    // dispatch goes straight through. Then verify the toggle reaches `.active`
    // before relying on the comment-input render.
    const panelMode = await this.isPanelMode();
    if (panelMode) {
      const commentsToggle = this.rootPage.getByTestId('nc-expanded-form-panel-comments-toggle');
      await commentsToggle.waitFor({ state: 'visible' });
      await this.rootPage.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="nc-expanded-form-panel-comments-toggle"]'
        ) as HTMLElement | null;
        el?.click();
      });
      await expect(commentsToggle).toHaveClass(/active/);
    }

    if (await this.btn_moreActions.isVisible()) {
      // In large screen, the more actions button will be hidden as copy record url button will be visible inline (outside)
      await this.btn_moreActions.click();
    }

    if (!isEE()) {
      await expect(this.rootPage.getByTestId('nc-expanded-form-reload')).toBeVisible();
    } else {
      await expect(this.rootPage.getByTestId('nc-expanded-form-reload')).toHaveCount(0);
    }

    if (role === 'owner' || role === 'editor' || role === 'creator') {
      await expect(this.rootPage.getByTestId('nc-expanded-form-duplicate')).toBeVisible();
      await expect(this.rootPage.getByTestId('nc-expanded-form-delete')).toBeVisible();
    } else {
      await expect(this.rootPage.getByTestId('nc-expanded-form-duplicate')).toHaveCount(0);
      await expect(this.rootPage.getByTestId('nc-expanded-form-delete')).toHaveCount(0);
    }

    if (role === 'owner' || role === 'editor' || role === 'creator') {
      await expect(this.rootPage.getByTestId('nc-expanded-form-save')).toHaveCount(1);
    } else {
      await expect(this.rootPage.getByTestId('nc-expanded-form-save')).toHaveCount(0);
    }

    // Comments-input role gating. Panel mode: comments tab was opened above,
    // so `.nc-comment-input` is rendered inside the panel root. Modal mode:
    // comments drawer is always inline with `.nc-comments-drawer` wrapper.
    //
    // In modal mode the drawer mounts via Ant Design Tabs (default tab is
    // `comments`), but on slower CI runners the comments pane can take a beat
    // longer than the default 14s polling window — wait for the drawer
    // wrapper to be visible first, then assert the input count separately.
    if (panelMode) {
      if (role === 'viewer') {
        await expect(this.get().locator('.nc-comment-input')).toHaveCount(0);
      } else {
        await expect(this.get().locator('.nc-comment-input')).toHaveCount(1);
      }
    } else {
      await this.get().locator('.nc-comments-drawer').waitFor({ state: 'visible', timeout: 30000 });
      if (role === 'viewer') {
        await expect(this.get().locator('.nc-comments-drawer .nc-comment-input')).toHaveCount(0);
      } else {
        await expect(this.get().locator('.nc-comments-drawer .nc-comment-input')).toHaveCount(1, { timeout: 30000 });
      }
    }

    // press escape to close the expanded form
    await this.close();
  }

  async moveToNextField() {
    await this.btn_nextField.click();
  }

  async moveToPreviousField() {
    await this.btn_previousField.click();
  }

  async verifyTableNameShown({ name }: { name: string }) {
    return await expect(this.span_tableName).toContainText(name);
  }

  async verifyIsInFieldsMode() {
    return await expect(this.span_modeFields).toHaveClass(/active/);
  }

  async verifyIsInFilesMode() {
    return await expect(this.span_modeFiles).toHaveClass(/active/);
  }

  async switchToFieldsMode() {
    await this.span_modeFields.click();
  }

  async switchToFilesMode() {
    await this.span_modeFiles.click();
  }

  async verifyFilesViewerMode({ mode }: { mode: 'image' | 'video' | 'audio' | 'pdf' | 'unsupported' }) {
    await expect(this.get().locator(`.nc-files-mode-container .nc-files-viewer-${mode}`)).toBeVisible();
  }

  async verifyPreviewCellsCount({ count }: { count: number }) {
    await expect(this.get().locator(`.nc-files-mode-container .nc-files-preview-cell`)).toHaveCount(count);
  }

  async selectNthFilePreviewCell({ index }: { index: number }) {
    await this.get().locator(`.nc-files-mode-container .nc-files-preview-cell`).nth(index).click();
  }
}
