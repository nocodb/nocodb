import { Page, expect, Locator } from "@playwright/test";

type ResponseSelector = (json: any) => boolean;

export default abstract class BasePage {
  readonly rootPage: Page;

  abstract get(args: any): Locator;

  constructor(rootPage: Page) {
    this.rootPage = rootPage;
  }

  async toastWait ({message}: {message: string}){
    // todo: text of toastr shows old one in the test assertion
    await this.rootPage.locator('.ant-message .ant-message-notice-content', {hasText: message}).last().textContent()
      .then((text) => expect(text).toContain(message));

    // await this.rootPage.locator('.ant-message .ant-message-notice-content', {hasText: message}).last().waitFor({state: 'detached'});

  }

  async waitForResponseJson({responseSelector}:{ responseSelector: ResponseSelector }) {
    await this.rootPage.waitForResponse(async (res) => {
      try {
        return responseSelector(await res.json());
      } catch(e) {
        return false;
      }
    });
  }
}