export async function extractSdkResponseErrorMsg(e: Error & { response: any }) {
  if (!e || !e.response) return e.message
  let msg
  if (e.response.data instanceof Blob) {
    try {
      msg = JSON.parse(await e.response.data.text()).msg
    } catch {
      msg = 'Some internal error occurred'
    }
  } else {
    msg = e.response.data.msg || e.response.data.message || 'Some internal error occurred'
  }
  return msg || 'Some error occurred'
}
