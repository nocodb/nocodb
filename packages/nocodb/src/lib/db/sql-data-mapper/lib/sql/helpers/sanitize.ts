export function sanitize(v) {
  return v?.replace(/([^\\]|^)(\?+)/g, (_, m1, m2) => {
    return `${m1}${m2.split('?').join('\\?')}`;
  });
}

export function unsanitize(v) {
  return v?.replace(/\\[?]/g, '?');
}
