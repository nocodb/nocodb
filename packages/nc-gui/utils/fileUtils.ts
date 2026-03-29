const imageExt = [
  'jpeg',
  'gif',
  'png',
  'png',
  'svg',
  'bmp',
  'ico',
  'jpg',
  'webp',
  'avif',
  'heif',
  'heifs',
  'heic',
  'heic-sequence',
]

const audioExt = ['mp3', 'flac', 'wav', 'm4a']

const videoExt = [
  'webm',
  'mpg',
  'mp2',
  'mpeg',
  'ogg',
  'mp4',
  'm4v',
  'avi',
  'wmv',
  'mov',
  'qt',
  'flv',
  'mkv',
  '3gp',
  '3g2',
  'vob',
  'ts',
  'mp4a',
]

const wordExt = ['txt', 'doc', 'docx']

const excelExt = ['xls', 'xlsx', 'csv']

const presentationExt = ['ppt', 'pptx']

const zipExt = ['zip', 'rar']

const officeExt = [
  ...wordExt,
  ...excelExt,
  ...presentationExt,
  ...zipExt,
  'css',
  'html',
  'php',
  'c',
  'cpp',
  'h',
  'hpp',
  'js',
  'pdf',
  'pages',
  'ai',
  'psd',
  // 'tiff',
  'dxf',
  // 'svg',
  'eps',
  'ps',
  'ttf',
  'xps',
]

function isAudio(name: string, mimetype?: string) {
  return audioExt.some(e => name?.toLowerCase().endsWith(`.${e}`)) || mimetype?.startsWith('audio/')
}

function isVideo(name: string, mimetype?: string) {
  return videoExt.some(e => name?.toLowerCase().endsWith(`.${e}`)) || mimetype?.startsWith('video/')
}

function isImage(name: string, mimetype?: string) {
  if (mimetype && (mimetype?.startsWith('image/vnd.') || ['image/svg+xml'].includes(mimetype))) {
    return false
  }
  return imageExt.some(e => name?.toLowerCase().endsWith(`.${e}`)) || mimetype?.startsWith('image/')
}

function isPdf(name: string, mimetype?: string) {
  return name?.toLowerCase().endsWith('.pdf') || mimetype?.startsWith('application/pdf')
}

function isWord(name: string, _mimetype?: string) {
  return wordExt.some(e => name?.toLowerCase().endsWith(`.${e}`))
}

function isExcel(name: string, _mimetype?: string) {
  return excelExt.some(e => name?.toLowerCase().endsWith(`.${e}`))
}

function isPresentation(name: string, _mimetype?: string) {
  return presentationExt.some(e => name?.toLowerCase().endsWith(`.${e}`))
}

function isOffice(name: string, _mimetype?: string) {
  return officeExt.some(e => name?.toLowerCase().endsWith(`.${e}`))
}

function isZip(name: string, _mimetype?: string) {
  return zipExt.some(e => name?.toLowerCase().endsWith(`.${e}`))
}

function isPreviewSupportedFile(name: string, mimetype?: string) {
  return isImage(name, mimetype) || isVideo(name, mimetype) || isAudio(name, mimetype) || isPdf(name, mimetype)
}

export { imageExt, isAudio, isExcel, isImage, isOffice, isPdf, isPresentation, isPreviewSupportedFile, isVideo, isWord, isZip }
// Ref : https://stackoverflow.com/a/12002275

// Tested in Mozilla Firefox browser, Chrome
export function readFile(FileElement: HTMLInputElement, CallBackFunction: (content?: any) => void) {
  try {
    if (!FileElement.files || !FileElement.files.length) {
      return CallBackFunction()
    }

    const file = FileElement.files[0]

    if (file) {
      const reader = new FileReader()
      reader.readAsText(file, 'UTF-8')
      reader.onload = function (evt) {
        CallBackFunction(evt.target?.result)
      }
      reader.onerror = function () {
        CallBackFunction()
      }
    }
  }
  catch (Exception) {
    const fallBack = ieReadFile(FileElement.value)
    // eslint-disable-next-line eqeqeq
    if (fallBack != false) {
      CallBackFunction(fallBack)
    }
  }
}

/// Reading files with Internet Explorer
function ieReadFile(filename: string) {
  try {
    const fso = new ActiveXObject('Scripting.FileSystemObject')
    const fh = fso.OpenTextFile(filename, 1)
    const contents = fh.ReadAll()
    fh.Close()
    return contents
  }
  catch (Exception) {
    return false
  }
}

export function extractImageSrcFromRawHtml(rawText: string) {
  // Parse the provided HTML string
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawText, 'text/html')

  // Extract the img element
  const imgElement = doc.querySelector('img')

  // Check if the img element exists
  if (imgElement) {
    // Extract the src attribute
    return imgElement.getAttribute('src')
  }
}

export function getReadableFileSize(sizeInBytes: number) {
  const i = Math.min(Math.floor(Math.log(sizeInBytes) / Math.log(1024)), 4)
  return `${(sizeInBytes / 1024 ** i).toFixed(2) * 1} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`
}

export function getAttachmentIcon(title: MaybeRefOrGetter<string | undefined>, mimetype: MaybeRefOrGetter<string | undefined>) {
  if (isImage(toValue(title) || '', toValue(mimetype))) {
    return 'ncFileTypeImage'
  }

  if (isPdf(toValue(title) || '', toValue(mimetype))) {
    return 'ncFileTypePdf'
  }

  if (isVideo(toValue(title) || '', toValue(mimetype))) {
    return 'ncFileTypeVideo'
  }

  if (isAudio(toValue(title) || '', toValue(mimetype))) {
    return 'ncFileTypeAudio'
  }

  if (isWord(toValue(title) || '', toValue(mimetype))) {
    return 'ncFileTypeWord'
  }

  if (isExcel(toValue(title) || '', toValue(mimetype))) {
    return 'ncFileTypeCsv'
  }

  if (isPresentation(toValue(title) || '', toValue(mimetype))) {
    return 'ncFileTypePresentation'
  }

  if (isZip(toValue(title) || '', toValue(mimetype))) {
    return 'ncFileTypeZip'
  }

  return 'ncFileTypeUnknown'
}

export function getFileTypeLabel(fileName: string, mimeType?: string): string {
  if (isPdf(fileName, mimeType)) return 'PDF'
  if (isExcel(fileName, mimeType)) return 'Excel'
  if (isWord(fileName, mimeType)) return 'Word'
  if (isPresentation(fileName, mimeType)) return 'Presentation'
  if (isImage(fileName, mimeType)) return 'Image'
  if (isVideo(fileName, mimeType)) return 'Video'
  if (isAudio(fileName, mimeType)) return 'Audio'
  if (isZip(fileName, mimeType)) return 'Archive'
  if (mimeType === 'text/csv' || fileName.endsWith('.csv')) return 'CSV'
  if (mimeType === 'application/json' || fileName.endsWith('.json')) return 'JSON'
  if (mimeType === 'text/markdown' || fileName.endsWith('.md')) return 'Markdown'
  if (mimeType === 'text/plain' || fileName.endsWith('.txt')) return 'Text'
  return 'File'
}
