import { NcErrorType } from 'nocodb-sdk'

export async function extractSdkResponseErrorMsg(e: Error & { response?: any }) {
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
      // V2 format support
      msg = parsedData.message || parsedData.msg
      errors = parsedData.errors
    } catch {
      msg = 'Some internal error occurred'
    }
  } else {
    // V2 format: prioritize 'message' field over 'msg'
    // V1 format: falls back to 'msg' field
    msg = e.response?.data?.message || e.response?.data?.msg || 'Some internal error occurred'
    errors = e.response.data?.errors
  }

  if (Array.isArray(errors) && errors.length) {
    return errors.map((e: any) => (e.instancePath ? `${e.instancePath} - ` : '') + e.message).join(', ')
  }

  return msg || 'Some error occurred'
}

export async function extractSdkResponseErrorMsgv2(e: unknown): Promise<{
  error: NcErrorType
  message: string
  details?: any
}> {
  // Callers hand over whatever `catch` gave them, so the shape is narrowed once
  // here rather than cast at every call site.
  const err = (e ?? {}) as { response?: { data?: any } }

  const unknownError = {
    error: NcErrorType.ERR_UNKNOWN,
    // TODO: `response?.data?.msg` is fallback for v1 error messages, remove after migrating all error messages to v2 format
    message: err.response?.data?.msg || 'Something went wrong',
  }

  if (!err.response) {
    return unknownError
  }

  if (err.response.data instanceof Blob) {
    try {
      const parsedError = JSON.parse(await err.response.data.text())
      if (parsedError.error && parsedError.error in NcErrorType) {
        return parsedError
      }
      return unknownError
    } catch {
      return unknownError
    }
  } else {
    if (err.response.data?.error && err.response.data.error in NcErrorType) {
      return err.response.data
    }
    return unknownError
  }
}

/**
 * Checks if the error is a unique constraint violation
 * @param e - Error object
 * @returns true if it's a unique constraint violation
 */
export function isUniqueConstraintViolationError(e: Error & { response?: any }): boolean {
  if (!e?.response?.data) return false

  const errorData = e.response.data
  // Check for FIELD_UNIQUE_CONSTRAINT_VIOLATION error code
  return (
    errorData.error === NcErrorType.FIELD_UNIQUE_CONSTRAINT_VIOLATION ||
    (errorData.message ?? errorData.msg)?.includes('Duplicate value') ||
    (errorData.message ?? errorData.msg)?.includes('Unique constraint violation')
  )
}

export { NcErrorType }
