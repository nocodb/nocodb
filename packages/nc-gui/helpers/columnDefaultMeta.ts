import { UITypes, dateFormats, timeFormats } from 'nocodb-sdk'

export const precisionFormats = [1, 2, 3, 4, 5, 6, 7, 8]

export const iconList = [
  {
    full: 'mdi-star',
    empty: 'mdi-star-outline',
  },
  {
    full: 'mdi-heart',
    empty: 'mdi-heart-outline',
  },
  {
    full: 'mdi-moon-full',
    empty: 'mdi-moon-new',
  },
  {
    full: 'mdi-thumb-up',
    empty: 'mdi-thumb-up-outline',
  },
  {
    full: 'mdi-flag',
    empty: 'mdi-flag-outline',
  },
]

export const supportedBarcodeFormats = [
  { value: 'CODE128', label: 'CODE128' },
  { value: 'upc', label: 'UPC' },
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'EAN8', label: 'EAN-8' },
  { value: 'EAN5', label: 'EAN-5' },
  { value: 'EAN2', label: 'EAN-2' },
  { value: 'CODE39', label: 'CODE39' },
  { value: 'ITF14', label: 'ITF-14' },
  { value: 'MSI', label: 'MSI' },
  { value: 'PHARMACODE', label: 'PHARMACODE' },
  { value: 'CODABAR', label: 'CODABAR' },
]

const barcodeDefaultMeta = {
  barcodeFormat: supportedBarcodeFormats[0].value,
}

const checkboxDefaultMeta = {
  iconIdx: 0,
  icon: {
    checked: 'mdi-check-bold',
    unchecked: 'mdi-crop-square',
  },
  color: '#777',
}

const currencyDefaultMeta = {
  currency_locale: 'en-US',
  currency_code: 'USD',
}

const dateDefaultMeta = {
  date_format: dateFormats[0],
}

const dateTimeDefaultMeta = {
  date_format: dateFormats[0],
  time_format: timeFormats[0],
  is12hrFormat: false,
}

const decimalDefaultMeta = {
  precision: precisionFormats[0],
  isLocaleString: false,
}

const durationDefaultMeta = {
  duration: 0,
}

const numberDefaultMeta = {
  isLocaleString: false,
}

const percentDefaultMeta = {
  is_progress: false,
}

const ratingDefaultMeta = {
  iconIdx: 0,
  icon: {
    full: 'mdi-star',
    empty: 'mdi-star-outline',
  },
  color: '#fcb401',
  max: 5,
}

const timeDefaultMeta = {
  is12hrFormat: false,
}

const userDefaultMeta = {
  is_multi: false,
  notify: false,
}

export const columnDefaultMeta = {
  [UITypes.Checkbox]: checkboxDefaultMeta,
  [UITypes.Currency]: currencyDefaultMeta,
  [UITypes.Date]: dateDefaultMeta,
  [UITypes.DateTime]: dateTimeDefaultMeta,
  [UITypes.Decimal]: decimalDefaultMeta,
  [UITypes.Duration]: durationDefaultMeta,
  [UITypes.Number]: numberDefaultMeta,
  [UITypes.Percent]: percentDefaultMeta,
  [UITypes.Rating]: ratingDefaultMeta,
  [UITypes.Time]: timeDefaultMeta,
  [UITypes.User]: userDefaultMeta,
  [UITypes.Barcode]: barcodeDefaultMeta,
}
