import * as jschardet from 'jschardet'
export type detectLocalFileEncodingResult = jschardet.IDetectedMap
export const detectLocalFileEncoding = async (file: File) => {
  return new Promise<detectLocalFileEncodingResult>((resolve) => {
    const reader = new FileReader()

    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target!.result) {
        const arrayBufferResult = e.target!.result as ArrayBuffer
        const array = new Uint8Array(arrayBufferResult)
        let string = ''
        for (let i = 0; i < array.length; ++i) {
          string += String.fromCharCode(array[i]!)
        }
        resolve(jschardet.detect(string))
      }
    }

    reader.readAsArrayBuffer(file)
  })
}
