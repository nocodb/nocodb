import axios from 'axios';
import Airtable from 'airtable';
import { ATMockImportEngine, MockAirtable } from './mock';
import type { AirtableBase } from 'airtable/lib/airtable_base';
import { isPlayWrightNode } from '~/helpers/utils';

export class ATImportEngine extends ATMockImportEngine {
  static get() {
    if (isPlayWrightNode()) {
      return new ATMockImportEngine();
    }
    return new ATImportEngine();
  }

  async initialize({ appId, shareId }: { appId: string; shareId: string }) {
    const url = `https://airtable.com/${appId ? `${appId}/` : ''}${shareId}`;
    return await axios.get(url, {
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-language': 'en-US,en;q=0.9',
        'sec-ch-ua':
          '" Not A;Brand";v="99", "Chromium";v="100", "Google Chrome";v="100"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36',
      },
      // @ts-ignore
      referrerPolicy: 'strict-origin-when-cross-origin',
      body: null,
      method: 'GET',
    });
  }

  async read(info: { link: string; cookie: string; headers: any }) {
    return await axios('https://airtable.com' + info.link, {
      headers: {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'sec-ch-ua':
          '" Not A;Brand";v="99", "Chromium";v="100", "Google Chrome";v="100"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36',
        'x-time-zone': 'Europe/Berlin',
        cookie: info.cookie,
        ...info.headers,
      },
      // @ts-ignore
      referrerPolicy: 'no-referrer',
      body: null,
      method: 'GET',
      responseType: 'stream',
    });
  }

  async readView(
    viewId: string,
    info: { cookie: string; headers: any; baseInfo: any },
  ) {
    return await axios(
      `https://airtable.com/v0.3/view/${viewId}/readData?` +
        `stringifiedObjectParams=${encodeURIComponent(
          JSON.stringify({
            mayOnlyIncludeRowAndCellDataForIncludedViews: true,
            mayExcludeCellDataForLargeViews: true,
          }),
        )}&requestId=${
          info.baseInfo.requestId
        }&accessPolicy=${encodeURIComponent(
          JSON.stringify({
            allowedActions: info.baseInfo.allowedActions,
            shareId: info.baseInfo.shareId,
            applicationId: info.baseInfo.applicationId,
            generationNumber: info.baseInfo.generationNumber,
            expires: info.baseInfo.expires,
            signature: info.baseInfo.signature,
          }),
        )}`,
      {
        headers: {
          accept: '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'sec-ch-ua':
            '" Not A;Brand";v="99", "Chromium";v="100", "Google Chrome";v="100"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Linux"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36',
          'x-time-zone': 'Europe/Berlin',
          cookie: info.cookie,
          ...info.headers,
        },
        // @ts-ignore
        referrerPolicy: 'no-referrer',
        body: null,
        method: 'GET',
        responseType: 'stream',
      },
    );
  }

  atBase({ apiKey, baseId }: { apiKey: string; baseId: string }) {
    if (process.env.DEBUG_MOCK_AIRTABLE_IMPORT === 'true') {
      return ((title) => new MockAirtable(title)) as any as AirtableBase;
    }
    return new Airtable({ apiKey: apiKey }).base(baseId);
  }
}
