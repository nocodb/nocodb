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

const videoExt = [
  'webm',
  'mpg',
  'mp2',
  'mp3',
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
  'tiff',
  'dxf',
  'svg',
  'eps',
  'ps',
  'ttf',
  'xps',
]

const isAudio = (name: string, mimetype?: string) => {
  return name?.toLowerCase().endsWith('.mp3') || mimetype?.startsWith('audio/')
}

const isVideo = (name: string, mimetype?: string) => {
  return videoExt.some((e) => name?.toLowerCase().endsWith(`.${e}`)) || mimetype?.startsWith('video/')
}

const isImage = (name: string, mimetype?: string) => {
  return imageExt.some((e) => name?.toLowerCase().endsWith(`.${e}`)) || mimetype?.startsWith('image/')
}

const isPdf = (name: string, mimetype?: string) => {
  return name?.toLowerCase().endsWith('.pdf') || mimetype?.startsWith('application/pdf')
}

const isWord = (name: string, _mimetype?: string) => {
  return wordExt.some((e) => name?.toLowerCase().endsWith(`.${e}`))
}

const isExcel = (name: string, _mimetype?: string) => {
  return excelExt.some((e) => name?.toLowerCase().endsWith(`.${e}`))
}

const isPresentation = (name: string, _mimetype?: string) => {
  return presentationExt.some((e) => name?.toLowerCase().endsWith(`.${e}`))
}

const isOffice = (name: string, _mimetype?: string) => {
  return officeExt.some((e) => name?.toLowerCase().endsWith(`.${e}`))
}

const isZip = (name: string, _mimetype?: string) => {
  return zipExt.some((e) => name?.toLowerCase().endsWith(`.${e}`))
}

export { isImage, imageExt, isVideo, isPdf, isOffice, isAudio, isZip, isWord, isExcel, isPresentation }
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
  } catch (Exception) {
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
  } catch (Exception) {
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

export const getReadableFileSize = (sizeInBytes: number) => {
  const i = Math.min(Math.floor(Math.log(sizeInBytes) / Math.log(1024)), 4)
  return `${(sizeInBytes / 1024 ** i).toFixed(2) * 1} ${['B', 'kB', 'MB', 'GB', 'TB'][i]}`
}
