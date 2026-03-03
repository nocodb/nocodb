import { Logger } from '@nestjs/common';
import axios from 'axios';
import { streamObject } from 'stream-json/streamers/StreamObject';
import { parser } from 'stream-json/Parser';
import { ignore } from 'stream-json/filters/Ignore';
import { ATImportEngine } from '../engine';

const logger = new Logger('FetchAT');

const info: any = {
  initialized: false,
};

async function initialize(shareId, appId?: string) {
  info.cookie = '';

  if (!appId || appId === '') {
    appId = null;
  }

  try {
    const hreq = await ATImportEngine.get().initialize({ appId, shareId });

    for (const ck of hreq.headers['set-cookie']) {
      info.cookie += ck.split(';')[0] + '; ';
    }

    const data = hreq.data;

    const headers = data.match(/(?<=var headers =)(.*)(?=;)/g);
    const link = data.match(/(?<=fetch\(")(\\.*)(?=")/g);

    if (!headers || !link) {
      throw {
        message:
          'Please ensure www.airtable.com/<SharedBaseID> is available for public access. Refer https://dub.sh/import-airtable-to-nocodb for details',
      };
    }

    info.headers = JSON.parse(
      data.match(/(?<=var headers =)(.*)(?=;)/g)[0].trim(),
    );

    info.link = unicodeToChar(
      data.match(/(?<=fetch\(")(\\.*)(?=")/g)[0].trim(),
    );

    info.link = info.link.replace(
      '%22mayExcludeCellDataForLargeViews%22%3Afalse',
      '%22mayExcludeCellDataForLargeViews%22%3Atrue',
    );

    info.baseInfo = decodeURIComponent(info.link)
      .match(/{(.*)}/g)[0]
      .split('&')
      .reduce((result, el) => {
        try {
          return Object.assign(
            result,
            JSON.parse(el.includes('=') ? el.split('=')[1] : el),
          );
        } catch (e) {
          if (el.includes('=')) {
            return Object.assign(result, {
              [el.split('=')[0]]: el.split('=')[1],
            });
          }
        }
      }, {});
    info.baseId = info.baseInfo.applicationId;
    info.initialized = true;
  } catch (e) {
    logger.log(e);
    info.initialized = false;
    if (e.message) {
      throw e;
    } else {
      throw {
        message:
          'Error processing Shared Base :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://dub.sh/import-airtable-to-nocodb for details',
      };
    }
  }
}

async function read() {
  if (info.initialized) {
    try {
      const resreq = await ATImportEngine.get().read(info);

      const data: any = await new Promise((resolve, reject) => {
        const jsonStream = resreq.data
          .pipe(parser())
          .pipe(ignore({ filter: 'data.tableDatas' }))
          .pipe(streamObject());

        const fullObject = {};

        jsonStream.on('data', (chunk) => {
          if (chunk.key) fullObject[chunk.key] = chunk.value;
        });

        jsonStream.on('error', (err) => {
          reject(err);
        });

        jsonStream.on('end', () => {
          resolve(fullObject);
        });
      });

      if (data?.data) {
        return {
          schema: data?.data,
          baseId: info.baseId,
          baseInfo: info.baseInfo,
        };
      } else {
        throw new Error('Error Reading :: Data missing');
      }
    } catch (e) {
      logger.log(e);
      throw {
        message:
          'Error Reading :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://dub.sh/import-airtable-to-nocodb for details',
      };
    }
  } else {
    throw {
      message: 'Error Initializing :: please try again !!',
    };
  }
}

async function readView(viewId) {
  if (info.initialized) {
    try {
      const resreq = await ATImportEngine.get().readView(viewId, info);

      const data: any = await new Promise((resolve, reject) => {
        const jsonStream = resreq.data
          .pipe(parser())
          .pipe(ignore({ filter: 'data.rowOrder' }))
          .pipe(streamObject());

        const fullObject = {};

        jsonStream.on('data', (chunk) => {
          if (chunk.key) fullObject[chunk.key] = chunk.value;
        });

        jsonStream.on('error', (err) => {
          reject(err);
        });

        jsonStream.on('end', () => {
          resolve(fullObject);
        });
      });

      if (data?.data) {
        return { view: data.data };
      } else {
        throw new Error('Error Reading :: Data missing');
      }
    } catch (e) {
      logger.log(e);
      throw {
        message:
          'Error Reading View :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://dub.sh/import-airtable-to-nocodb for details',
      };
    }
  } else {
    throw {
      message: 'Error Initializing :: please try again !!',
    };
  }
}

async function readTemplate(templateId) {
  if (!info.initialized) {
    await initialize('shrO8aYf3ybwSdDKn');
  }

  try {
    const resreq = await axios(
      `https://www.airtable.com/v0.3/exploreApplications/${templateId}`,
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
        referrer: 'https://www.airtable.com/',
        referrerPolicy: 'same-origin',
        body: null,
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
      },
    );

    if (resreq?.data) {
      return { template: resreq.data };
    } else {
      throw new Error('Error Reading :: Data missing');
    }
  } catch (e) {
    logger.log(e);
    throw {
      message:
        'Error Fetching :: Ensure www.airtable.com/templates/featured/<TemplateID> is accessible.',
    };
  }
}

function unicodeToChar(text) {
  return text.replace(/\\u[\dA-F]{4}/gi, function (match) {
    return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
  });
}

export default {
  initialize,
  read,
  readView,
  readTemplate,
};
