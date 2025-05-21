export const numberize = (value?: string | number) => {
  if (value === undefined || value === null) {
    return value as undefined;
  }
  if (typeof value === 'number') {
    return value as number;
  } else {
    const result = parseInt(value);
    if (isNaN(result)) {
      return undefined;
    }
    return result;
  }
};
