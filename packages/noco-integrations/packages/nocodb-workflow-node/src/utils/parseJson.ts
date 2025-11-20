function parseJson(jsonString: object | string | undefined) {
  if (!jsonString) return undefined;
  if (typeof jsonString === 'object') return jsonString;
  try {
    return JSON.parse(jsonString);
  } catch {
    return undefined;
  }
}

export {
  parseJson
}