export function parseHrtimeToSeconds(hrtime) {
  const seconds = (hrtime[0] + hrtime[1] / 1e6).toFixed(3);
  return seconds;
}
