import { Readable } from 'node:stream';
import {
  displayValueReadResponse,
  initializeHeader,
  initializeHtml,
  readResponse,
  viewsResponse,
} from './mockResponses';
import { mockResponseData } from './mockResponseData';
import type { AirtableBase } from 'airtable/lib/airtable_base';
import type { FieldSet, Records } from 'airtable';
import type { AxiosResponse } from 'axios';

// Share id that selects the display-value schema fixture instead of the default
// one. See mockResponses/readDisplayValue.ts.
export const MOCK_SHARE_ID_DISPLAY_VALUE = 'shrDisplayValueMock';

// `read()` is not told which share was requested — FetchAT derives its `info`
// from the initialize HTML, which is a fixture with its own baked-in ids — so
// remember the requested share id here. `ATImportEngine.get()` returns a new
// instance per call, hence module scope. Imports are sequential per process.
let requestedShareId: string | undefined;

export class ATMockImportEngine {
  async initialize(_param: { appId: string; shareId: string }) {
    requestedShareId = _param?.shareId;
    return {
      data: initializeHtml, // ← this is what axios returns
      status: 200,
      statusText: 'OK',
      headers: initializeHeader,
      config: {},
    } as AxiosResponse;
  }

  async read(_info: { link: string; cookie: string; headers: any }) {
    const schema =
      requestedShareId === MOCK_SHARE_ID_DISPLAY_VALUE
        ? displayValueReadResponse
        : readResponse;
    const stream = Readable.from([JSON.stringify(schema)]);
    return {
      data: stream, // ← this is what axios returns
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as AxiosResponse;
  }

  async readView(viewId: string, _info: { baseInfo: any }) {
    const stream = Readable.from([JSON.stringify(viewsResponse[viewId])]);
    return {
      data: stream, // ← this is what axios returns
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as AxiosResponse;
  }

  atBase(_param: { apiKey: string; baseId: string }) {
    return ((title) => new MockAirtable(title)) as any as AirtableBase;
  }
}

export class MockAirtable {
  constructor(protected readonly title: string) {}
  select(_selectParams: any) {
    return this;
  }
  eachPage(
    pageHandle: (
      records: Records<FieldSet>,
      fetchNextPage: () => void,
    ) => Promise<void>,
    done: (err: any) => Promise<void>,
  ) {
    void (async () => {
      let cursor = 0;
      let currentRecord = mockResponseData[this.title][cursor++];
      while (currentRecord) {
        await pageHandle(currentRecord.records, () => {
          currentRecord = mockResponseData[this.title][cursor++];
        });
      }
      done(undefined);
    })();
  }
}
