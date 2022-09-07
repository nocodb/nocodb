import dayjs from 'dayjs';
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

export const dateFormat = [
    'DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD',
    'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY/MM/DD',
    'DD MM YYYY', 'MM DD YYYY', 'YYYY MM DD'
]

export function validateDateFormat(v) {
    return dateFormat.includes(v)
}

export function validateDateWithUnknownFormat(v) {
    let res = 0;
    for (const format of dateFormat) {
      res |= dayjs(v.toString(), format, true).isValid();
    }
    return res;
}