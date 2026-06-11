import { Readable } from 'node:stream';
import {
  initializeHeader,
  initializeHtml,
  readResponse,
  viewsResponse,
} from './mockResponses';
import { mockResponseData } from './mockResponseData';
import type { AirtableBase } from 'airtable/lib/airtable_base';
import type { FieldSet, Records } from 'airtable';
import type { AxiosResponse } from 'axios';

export class ATMockImportEngine {
  async initialize(_param: { appId: string; shareId: string }) {
    return {
      data: initializeHtml, // ← this is what axios returns
      status: 200,
      statusText: 'OK',
      headers: initializeHeader,
      config: {},
    } as AxiosResponse;
  }

  async read(_info: { link: string; cookie: string; headers: any }) {
    const stream = Readable.from([JSON.stringify(readResponse)]);
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
