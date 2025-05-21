export const convertGeoNumberToString = (val: number) => {
  return val.toFixed(10).replace(/\.0+$|(\.[^0]*)0+$/, '$1');
};

export const latLongToJoinedString = (lat: number, long: number) =>
  [lat, long].map((k) => convertGeoNumberToString(k)).join(';');
