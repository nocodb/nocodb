import { NcErrorType } from 'nocodb-sdk'

export async function extractSdkResponseErrorMsg(e: Error & { response: any }) {
  if (!e || !e.response) {
    if (e?.message?.includes('object ProgressEvent')) {
      return 'Requested file was not accessible. Please check if server allows accessing the file. If you are sure the file exists, it might be a CORS issue.'
    } else {
      return e.message
    }
  }

  let msg
  let errors: any[] | null = null
  if (e.response.data instanceof Blob) {
    try {
      const parsedData = JSON.parse(await e.response.data.text())
      msg = parsedData.msg
      errors = parsedData.errors
    } catch {
      msg = 'Some internal error occurred'
    }
  } else {
    msg = e.response.data.msg || e.response.data.message || 'Some internal error occurred'
    errors = e.response.data.errors
  }

  if (Array.isArray(errors) && errors.length) {
    return errors.map((e: any) => (e.instancePath ? `${e.instancePath} - ` : '') + e.message).join(', ')
  }

  return msg || 'Some error occurred'
}

export async function extractSdkResponseErrorMsgv2(e: Error & { response: any }): Promise<{
  error: NcErrorType
  message: string
  details?: any
}> {
  const unknownError = {
    error: NcErrorType.UNKNOWN_ERROR,
    message: 'Something went wrong',
  }

  if (!e || !e.response) {
    return unknownError
  }

  if (e.response.data instanceof Blob) {
    try {
      const parsedError = JSON.parse(await e.response.data.text())
      if (parsedError.error && parsedError.error in NcErrorType) {
        return parsedError
      }
      return unknownError
    } catch {
      return unknownError
    }
  } else {
    if (e.response.data.error && e.response.data.error in NcErrorType) {
      return e.response.data
    }

    return unknownError
  }
}

export { NcErrorType }
