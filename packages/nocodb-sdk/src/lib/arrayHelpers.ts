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
export const uniq = (array: any[]) => {
  return [...new Set(array)];
};
// fallback due to target tsconfig not support flatMap
export const arrFlatMap = (array: any[]) => {
  return array.reduce( (a, b) => a.concat(b), []);
}