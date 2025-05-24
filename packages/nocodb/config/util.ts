import type { WorkerType } from './model';

const objectOccupied = (obj: object) => {
  if (typeof obj === 'undefined' || Object.values(obj).length === 0) {
    return false;
  }

  for (const key in obj) {
    if (typeof obj[key] === 'object' && objectOccupied(obj[key])) {
      return true;
    } else if (obj[key] !== undefined) {
      return true;
    }
  }

  return false;
};

export const rmUndefined = (obj: object) => {
  const res = {};

  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'object') {
      if (objectOccupied(obj[key])) res[key] = rmUndefined(obj[key]);
    } else if (obj[key] != undefined) {
      res[key] = obj[key];
    }
  });

  return res;
};

export const stringToBoolTry = (
  s: string | undefined,
  inverse = false,
): string | boolean => {
  if (typeof s !== 'string') {
    return s;
  }

  if (s.toLowerCase() === 'true') {
    return inverse ? false : true;
  } else if (s.toLowerCase() === 'false') {
    return inverse ? true : false;
  } else {
    return s;
  }
};

// special case to keep backward compatibility
export const stringToBoolWorker = (
  s: string | undefined,
): WorkerType | string => {
  if (typeof s === 'undefined') {
    return 'disabled';
  }

  if (s.toLowerCase() === 'true') {
    return 'worker';
  } else if (s.toLowerCase() === 'false') {
    return 'main';
  } else {
    return s;
  }
};
