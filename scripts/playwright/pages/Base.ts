import { Page, expect, Locator } from "@playwright/test";

type ResponseSelector = (json: any) => boolean;

export default abstract class BasePage {
  readonly rootPage: Page;

  abstract get(args?: any): Locator;

  constructor(rootPage: Page) {
    this.rootPage = rootPage;
  }

  async toastWait({ message }: { message: string }) {
    // todo: text of toaster shows old one in the test assertion
    await this.rootPage
      .locator(".ant-message .ant-message-notice-content", { hasText: message })
      .last()
      .textContent()
      .then((text) => expect(text).toContain(message));

    // await this.rootPage
    //   .locator(".ant-message .ant-message-notice-content", { hasText: message })
    //   .last()
    //   .waitFor({ state: "detached" });
  }

  async waitForResponse({
    uiAction,
    httpMethodsToMatch = [],
    requestUrlPathToMatch,
    responseJsonMatcher,
  }: {
    uiAction: Promise<any>;
    requestUrlPathToMatch: string;
    httpMethodsToMatch?: string[];
    responseJsonMatcher?: ResponseSelector;
  }) {
    await Promise.all([
      this.rootPage.waitForResponse(async (res) => {
        let isResJsonMatched = true;
        if(responseJsonMatcher){
          try {
            isResJsonMatched = responseJsonMatcher(await res.json());
          } catch (e) {
            return false;
          }
        }

        return (
          res.request().url().includes(requestUrlPathToMatch) &&
          httpMethodsToMatch.includes(res.request().method()) &&
          isResJsonMatched
          );
      }),
      uiAction,
    ]);
  }
}
