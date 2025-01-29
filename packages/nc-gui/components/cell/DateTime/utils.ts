import { timeFormats } from 'nocodb-sdk'

export const timeFormatsObj = {
  [timeFormats[0]]: 'hh:mm A',
  [timeFormats[1]]: 'hh:mm:ss A',
  [timeFormats[2]]: 'hh:mm:ss.SSS A',
}

export const timeCellMaxWidthMap = {
  [timeFormats[0]]: {
    12: 'max-w-[85px]',
    24: 'max-w-[65px]',
  },
  [timeFormats[1]]: {
    12: 'max-w-[100px]',
    24: 'max-w-[80px]',
  },
  [timeFormats[2]]: {
    12: 'max-w-[130px]',
    24: 'max-w-[110px]',
  },
}
