// playwright-dev-page.ts
import { Page, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async toastWait({message}: {message: string}) {
    const toast = await this.page.locator('.ant-message .ant-message-notice-content', {hasText: message}).last();
    await toast.waitFor({state: 'visible'});

    // todo: text of toastr shows old one in the test assertion
    await toast.last().textContent()
      .then((text) => expect(text).toContain(message));
  }
}