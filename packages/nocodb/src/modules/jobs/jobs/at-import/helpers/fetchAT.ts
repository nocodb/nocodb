import { Logger } from '@nestjs/common';
import axios from 'axios';
import { streamObject } from 'stream-json/streamers/StreamObject';
import { parser } from 'stream-json/Parser';
import { ignore } from 'stream-json/filters/Ignore';
import { ATImportEngine } from '../engine';

const logger = new Logger('FetchAT');

function parseJsonStream(
  source: NodeJS.ReadableStream,
  ignoreFilter: string,
): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    let rejected = false;

    const parserStream = parser();
    const ignoreStream = ignore({ filter: ignoreFilter });
    const objectStream = (source as any)
      .pipe(parserStream)
      .pipe(ignoreStream)
      .pipe(streamObject());

    const rejectOnce = (err) => {
      if (rejected) return;
      rejected = true;
      (source as any).destroy();
      parserStream.destroy();
      ignoreStream.destroy();
      objectStream.destroy();
      reject(err);
    };

    const result: Record<string, any> = Object.create(null);

    objectStream.on('data', (chunk) => {
      if (chunk.key) result[chunk.key] = chunk.value;
    });

    // .pipe() does not propagate errors — attach handlers to every stream
    source.on('error', rejectOnce);
    parserStream.on('error', rejectOnce);
    ignoreStream.on('error', rejectOnce);
    objectStream.on('error', rejectOnce);

    objectStream.on('end', () => {
      resolve(result);
    });
  });
}

export interface ATSession {
  shareId: string;
  cookie: string;
  headers: Record<string, string>;
  link: string;
  baseInfo: Record<string, any>;
  baseId: string;
}

// Airtable moved the read URL from an inline `fetch("…")` into
// `var urlWithParams = "…"`; both forms are accepted
export function extractReadLink(html: string): string | undefined {
  const match =
    html.match(/(?<=var urlWithParams = ")(\\[^"]*)(?=")/) ??
    html.match(/(?<=fetch\(")(\\.*)(?=")/);
  return match?.[1].trim();
}

export function prepareReadLink(link: string) {
  // a base read only needs the schema, but a view read's rows are the payload
  const exclude = !link.includes('/readSharedViewData');
  return (
    link
      .replace(
        `%22mayExcludeCellDataForLargeViews%22%3A${!exclude}`,
        `%22mayExcludeCellDataForLargeViews%22%3A${exclude}`,
      )
      // Airtable now defaults to MessagePack responses — force JSON
      .replace(
        '%22allowMsgpackOfResult%22%3Atrue',
        '%22allowMsgpackOfResult%22%3Afalse',
      )
  );
}

// JSON params are merged in; a shared view's access policy has `=` inside
// its values, so they are not split by hand
export function parseReadLinkParams(link: string) {
  const result: Record<string, any> = Object.create(null);
  const params = new URLSearchParams(link.split('?')[1] ?? '');
  for (const [key, value] of params) {
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = undefined;
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.assign(result, parsed);
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function initialize(shareId, appId?: string): Promise<ATSession> {
  let cookie = '';

  if (!appId || appId === '') {
    appId = null;
  }

  try {
    const hreq = await ATImportEngine.get().initialize({ appId, shareId });

    for (const ck of hreq.headers['set-cookie']) {
      cookie += ck.split(';')[0] + '; ';
    }

    const data = hreq.data;

    const headers = data.match(/(?<=var headers =)(.*)(?=;)/g);
    const rawLink = extractReadLink(data);

    if (!headers || !rawLink) {
      throw {
        message:
          'This Airtable link is not publicly accessible. Use a shared base or shared view link without a password or sign-in restriction. Refer https://dub.sh/import-airtable-to-nocodb for details',
      };
    }

    const link = prepareReadLink(unicodeToChar(rawLink));
    const baseInfo = parseReadLinkParams(link);

    return {
      shareId,
      cookie,
      headers: JSON.parse(headers[0].trim()),
      link,
      baseInfo,
      baseId: baseInfo.applicationId,
    };
  } catch (e) {
    logger.log(e);
    if (e?.response?.status === 404) {
      throw {
        message:
          'Airtable link not found :: Check the link, and that sharing is still turned on for the base or view',
      };
    } else if (e?.response?.status) {
      throw {
        message: `Airtable link could not be opened (HTTP ${e.response.status}). Refer https://dub.sh/import-airtable-to-nocodb for details`,
      };
    } else if (e.message) {
      throw e;
    } else {
      throw {
        message:
          'Error processing Shared Base :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://dub.sh/import-airtable-to-nocodb for details',
      };
    }
  }
}

async function read(session: ATSession) {
  if (!session) {
    throw {
      message: 'Error Initializing :: please try again !!',
    };
  }

  try {
    const resreq = await ATImportEngine.get().read(session);

    const data: any = await parseJsonStream(resreq.data, 'data.tableDatas');

    if (data?.data) {
      return {
        schema: data?.data,
        baseId: session.baseId,
        baseInfo: session.baseInfo,
      };
    } else {
      throw new Error('Error reading Airtable schema: empty response');
    }
  } catch (e) {
    logger.log(e);
    throw {
      message:
        'Error reading Airtable schema: received an unexpected response format from Airtable',
    };
  }
}

async function readView(viewId, session: ATSession) {
  if (!session) {
    throw {
      message: 'Error Initializing :: please try again !!',
    };
  }

  try {
    const resreq = await ATImportEngine.get().readView(viewId, session);

    const data: any = await parseJsonStream(resreq.data, 'data.rowOrder');

    if (data?.data) {
      return { view: data.data };
    } else {
      throw new Error('Error reading Airtable view: empty response');
    }
  } catch (e) {
    logger.log(e);
    throw {
      message:
        'Error reading Airtable view: received an unexpected response format from Airtable',
    };
  }
}

async function readTemplate(templateId) {
  const session = await initialize('shrO8aYf3ybwSdDKn');

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
          cookie: session.cookie,
          ...session.headers,
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
