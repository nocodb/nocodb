export enum SupportedExportCharset {
  'utf-8' = 'utf-8',
  'iso-8859-6' = 'iso-8859-6',
  'windows-1256' = 'windows-1256',
  'iso-8859-4' = 'iso-8859-4',
  'windows-1257' = 'windows-1257',
  'iso-8859-14' = 'iso-8859-14',
  'iso-8859-2' = 'iso-8859-2',
  'windows-1250' = 'windows-1250',
  'gbk' = 'gbk',
  'gb18030' = 'gb18030',
  'big5' = 'big5',
  'koi8-r' = 'koi8-r',
  'koi8-u' = 'koi8-u',
  'iso-8859-5' = 'iso-8859-5',
  'windows-1251' = 'windows-1251',
  'x-mac-cyrillic' = 'x-mac-cyrillic',
  'iso-8859-7' = 'iso-8859-7',
  'windows-1253' = 'windows-1253',
  'iso-8859-8' = 'iso-8859-8',
  'windows-1255' = 'windows-1255',
  'euc-jp' = 'euc-jp',
  'iso-2022-jp' = 'iso-2022-jp',
  'shift-jis' = 'shift-jis',
  'euc-kr' = 'euc-kr',
  'macintosh' = 'macintosh',
  'iso-8859-10' = 'iso-8859-10',
  'iso-8859-16' = 'iso-8859-16',
  'windows-874' = 'windows-874',
  'windows-1254' = 'windows-1254',
  'windows-1258' = 'windows-1258',
  'iso-8859-1' = 'iso-8859-1',
  'windows-1252' = 'windows-1252',
  'iso-8859-3' = 'iso-8859-3',
}

export const charsetOptions = [
  { label: 'Unicode (UTF-8)', value: SupportedExportCharset['utf-8'] },
  { label: 'Arabic (ISO-8859-6)', value: SupportedExportCharset['iso-8859-6'] },
  {
    label: 'Arabic (Windows-1256)',
    value: SupportedExportCharset['windows-1256'],
  },
  { label: 'Baltic (ISO-8859-4)', value: SupportedExportCharset['iso-8859-4'] },
  {
    label: 'Baltic (windows-1257)',
    value: SupportedExportCharset['windows-1257'],
  },
  {
    label: 'Celtic (ISO-8859-14)',
    value: SupportedExportCharset['iso-8859-14'],
  },
  {
    label: 'Central European (ISO-8859-2)',
    value: SupportedExportCharset['iso-8859-2'],
  },
  {
    label: 'Central European (Windows-1250)',
    value: SupportedExportCharset['windows-1250'],
  },
  { label: 'Chinese, Simplified (GBK)', value: SupportedExportCharset['gbk'] },
  { label: 'Chinese (GB18030)', value: SupportedExportCharset['gb18030'] },
  {
    label: 'Chinese Traditional (Big5)',
    value: SupportedExportCharset['big5'],
  },
  { label: 'Cyrillic (KOI8-R)', value: SupportedExportCharset['koi8-r'] },
  { label: 'Cyrillic (KOI8-U)', value: SupportedExportCharset['koi8-u'] },
  {
    label: 'Cyrillic (ISO-8859-5)',
    value: SupportedExportCharset['iso-8859-5'],
  },
  {
    label: 'Cyrillic (Windows-1251)',
    value: SupportedExportCharset['windows-1251'],
  },
  {
    label: 'Cyrillic Mac OS (x-mac-cyrillic)',
    value: SupportedExportCharset['x-mac-cyrillic'],
  },
  { label: 'Greek (ISO-8859-7)', value: SupportedExportCharset['iso-8859-7'] },
  {
    label: 'Greek (Windows-1253)',
    value: SupportedExportCharset['windows-1253'],
  },
  { label: 'Hebrew (ISO-8859-8)', value: SupportedExportCharset['iso-8859-8'] },
  {
    label: 'Hebrew (Windows-1255)',
    value: SupportedExportCharset['windows-1255'],
  },
  { label: 'Japanese (EUC-JP)', value: SupportedExportCharset['euc-jp'] },
  {
    label: 'Japanese (ISO-2022-JP)',
    value: SupportedExportCharset['iso-2022-jp'],
  },
  { label: 'Japanese (Shift-JIS)', value: SupportedExportCharset['shift-jis'] },
  { label: 'Korean (EUC-KR)', value: SupportedExportCharset['euc-kr'] },
  { label: 'Macintosh', value: SupportedExportCharset['macintosh'] },
  {
    label: 'Nordic (ISO-8859-10)',
    value: SupportedExportCharset['iso-8859-10'],
  },
  {
    label: 'South-Eastern European (ISO-8859-16)',
    value: SupportedExportCharset['iso-8859-16'],
  },
  { label: 'Thai (Windows-874)', value: SupportedExportCharset['windows-874'] },
  {
    label: 'Turkish (Windows-1254)',
    value: SupportedExportCharset['windows-1254'],
  },
  {
    label: 'Vietnamese (Windows-1258)',
    value: SupportedExportCharset['windows-1258'],
  },
  {
    label: 'Western European (ISO-8859-1)',
    value: SupportedExportCharset['iso-8859-1'],
  },
  {
    label: 'Western European (Windows-1252)',
    value: SupportedExportCharset['windows-1252'],
  },
  {
    label: 'Latin 3 (ISO-8859-3)',
    value: SupportedExportCharset['iso-8859-3'],
  },
];

export enum CsvColumnSeparator {
  ',' = ',',
  ';' = ';',
  '|' = '|',
  'tab' = '\t',
}

export const csvColumnSeparatorOptions = [
  {
    label: 'Comma (,)',
    value: CsvColumnSeparator[','],
  },
  {
    label: 'Semi-colon (;)',
    value: CsvColumnSeparator[';'],
  },
  {
    label: 'Pipe (|)',
    value: CsvColumnSeparator['|'],
  },
  {
    label: '<Tab>',
    value: CsvColumnSeparator['tab'],
  },
];
