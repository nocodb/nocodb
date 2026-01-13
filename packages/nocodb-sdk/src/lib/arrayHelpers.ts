export const arrUniq = (array: any[]) => {
  return [...new Set(array)];
};
export const arrIntersection = (...arrays: any[][]) => {
  return arrays.reduce((a, b) => a.filter((c) => b.includes(c)));
};
export const arrDetailedDiff = (a: any[], b: any[]) => {
  const intersected = arrIntersection(a, b);
  return {
    removed: a.filter((old) => !intersected.includes(old)),
    intersected,
    added: b.filter((n) => !intersected.includes(n)),
  };
};

export const arrGetDuplicate = (data: string | number[]) => {
  const dataSet = new Set();
  for (const each of data) {
    if (dataSet.has(each)) {
      return each;
    }
    dataSet.add(each);
  }
  return undefined;
};

export const arrFlattenChildren = <
  T extends Record<string, any>,
  V extends Record<string, any>
>(
  param: {
    payload: T[];
    childHandle: (t: T) => (T & Partial<V>)[];
  },
  acc: (T & Partial<V>)[] = []
): (T & Partial<V>)[] => {
  for (const each of param.payload) {
    acc.push(each as T & Partial<V>);
    const children = param.childHandle(each);
    if (children && children.length > 0) {
      arrFlattenChildren(
        {
          payload: children,
          childHandle: param.childHandle,
        },
        acc
      );
    }
  }
  return acc;
};
// fallback due to target tsconfig not support flatMap
export const arrFlatMap = (array: any[]) => {
  return array.reduce((a, b) => a.concat(b), []);
};
