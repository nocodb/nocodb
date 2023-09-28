import { expect } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { ToolbarPage } from '../common/Toolbar';
import { TopbarPage } from '../common/Topbar';

export class KanbanPage extends BasePage {
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
    return this.dashboard.get().locator('[data-testid="nc-kanban-wrapper"]');
  }

  card(index: number) {
    return this.get().locator(`.ant-card`).nth(index);
  }

  async openExpandedRow({ index }: { index: number }) {
    await this.card(index).click();
    await (await this.rootPage.locator('.ant-drawer-body').elementHandle())?.waitForElementState('stable');
  }

  // todo: Implement
  async addOption() {}

  async dragDropCard(param: { from: { stack: number; card: number }; to: { stack: number; card: number } }) {
    const { from, to } = param;
    const srcStack = this.get().locator(`.nc-kanban-stack`).nth(from.stack);
    const dstStack = this.get().locator(`.nc-kanban-stack`).nth(to.stack);
    const fromCard = srcStack.locator(`.nc-kanban-item`).nth(from.card);
    const toCard = dstStack.locator(`.nc-kanban-item`).nth(to.card);

    console.log(await fromCard.allTextContents());
    console.log(await toCard.allTextContents());

    await fromCard.dragTo(toCard, {
      force: true,
      sourcePosition: { x: 10, y: 10 },
      targetPosition: { x: 10, y: 10 },
    });
  }

  async dragDropStack(param: { from: number; to: number }) {
    const { from, to } = param;
    const [fromStack, toStack] = await Promise.all([
      this.rootPage.locator(`.nc-kanban-stack-head`).nth(from),
      this.rootPage.locator(`.nc-kanban-stack-head`).nth(to),
    ]);
    await fromStack.dragTo(toStack);
  }

  async verifyStackCount(param: { count: number }) {
    const { count } = param;
    await expect(this.get().locator(`.nc-kanban-stack`)).toHaveCount(count);
  }

  async verifyStackOrder(param: { order: string[] }) {
    await this.rootPage.waitForTimeout(1000);
    const { order } = param;
    const stacks = await this.get().locator(`.nc-kanban-stack`).count();
    for (let i = 0; i < stacks; i++) {
      const stack = this.get().locator(`.nc-kanban-stack`).nth(i);
      await stack.scrollIntoViewIfNeeded();
      // Since otherwise stack title will be repeated as title is in two divs, with one having hidden class
      const stackTitle = stack.locator(`.nc-kanban-stack-head >> [data-testid="truncate-label"]`);
      await expect(stackTitle).toHaveText(order[i], { ignoreCase: true });
    }
  }

  async verifyStackFooter(param: { count: number[] }) {
    const { count } = param;
    const stacks = await this.get().locator(`.nc-kanban-stack`).count();
    for (let i = 0; i < stacks; i++) {
      const stack = this.get().locator(`.nc-kanban-stack`).nth(i);
      await stack.scrollIntoViewIfNeeded();
      const stackFooter = await stack.locator(`.nc-kanban-data-count`).innerText();
      expect(stackFooter).toContain(`${count[i]} record${count[i] !== 1 ? 's' : ''}`);
    }
  }

  async verifyCardCount(param: { count: number[] }) {
    const { count } = param;
    const stacks = await this.get().locator(`.nc-kanban-stack`).count();
    for (let i = 0; i < stacks; i++) {
      const stack = this.get().locator(`.nc-kanban-stack`).nth(i);
      await stack.scrollIntoViewIfNeeded();
      const stackCards = stack.locator(`.nc-kanban-item`);
      await expect(stackCards).toHaveCount(count[i]);
    }
  }

  async verifyCardOrder(param: { order: string[]; stackIndex: number }) {
    const { order, stackIndex } = param;

    const stack = this.get().locator(`.nc-kanban-stack`).nth(stackIndex);
    for (let i = 0; i < order.length; i++) {
      const card = stack.locator(`.nc-kanban-item`).nth(i);

      await (await card.elementHandle())?.waitForElementState('stable');

      await card.scrollIntoViewIfNeeded();
      const cardTitle = card.locator(`.nc-cell`);
      await expect(cardTitle).toHaveText(order[i]);
    }
  }

  // todo: Wait for render to complete
  async waitLoading() {
    await this.rootPage.waitForTimeout(1000);
  }

  async addNewStack(param: { title: string }) {
    await this.toolbar.clickAddEditStack();
    await this.toolbar.addEditStack.addOption({ title: param.title });
  }

  async collapseStack(param: { index: number }) {
    await this.get().locator(`.nc-kanban-stack-head`).nth(param.index).click();
    const modal = this.rootPage.locator(`.nc-dropdown-kanban-stack-context-menu`);
    await modal.locator('.ant-dropdown-menu-item:has-text("Collapse Stack")').click();
  }

  async expandStack(param: { index: number }) {
    await this.rootPage.locator(`.nc-kanban-collapsed-stack`).nth(param.index).click();
  }

  async verifyCollapseStackCount(param: { count: number }) {
    await expect(this.rootPage.locator('.nc-kanban-collapsed-stack')).toHaveCount(param.count);
  }

  async addCard(param: { stackIndex: number }) {
    await this.get().locator(`.nc-kanban-stack-head`).nth(param.stackIndex).click();
    const modal = this.rootPage.locator(`.nc-dropdown-kanban-stack-context-menu`);
    await modal.locator('.ant-dropdown-menu-item:has-text("Add new record")').click();
  }

  async deleteStack(param: { index: number }) {
    await this.get().locator(`.nc-kanban-stack-head`).nth(param.index).click();
    const modal = this.rootPage.locator(`.nc-dropdown-kanban-stack-context-menu`);
    await modal.locator('.ant-dropdown-menu-item:has-text("Delete Stack")').click();
    const confirmationModal = this.rootPage.locator(`div.ant-modal-content`);
    await confirmationModal.locator(`button:has-text("Delete Stack")`).click();
  }
}
