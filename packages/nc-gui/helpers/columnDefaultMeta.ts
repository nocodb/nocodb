import { precisionFormats, supportedBarcodeFormats } from 'nocodb-sdk'

export { precisionFormats, supportedBarcodeFormats }

export const makePrecisionFormatsDiplay = (t: (input: string) => string) =>
  ({
    0: t('placeholder.decimal0'),
    1: t('placeholder.decimal1'),
    2: t('placeholder.decimal2'),
    3: t('placeholder.decimal3'),
    4: t('placeholder.decimal4'),
    5: t('placeholder.decimal5'),
    6: t('placeholder.decimal6'),
    7: t('placeholder.decimal7'),
    8: t('placeholder.decimal8'),
  } as const)
