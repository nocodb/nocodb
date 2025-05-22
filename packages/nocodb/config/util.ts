export const objectOcuppied = (obj: Object) => {
    if (typeof obj === 'undefined' || Object.values(obj).length === 0) {
        return false;
    }

    for (const key in obj) {
        if (typeof obj[key] === 'object' && objectOcuppied(obj[key])) {
            return true
        } else if (obj[key] !== undefined) {
            return true
        }
    }

    return false;
}

export const rmUndefined = (obj: Object) => {
  let res = {};

  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'object') {
        if (objectOcuppied(obj[key])) res[key] = rmUndefined(obj[key]);
    } else if (obj[key] != undefined) {
        res[key] = obj[key];
    }
  });

  return res;
};
