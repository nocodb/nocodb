function limitString(msg: string): string {
  if (msg.length > 1000) {
    const first100 = msg.slice(0, 100)
    const last100 = msg.slice(-100)
    return `${first100}...${last100}`
  }
  return msg
}

export async function extractSdkResponseErrorMsg(e: Error & { response: any }, extra?: String) {
  if (!e || !e.response) return e.message
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

  return (limitString(msg) || 'Some error occurred') + (extra ? ` - ${extra}` : '')
}
