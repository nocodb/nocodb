import 'mocha';
import nock from 'nock';
import { expect } from 'chai';

import {
  beforeEachAttachment,
  beforeEach as dataApiV3BeforeEach,
} from './beforeEach';
import { ncAxios } from './ncAxios';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';
describe('Attachment V3', () => {
  let testContext;
  let table;
  let urlPrefix: string;
  let testAxios;
  let ncAxiosPost: INcAxios['ncAxiosPost'];
  let ncAxiosGet: INcAxios['ncAxiosGet'];
  let ncAxiosPatch: INcAxios['ncAxiosPatch'];

  const base64Image =
    'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAADMElEQVR4nOzVwQnAIBQFQYXff81RUkQCOyDj1YOPnbXWPmeTRef+/3O/OyBjzh3CD95BfqICMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMO0TAAD//2Anhf4QtqobAAAAAElFTkSuQmCC';
  beforeEach(async function () {
    const imageBuffer = Buffer.from(base64Image, 'base64');
    testContext = await dataApiV3BeforeEach();

    testAxios = ncAxios(testContext);
    ncAxiosPost = testAxios.ncAxiosPost;
    ncAxiosGet = testAxios.ncAxiosGet;
    ncAxiosPatch = testAxios.ncAxiosPatch;
    const initResult = await beforeEachAttachment(testContext);

    table = initResult.table;
    urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;

    nock('http://myhost.local/files')
      .get('/image')
      // FIXME: increase if insert / update result is updated too fast
      // delay to ensure background not clear before list
      .delay(10)
      .reply(200, imageBuffer, {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="test-image.png"',
        'Content-Length': imageBuffer.length,
      } as any)
      .persist();
  });

  afterEach(function () {
    nock.cleanAll();
  });

  it('Upload file and update from url', async () => {
    const rsp = await ncAxiosPost({
      url: `${urlPrefix}/${table.id}/records`,
      body: [
        {
          fields: {
            Attachment: [
              {
                url: 'http://myhost.local/files/image',
              },
              {
                url: 'http://myhost.local/files/image',
              },
            ],
          },
        },
      ],
    });

    expect(rsp.body.records.length).to.eq(1);
    expect(rsp.body.records[0].fields.Attachment.length).to.eq(0);

    // FIXME: if 100 ms is not enough
    // wait 100 ms for background to kick off
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 100));

    const getRsp1 = await ncAxiosGet({
      url: `${urlPrefix}/${table.id}/records/${rsp.body.records[0].id}`,
    });
    expect(getRsp1.body.fields.Attachment.length).to.eq(2);
    expect(getRsp1.body.fields.Attachment[0].id).to.not.satisfy((id) =>
      id.startsWith('temp_'),
    );

    const patchRsp = await ncAxiosPatch({
      url: `${urlPrefix}/${table.id}/records`,
      body: [
        {
          id: getRsp1.body.id,
          fields: {
            Attachment: [
              {
                id: getRsp1.body.fields.Attachment[0].id,
              },
              {
                url: 'http://myhost.local/files/image',
              },
            ],
          },
        },
      ],
    });

    expect(patchRsp.body.records.length).to.eq(1);
    expect(patchRsp.body.records[0].fields.Attachment.length).to.eq(1);

    // FIXME: if 100 ms is not enough
    // wait 100 ms for background to kick off
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 100));

    const getRsp2 = await ncAxiosGet({
      url: `${urlPrefix}/${table.id}/records/${rsp.body.records[0].id}`,
    });
    expect(getRsp2.body.fields.Attachment.length).to.eq(2);
    expect(getRsp2.body.fields.Attachment[1].id).to.not.satisfy((id) =>
      id.startsWith('temp_'),
    );
    expect(getRsp2.body.fields.Attachment[0].id).to.eq(
      getRsp1.body.fields.Attachment[0].id,
    );
  });
  it('Upload file and update from base64', async () => {
    const rsp = await ncAxiosPost({
      url: `${urlPrefix}/${table.id}/records`,
      body: [
        {
          fields: {
            Attachment: [],
          },
        },
      ],
    });

    expect(rsp.body.records.length).to.eq(1);
    expect(rsp.body.records[0].fields.Attachment.length).to.eq(0);
    const recordId = rsp.body.records[0].id;
    const columnId = table.columns.find((col) => col.title === 'Attachment').id;

    const rspPatch1 = await ncAxiosPost({
      url: `${urlPrefix}/${table.id}/records/${recordId}/fields/${columnId}/upload`,
      body: {
        contentType: 'image/png',
        file: base64Image,
        filename: 'photo.png',
      },
    });

    expect(rspPatch1.body.fields.Attachment.length).to.eq(1);
    expect(rspPatch1.body.fields.Attachment[0].mimetype).to.eq('image/png');
    const rspPatch2 = await ncAxiosPost({
      url: `${urlPrefix}/${table.id}/records/${recordId}/fields/${columnId}/upload`,
      body: {
        contentType: 'image/png',
        file: base64Image,
        filename: 'photo.png',
      },
    });
    expect(rspPatch2.body.fields.Attachment.length).to.eq(2);
    expect(rspPatch2.body.fields.Attachment[1].mimetype).to.eq('image/png');
  });
  it('Upload file and update from url error due to cell limit', async () => {
    const isEE = !!process.env.EE;
    if (!isEE) {
      return true;
    }
    const attachments = Array.from({ length: 11 }).map((v) => ({
      url: 'http://myhost.local/files/image',
    }));
    const response = await ncAxiosPost({
      url: `${urlPrefix}/${table.id}/records`,
      body: [
        {
          fields: {
            Attachment: attachments,
          },
        },
      ],
      status: 422,
    });
    expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
  });
  it('Upload file and update from base64 error due to cell limit', async () => {
    const isEE = !!process.env.EE;
    if (!isEE) {
      return true;
    }

    const attachments = Array.from({ length: 10 }).map((v) => ({
      url: 'http://myhost.local/files/image',
    }));
    const rsp = await ncAxiosPost({
      url: `${urlPrefix}/${table.id}/records`,
      body: [
        {
          fields: {
            Attachment: attachments,
          },
        },
      ],
    });

    let retry = 0;
    let getRsp1;
    do {
      // wait until worker is done
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 200);
      });

      getRsp1 = await ncAxiosGet({
        url: `${urlPrefix}/${table.id}/records/${rsp.body.records[0].id}`,
      });
      retry++
    } while (getRsp1.body.fields.Attachment.length === 0 && retry < 50);

    const recordId = rsp.body.records[0].id;
    const columnId = table.columns.find((col) => col.title === 'Attachment').id;

    const rspPatch1 = await ncAxiosPost({
      url: `${urlPrefix}/${table.id}/records/${recordId}/fields/${columnId}/upload`,
      body: {
        contentType: 'image/png',
        file: base64Image,
        filename: 'photo.png',
      },
      status: 422,
    });

    expect(rspPatch1.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
  });
});
