const imageExt = ['jpeg', 'gif', 'png', 'png', 'svg', 'bmp', 'ico', 'jpg', 'webp']

const isImage = (name: string, mimetype?: string) => {
  return imageExt.some((e) => name?.toLowerCase().endsWith(`.${e}`)) || mimetype?.startsWith('image/')
}

export { isImage, imageExt }
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
