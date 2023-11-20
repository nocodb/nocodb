import { Locator, Page } from '@playwright/test';
import { readFileSync } from 'fs';

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
    timeout,
  }: {
    uiAction: () => Promise<any>;
    requestUrlPathToMatch: string;
    httpMethodsToMatch?: string[];
    responseJsonMatcher?: ResponseSelector;
    timeout?: number;
  }) {
    const [res] = await Promise.all([
      this.rootPage.waitForResponse(
        res =>
          res.url().includes(requestUrlPathToMatch) &&
          res.status() === 200 &&
          httpMethodsToMatch.includes(res.request().method()),
        timeout ? { timeout } : undefined
      ),
      uiAction(),
    ]);

    // handle JSON matcher if provided
    let isResJsonMatched = true;
    if (responseJsonMatcher) {
      try {
        isResJsonMatched = responseJsonMatcher(res.json());
      } catch {
        isResJsonMatched = false;
      }
    }
    return isResJsonMatched;
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

  async copyToClipboard({ text }: { text: string }) {
    await this.rootPage.evaluate(text => navigator.clipboard.writeText(text), text);
  }

  async os() {
    return await this.rootPage.evaluate(() => navigator.platform);
  }

  async isMacOs() {
    return (await this.os()).includes('Mac');
  }

  async dropFile({ imageFilePath, domSelector }: { imageFilePath?: string; domSelector: string }) {
    const buffer = readFileSync(imageFilePath).toString('base64');

    const dataTransfer = await this.rootPage.evaluateHandle(
      async ({ bufferData, localFileName, localFileType }) => {
        const dt = new DataTransfer();

        const blobData = await fetch(bufferData).then(res => res.blob());

        const file = new File([blobData], localFileName, { type: localFileType });
        dt.items.add(file);
        return dt;
      },
      {
        bufferData: `data:application/octet-stream;base64,${buffer}`,
        localFileName: 'test.png',
        localFileType: 'image/png',
      }
    );

    await this.rootPage.dispatchEvent(domSelector, 'drop', { dataTransfer });
  }

  // async copyImageToClipboard({ imageFilePath, domSelector }: { imageFilePath?: string; domSelector: string }) {
  //   const pasteEvent = await this.rootPage.evaluate(async () => {
  //     const base64 = `data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAUA
  //     AAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO
  //         9TXL0Y4OHwAAAABJRU5ErkJggg==`;

  //     const response = await fetch(base64);
  //     const blob = await response.blob();

  //     const clipboardData = new DataTransfer();
  //     clipboardData.items.add(new File([blob], 'foo.png', { type: blob.type }));
  //     let pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
  //     pasteEvent = Object.assign(pasteEvent, {
  //       clipboardData,
  //     });

  //     return pasteEvent;
  //   });

  //   await this.rootPage.dispatchEvent(domSelector, 'paste', { pasteEvent });
  // }
}
