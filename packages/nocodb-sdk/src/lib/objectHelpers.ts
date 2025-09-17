export const objRemoveEmptyStringProps = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map((item) => objRemoveEmptyStringProps(item))
      .filter((item) => item !== undefined);
  }

  const newObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string' && value === '') {
        continue;
      }
      const processedValue = objRemoveEmptyStringProps(value);
      if (processedValue !== undefined) {
        newObj[key] = processedValue;
      }
    }
  }
  return newObj;
};
