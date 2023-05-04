export const serializeJSON = (data: string | Record<string, any>) => {
  // if already in string format ignore stringify
  if (typeof data === 'string') {
    return data;
  }
  return JSON.stringify(data);
};

export const deserializeJSON = (data: string | Record<string, any>) => {
  // if already in object format ignore parse
  if (typeof data === 'object') {
    return data ?? {};
  }
  try {
    return JSON.parse(data) ?? {};
  } catch (e) {
    return {};
  }
};
