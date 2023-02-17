import { Locator, Page } from '@playwright/test';

type ResponseSelector = (json: any) => boolean;

export default abstract class BasePage {
  readonly rootPage: Page;

  abstract get(args?: any): Locator;

  constructor(rootPage: Page) {
    this.rootPage = rootPage;
  }

  async verifyToast({ message }: { message: string }) {
    await this.rootPage.locator('.ant-message .ant-message-notice-content', { hasText: message }).last().isVisible();
  }

  async waitForResponse({
    // Playwright action that triggers the request i.e locatorSomething.click()
    uiAction,
    httpMethodsToMatch = [],
    requestUrlPathToMatch,
    // A function that takes the response body and returns true if the response is the one we are looking for
    responseJsonMatcher,
  }: {
    uiAction: () => Promise<any>;
    requestUrlPathToMatch: string;
    httpMethodsToMatch?: string[];
    responseJsonMatcher?: ResponseSelector;
  }) {
    const waitForResponsePromise = this.rootPage.waitForResponse(async res => {
      let isResJsonMatched = true;
      if (responseJsonMatcher) {
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
    });

    const uiActionPromise = uiAction();

    await Promise.all([waitForResponsePromise, uiActionPromise]);
  }

  async attachFile({ filePickUIAction, filePath }: { filePickUIAction: Promise<any>; filePath: string[] }) {
    const [fileChooser] = await Promise.all([
      // It is important to call waitForEvent before click to set up waiting.
      this.rootPage.waitForEvent('filechooser'),
      // Opens the file chooser.
      filePickUIAction,
    ]);
    await fileChooser.setFiles(filePath);
  }

  async downloadAndGetFile({ downloadUIAction }: { downloadUIAction: Promise<any> }) {
    const [download] = await Promise.all([
      // It is important to call waitForEvent before click to set up waiting.
      this.rootPage.waitForEvent('download'),
      // Triggers the download.
      downloadUIAction,
    ]);
    // wait for download to complete
    if (await download.failure()) {
      throw new Error('Download failed');
    }

    const file = await download.createReadStream();
    const data = await new Promise((resolve, reject) => {
      let data = '';
      file?.on('data', chunk => (data += chunk));
      file?.on('end', () => resolve(data));
      file?.on('error', reject);
    });
    return data as any;
  }

  async getClipboardText() {
    return await this.rootPage.evaluate(() => navigator.clipboard.readText());
  }

  async os() {
    return await this.rootPage.evaluate(() => navigator.platform);
  }

  async isMacOs() {
    return (await this.os()).includes('Mac');
  }
}
