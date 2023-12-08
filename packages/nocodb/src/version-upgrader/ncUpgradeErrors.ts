export function throwTimeoutError(e, timeoutErrorInfo) {
  if (
    [
      'EHOSTDOWN',
      'ETIMEDOUT',
      'EHOSTUNREACH',
      'ENOTFOUND',
      'ECONNREFUSED',
    ].includes(e.code)
  ) {
    let db = '';
    if (timeoutErrorInfo.connection.filename) {
      // for sqlite
      db = timeoutErrorInfo.connection.filename;
    } else if (
      timeoutErrorInfo.connection.database &&
      timeoutErrorInfo.connection.host &&
      timeoutErrorInfo.connection.port
    ) {
      db = `${timeoutErrorInfo.connection.database} (${timeoutErrorInfo.connection.host}:${timeoutErrorInfo.connection.port})`;
    }
    throw new Error(
      `Failed to connect the database ${db} for Base ${timeoutErrorInfo.baseTitle}.
       Please fix the connection issue or remove the base before trying to upgrade.`,
    );
  }
}
