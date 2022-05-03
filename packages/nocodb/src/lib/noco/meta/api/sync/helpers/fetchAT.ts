const axios = require('axios').default;

export default async function main(shareId, tableId?, viewId?) {
  let Cookie = '';
  let url = `https://airtable.com/${shareId}`;
  if (tableId && viewId)
    url = `https://airtable.com/${shareId}/${tableId}/${viewId}`;

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
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36'
      },
      referrerPolicy: 'strict-origin-when-cross-origin',
      body: null,
      method: 'GET'
    })
    .then(response => {
      for (const ck of response.headers['set-cookie']) {
        Cookie += ck.split(';')[0] + '; ';
      }
      return response.data;
    });

  const headers = JSON.parse(
    hreq.match(/(?<=var headers =)(.*)(?=;)/g)[0].trim()
  );
  const lnk = unicodeToChar(hreq.match(/(?<=fetch\(")(.*)(?=")/g)[0].trim());
  const baseInfo = decodeURIComponent(lnk)
    .match(/{(.*)}/g)[0]
    .split('&')
    .reduce((result, el) => {
      try {
        return Object.assign(
          result,
          JSON.parse(el.includes('=') ? el.split('=')[1] : el)
        );
      } catch (e) {
        if (el.includes('=')) {
          return Object.assign(result, {
            [el.split('=')[0]]: el.split('=')[1]
          });
        }
      }
    }, {});
  const baseId = baseInfo.applicationId;

  const resreq = await axios('https://airtable.com' + lnk, {
    headers: {
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua':
        '" Not A;Brand";v="99", "Chromium";v="100", "Google Chrome";v="100"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-time-zone': 'Europe/Istanbul',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36',
      accept: 'application/json, text/javascript, */*; q=0.01',
      cookie: Cookie,
      ...headers
    },
    referrerPolicy: 'no-referrer',
    body: null,
    method: 'GET'
  })
    .then(response => {
      return response.data;
    })
    .catch(_error => {
      throw 'Error while fetching';
    });

  return { schema: resreq.data, baseId, baseInfo };
}

function unicodeToChar(text) {
  return text.replace(/\\u[\dA-F]{4}/gi, function(match) {
    return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
  });
}
