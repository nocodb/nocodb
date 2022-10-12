import { Page, expect, Locator } from "@playwright/test";

export default abstract class BasePage {
  readonly rootPage: Page;

  abstract get(args: any): Locator;

  constructor(rootPage: Page) {
    this.rootPage = rootPage;
  }

  async toastWait ({message}: {message: string}){
    // const toast = await this.page.locator('.ant-message .ant-message-notice-content', {hasText: message}).last();
    // await toast.waitFor({state: 'visible'});
  
    // todo: text of toastr shows old one in the test assertion
    await this.rootPage.locator('.ant-message .ant-message-notice-content', {hasText: message}).last().textContent()
      .then((text) => expect(text).toContain(message));
  }

  async assertInnerTextWithRetry({locator, text, retryCount = 5, retryInterval = 100}: {locator: Locator, text: string, retryCount?: number, retryInterval?: number}) {
    for(let i = 0; i < retryCount; i++) {
      const innerText = await locator.innerText();
      if(innerText === text) {
        break;
      }
      await this.rootPage.waitForTimeout(retryInterval);
    }
    return expect(await locator.innerText()).toBe(text);
  }

  async assertNotInnerTextWithRetry({locator, text, retryCount = 5, retryInterval = 100}: {locator: Locator, text: string, retryCount?: number, retryInterval?: number}) {
    for(let i = 0; i < retryCount; i++) {
      const innerText = await locator.innerText();
      if(innerText !== text) {
        break;
      }
      await this.rootPage.waitForTimeout(retryInterval);
    }
    return expect(await locator.innerText()).not.toBe(text);
  }
}