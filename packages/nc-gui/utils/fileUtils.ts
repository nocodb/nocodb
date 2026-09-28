import { WEB_ARTIFACT_MIMETYPE } from 'nocodb-sdk'

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

const isAudio = (name: string, mimetype?: string) => {
  return audioExt.some((e) => name?.toLowerCase().endsWith(`.${e}`)) || mimetype?.startsWith('audio/')
}

const isVideo = (name: string, mimetype?: string) => {
  return videoExt.some((e) => name?.toLowerCase().endsWith(`.${e}`)) || mimetype?.startsWith('video/')
}

const isImage = (name: string, mimetype?: string) => {
  if (mimetype && (mimetype?.startsWith('image/vnd.') || ['image/svg+xml'].includes(mimetype))) {
    return false
  }
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

/** Broader than `text/*`: a `.sh` or `.sql` is usually served as
 *  `application/octet-stream`, so the extension decides. */
const textExt = [
  'txt',
  'md',
  'markdown',
  'log',
  'json',
  'jsonl',
  'yaml',
  'yml',
  'toml',
  'ini',
  'env',
  'xml',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'bat',
  'sql',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'php',
  'pl',
  'lua',
  'r',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'ts',
  'tsx',
  'js',
  'jsx',
  'vue',
  'svelte',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'conf',
  'cfg',
  'diff',
  'patch',
]

const isDelimited = (name: string, mimetype?: string) => {
  return /\.(csv|tsv)$/i.test(name ?? '') || /csv|tab-separated/i.test(mimetype ?? '')
}

const isText = (name: string, mimetype?: string) => {
  if (textExt.some((e) => name?.toLowerCase().endsWith(`.${e}`))) return true
  return /^text\/|json|xml|yaml|x-sh|javascript/i.test(mimetype ?? '')
}

/** A published web artifact (see publish_web_artifact) — its mimetype is a marker,
 *  not a real content type, so it must be checked before the generic `isText`
 *  match (which would otherwise catch it and render it as source, not a page). */
const isWebArtifact = (_name: string, mimetype?: string) => mimetype === WEB_ARTIFACT_MIMETYPE

/**
 * What a chat can open in place. Order matters: `.csv` answers to delimited,
 * text (`text/csv`) and office alike, and many code extensions are also in
 * `officeExt` — the earlier branch is the better renderer in both cases.
 * `webArtifact` must come before `text` for the same reason.
 */
const chatPreviewKind = (
  name: string,
  mimetype?: string,
): 'image' | 'pdf' | 'video' | 'sheet' | 'text' | 'office' | 'webArtifact' | null => {
  if (isImage(name, mimetype)) return 'image'
  if (isPdf(name, mimetype)) return 'pdf'
  if (isVideo(name, mimetype)) return 'video'
  if (isWebArtifact(name, mimetype)) return 'webArtifact'
  if (isDelimited(name, mimetype)) return 'sheet'
  if (isText(name, mimetype)) return 'text'
  if (isOffice(name, mimetype)) return 'office'
  return null
}

const isPreviewSupportedFile = (name: string, mimetype?: string) => {
  return isImage(name, mimetype) || isVideo(name, mimetype) || isAudio(name, mimetype) || isPdf(name, mimetype)
}

export {
  isImage,
  imageExt,
  isVideo,
  isPdf,
  isOffice,
  isAudio,
  isZip,
  isWord,
  isExcel,
  isPresentation,
  isPreviewSupportedFile,
  isText,
  textExt,
  chatPreviewKind,
  isDelimited,
  isWebArtifact,
}
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
  return `${(sizeInBytes / 1024 ** i).toFixed(2) * 1} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`
}

export const getAttachmentIcon = (
  title: MaybeRefOrGetter<string | undefined>,
  mimetype: MaybeRefOrGetter<string | undefined>,
) => {
  if (isImage(toValue(title) || '', toValue(mimetype))) {
    return 'ncFileTypeImage'
  }

  if (isWebArtifact(toValue(title) || '', toValue(mimetype))) {
    return 'ncGlobe'
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

export const getFileTypeLabel = (fileName: string, mimeType?: string): string => {
  if (isWebArtifact(fileName, mimeType)) return 'Web app'
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
