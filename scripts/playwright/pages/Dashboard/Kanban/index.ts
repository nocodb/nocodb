// playwright-dev-page.ts
import { Locator, expect } from "@playwright/test";
import { DashboardPage } from "..";
import BasePage from "../../Base";
import { ToolbarPage } from "../common/Toolbar";

export class KanbanPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly toolbar: ToolbarPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.toolbar = new ToolbarPage(this);
  }

  get() {
    return this.dashboard.get().locator('[data-pw="nc-kanban-wrapper"]');
  }

  card(index: number) {
    return this.get().locator(`.ant-card`).nth(index);
  }

  async openExpandedRow({ index }: { index: number }) {
    await this.card(index).click();
    await (
      await this.rootPage.locator(".ant-drawer-body").elementHandle()
    )?.waitForElementState("stable");
  }

  async addOption() {}

  async dragDropCard(param: { from: string; to: string }) {
    // const { from, to } = param;
    // const srcStack = await this.get().locator(`.nc-kanban-stack`).nth(1);
    // const dstStack = await this.get().locator(`.nc-kanban-stack`).nth(2);
    // const fromCard = await srcStack.locator(`.nc-kanban-item`).nth(1);
    // const toCard = await dstStack.locator(`.nc-kanban-item`).nth(1);
    // const [fromCard, toCard] = await Promise.all([
    //   srcStack.locator(`.nc-kanban-item[data-draggable="true"]`).nth(0),
    //   dstStack.locator(`.nc-kanban-item[data-draggable="true"]`).nth(0),
    // ]);
    // const fromCard = await this.get().locator(`.nc-kanban-item`).nth(0);
    // const toCard = await this.get().locator(`.nc-kanban-item`).nth(25);
    // await fromCard.dragTo(toCard);
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
    expect(await this.get().locator(`.nc-kanban-stack`).count()).toBe(count);
  }

  async verifyStackOrder(param: { order: string[] }) {
    const { order } = param;
    const stacks = await this.get().locator(`.nc-kanban-stack`).count();
    for (let i = 0; i < stacks; i++) {
      const stack = await this.get().locator(`.nc-kanban-stack`).nth(i);
      const stackTitle = await stack
        .locator(`.nc-kanban-stack-head`)
        .innerText();
      expect(stackTitle).toBe(order[i]);
    }
  }

  async verifyStackFooter(param: { count: number[] }) {
    const { count } = param;
    const stacks = await this.get().locator(`.nc-kanban-stack`).count();
    for (let i = 0; i < stacks; i++) {
      const stack = await this.get().locator(`.nc-kanban-stack`).nth(i);
      const stackFooter = await stack
        .locator(`.nc-kanban-data-count`)
        .innerText();
      expect(stackFooter).toContain(
        `${count[i]} record${count[i] !== 1 ? "s" : ""}`
      );
    }
  }

  async verifyCardCount(param: { count: number[] }) {
    const { count } = param;
    const stacks = await this.get().locator(`.nc-kanban-stack`).count();
    for (let i = 0; i < stacks; i++) {
      const stack = await this.get().locator(`.nc-kanban-stack`).nth(i);
      const stackCards = await stack.locator(`.nc-kanban-item`).count();
      expect(stackCards).toBe(count[i]);
    }
  }

  async verifyCardOrder(param: { order: string[]; stackIndex: number }) {
    const { order, stackIndex } = param;
    const stack = await this.get().locator(`.nc-kanban-stack`).nth(stackIndex);
    for (let i = 0; i < order.length; i++) {
      const card = await stack.locator(`.nc-kanban-item`).nth(i);
      const cardTitle = await card.locator(`.nc-cell`).innerText();
      expect(cardTitle).toBe(order[i]);
    }
  }

  async waitLoading() {
    await this.rootPage.waitForTimeout(1000);
  }
}
