import axios from 'axios';

const info: any = {
  initialized: false,
};

async function initialize(shareId, appId?: string) {
  info.cookie = '';

  if (!appId || appId === '') {
    appId = null;
  }

  const url = `https://airtable.com/${appId ? `${appId}/` : ''}${shareId}`;

  try {
    const hreq = await axios
      .get(url, {
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
      })
      .then((response) => {
        for (const ck of response.headers['set-cookie']) {
          info.cookie += ck.split(';')[0] + '; ';
        }
        return response.data;
      })
      .catch(() => {
        throw {
          message:
            'Invalid Shared Base ID :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://bit.ly/3x0OdXI for details',
        };
      });

    info.headers = JSON.parse(
      hreq.match(/(?<=var headers =)(.*)(?=;)/g)[0].trim(),
    );
    info.link = unicodeToChar(
      hreq.match(/(?<=fetch\(")(\\.*)(?=")/g)[0].trim(),
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
    console.log(e);
    info.initialized = false;
    if (e.message) {
      throw e;
    } else {
      throw {
        message:
          'Error processing Shared Base :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://bit.ly/3x0OdXI for details',
      };
    }
  }
}

async function read() {
  if (info.initialized) {
    const resreq = await axios('https://airtable.com' + info.link, {
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
    })
      .then((response) => {
        return response.data;
      })
      .catch(() => {
        throw {
          message:
            'Error Reading :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://bit.ly/3x0OdXI for details',
        };
      });

    return {
      schema: resreq.data,
      baseId: info.baseId,
      baseInfo: info.baseInfo,
    };
  } else {
    throw {
      message: 'Error Initializing :: please try again !!',
    };
  }
}

async function readView(viewId) {
  if (info.initialized) {
    const resreq = await axios(
      `https://airtable.com/v0.3/view/${viewId}/readData?` +
        `stringifiedObjectParams=${encodeURIComponent('{}')}&requestId=${
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
      },
    )
      .then((response) => {
        return response.data;
      })
      .catch(() => {
        throw {
          message:
            'Error Reading View :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://bit.ly/3x0OdXI for details',
        };
      });
    return { view: resreq.data };
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
  )
    .then((response) => {
      return response.data;
    })
    .catch(() => {
      throw {
        message:
          'Error Fetching :: Ensure www.airtable.com/templates/featured/<TemplateID> is accessible.',
      };
    });
  return { template: resreq };
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
