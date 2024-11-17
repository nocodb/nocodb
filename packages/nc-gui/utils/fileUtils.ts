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

const officeExt = [
  'txt',
  'css',
  'html',
  'php',
  'c',
  'cpp',
  'h',
  'hpp',
  'js',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
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
  'zip',
  'rar',
  'csv',
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

const isOffice = (name: string, _mimetype?: string) => {
  return officeExt.some((e) => name?.toLowerCase().endsWith(`.${e}`))
}

export { isImage, imageExt, isVideo, isPdf, isOffice, isAudio }
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
