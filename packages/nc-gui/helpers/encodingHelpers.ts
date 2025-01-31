export const supportedEncodings: { value: string; name: string; tooltip?: string }[] = [
  { value: 'utf-8', name: 'UTF-8' },
  { value: 'windows-1252', name: 'Windows-1252', tooltip: 'Legacy single-byte encodings' },
  { value: 'ISO-8859-2', name: 'ISO-8859-2', tooltip: 'Legacy single-byte encodings' },
  { value: 'Shift_JIS', name: 'Shift_JIS', tooltip: 'Legacy multi-byte Japanese encodings' },
  { value: 'ASCII', name: 'ASCII', tooltip: 'Legacy single-byte encodings' },
  { value: 'gb18030', name: 'GB18030', tooltip: 'Legacy multi-byte Chinese (simplified) encodings' },
  { value: 'gb2312', name: 'GB2312', tooltip: 'Legacy multi-byte Chinese (simplified) encodings' },
  { value: 'utf-16', name: 'UTF-16', tooltip: 'Legacy miscellaneous encodings' },
  { value: 'utf-16le', name: 'UTF-16LE', tooltip: 'Legacy miscellaneous encodings' },
  { value: 'utf-16be', name: 'UTF-16BE', tooltip: 'Legacy miscellaneous encodings' },
]
